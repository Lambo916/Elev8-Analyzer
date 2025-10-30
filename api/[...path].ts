import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import sanitizeHtml from 'sanitize-html';
import { getDb } from './_lib/db-serverless.js';
import { validateEnv } from './config.js';
import OpenAI from 'openai';
import { resolveProfile } from './_lib/filing-profiles.js';
import { complianceReports, insertComplianceReportSchema, usageTracking } from './_lib/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

// Validate environment on cold start
try {
  validateEnv();
} catch (error: any) {
  console.error('Environment validation failed:', error.message);
}

// Initialize Supabase client (fail hard if not configured)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: SUPABASE_URL and SUPABASE_ANON_KEY must be set in production');
}

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Initialize OpenAI
let openai: OpenAI | null = null;
function getOpenAI() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
    openai = new OpenAI({ apiKey: apiKey.replace(/\s+/g, '').trim() });
  }
  return openai;
}

// Get client IP address from request (Vercel-optimized)
function getClientIp(req: VercelRequest): string {
  // Try Vercel-specific headers first (highest priority for Vercel deployments)
  const vercelIp = req.headers['x-vercel-forwarded-for'] || req.headers['x-vercel-ip-address'];
  if (vercelIp) {
    const ip = typeof vercelIp === 'string' ? vercelIp.split(',')[0].trim() : String(vercelIp).trim();
    console.log(`[IP Detection] Detected via Vercel header: ${ip}`);
    return ip;
  }
  
  // Try standard x-forwarded-for header (most common proxy header)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : String(forwarded[0]).trim();
    console.log(`[IP Detection] Detected via x-forwarded-for: ${ip}`);
    return ip;
  }
  
  // Try x-real-ip header (used by some proxies)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    const ip = typeof realIp === 'string' ? realIp.trim() : String(realIp).trim();
    console.log(`[IP Detection] Detected via x-real-ip: ${ip}`);
    return ip;
  }
  
  // Fallback to socket remote address (direct connection)
  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    console.log(`[IP Detection] Detected via socket: ${socketIp}`);
    return socketIp;
  }
  
  // Log all headers for debugging when IP cannot be determined
  console.error('[IP Detection] Failed to detect IP. Available headers:', {
    'x-vercel-forwarded-for': req.headers['x-vercel-forwarded-for'],
    'x-vercel-ip-address': req.headers['x-vercel-ip-address'],
    'x-forwarded-for': req.headers['x-forwarded-for'],
    'x-real-ip': req.headers['x-real-ip'],
    'socket.remoteAddress': req.socket?.remoteAddress
  });
  
  return 'unknown';
}

// Check usage limit for a specific tool
async function checkUsageLimit(req: VercelRequest, tool: string): Promise<{ allowed: boolean; count: number }> {
  try {
    const ipAddress = getClientIp(req);
    
    if (ipAddress === 'unknown') {
      console.warn(`[Usage] Unable to determine client IP for ${tool} - allowing request with monitoring`);
      console.warn('[Usage] This should be investigated if it happens frequently in production');
      return { allowed: true, count: 0 };
    }

    const db = getDb();
    
    // Check current usage for this specific tool
    const existing = await db
      .select()
      .from(usageTracking)
      .where(and(
        eq(usageTracking.ipAddress, ipAddress),
        eq(usageTracking.tool, tool)
      ))
      .limit(1);

    const currentCount = existing.length > 0 ? existing[0].reportCount : 0;

    if (currentCount >= 30) {
      console.log(`[Usage] IP ${ipAddress} has reached limit for ${tool}: ${currentCount}/30`);
      return { allowed: false, count: currentCount };
    }

    console.log(`[Usage] IP ${ipAddress} current usage for ${tool}: ${currentCount}/30`);
    return { allowed: true, count: currentCount };
  } catch (error) {
    console.error(`[Usage] Check error for ${tool}:`, error);
    return { allowed: true, count: 0 };
  }
}

// Increment usage counter for a specific tool
async function incrementUsage(req: VercelRequest, tool: string): Promise<{ success: boolean; count: number; limitReached?: boolean }> {
  try {
    const ipAddress = getClientIp(req);
    
    if (ipAddress === 'unknown') {
      console.warn(`[Usage] Unable to determine client IP for ${tool} - skipping usage tracking`);
      console.warn('[Usage] Report will be delivered but not counted toward limit');
      return { success: true, count: 0, limitReached: false };
    }

    const db = getDb();
    
    // Atomic increment with strict limit enforcement
    const updated = await db
      .update(usageTracking)
      .set({
        reportCount: sql`${usageTracking.reportCount} + 1`,
        lastUpdated: new Date(),
      })
      .where(and(
        eq(usageTracking.ipAddress, ipAddress),
        eq(usageTracking.tool, tool),
        sql`${usageTracking.reportCount} < 30`
      ))
      .returning();

    if (updated.length > 0) {
      console.log(`[Usage] IP ${ipAddress} incremented to ${updated[0].reportCount}/30 for ${tool}`);
      return { success: true, count: updated[0].reportCount };
    }

    // Check if record exists
    const existing = await db
      .select()
      .from(usageTracking)
      .where(and(
        eq(usageTracking.ipAddress, ipAddress),
        eq(usageTracking.tool, tool)
      ))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[Usage] IP ${ipAddress} already at limit for ${tool}: ${existing[0].reportCount}/30`);
      return { success: false, count: existing[0].reportCount, limitReached: true };
    }

    // First report for this IP and tool
    const inserted = await db
      .insert(usageTracking)
      .values({
        ipAddress,
        reportCount: 1,
        tool,
      })
      .returning();
    
    console.log(`[Usage] IP ${ipAddress} first report for ${tool}: 1/30`);
    return { success: true, count: inserted[0].reportCount };
  } catch (error) {
    console.error(`[Usage] Increment error for ${tool}:`, error);
    return { success: false, count: 0, limitReached: true };
  }
}

// Sanitize HTML content to prevent XSS
function sanitizeHtmlContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'class'],
    },
  });
}

// Authenticate request and extract user ID (fail hard on errors)
async function authenticateRequest(req: VercelRequest): Promise<string> {
  const authHeader = req.headers.authorization as string;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  if (!supabase) {
    // Fail hard if Supabase is not configured
    console.error('CRITICAL: Supabase client not initialized');
    throw new Error('AUTH_SERVICE_UNAVAILABLE');
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.warn('Invalid auth token:', error?.message);
      throw new Error('UNAUTHORIZED');
    }

    return user.id;
  } catch (error: any) {
    console.error('Auth error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'AUTH_SERVICE_UNAVAILABLE') {
      throw error;
    }
    throw new Error('UNAUTHORIZED');
  }
}

// Helper for CORS (production-locked with development support)
function setCORS(res: VercelResponse, origin: string | undefined) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const allowedOrigins = [
    'https://analyzer.yourbizguru.com',
    'https://www.yourbizguru.com',
    /https:\/\/.*\.vercel\.app$/,
  ];

  // In development, also allow localhost
  if (isDevelopment && origin?.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return;
  }

  let allowOrigin = false;
  if (origin) {
    allowOrigin = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      return allowed.test(origin);
    });
  }

  res.setHeader('Access-Control-Allow-Origin', allowOrigin && origin ? origin : 'https://analyzer.yourbizguru.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Main handler - wrapped in comprehensive error handling
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ALWAYS set CORS headers first
  const origin = req.headers.origin as string | undefined;
  setCORS(res, origin);

  // Ensure JSON content type for all responses
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url = '', method = 'GET' } = req;
  const path = url.split('?')[0];

  // Log incoming request for debugging
  console.log(`[Vercel] ${method} ${path}`);

  try {
    // Route: /api/db/ping (Database health check - public)
    if (path.endsWith('/api/db/ping') && method === 'GET') {
      try {
        const db = getDb();
        const result = await db.execute(sql`SELECT 1 as ping`);
        return res.json({ 
          ok: true, 
          result: result.rows[0],
          database: 'connected'
        });
      } catch (error: any) {
        console.error("Database health check failed:", error);
        return res.status(500).json({ 
          ok: false, 
          error: 'Database connection failed',
          database: 'disconnected'
        });
      }
    }

    // Route: /api/auth/config (public - anon key is meant to be public)
    if (path.endsWith('/api/auth/config') && method === 'GET') {
      if (supabaseUrl && supabaseAnonKey) {
        return res.json({
          supabaseUrl,
          supabaseAnonKey,
          authEnabled: true
        });
      } else {
        return res.json({
          authEnabled: false,
          message: "Authentication service not configured"
        });
      }
    }

    // Route: /api/generate (POST) - public (for report generation)
    if (path.endsWith('/api/generate') && method === 'POST') {
      console.log('[Vercel Catch-All] /api/generate - Starting report generation');
      
      const { formData, tool } = req.body as any;
      
      if (!formData) {
        console.error('[Vercel Catch-All] /api/generate - Missing formData');
        return res.status(400).json({ error: 'formData is required' });
      }

      // Normalize tool name (case-insensitive)
      const normalizedTool = tool ? String(tool).toLowerCase() : 'elev8analyzer';
      const toolName = normalizedTool === 'grantgenie' ? 'GrantGenie' : normalizedTool === 'elev8analyzer' ? 'Elev8Analyzer' : 'CompliPilot';
      const displayName = toolName === 'GrantGenie' ? 'GrantGenie' : toolName === 'Elev8Analyzer' ? 'Elev8 Analyzer' : 'CompliPilot';
      
      console.log(`[Vercel Catch-All] /api/generate - Processing ${toolName} request`);

      // Check 30-report usage limit BEFORE generation
      const usageCheck = await checkUsageLimit(req, toolName);
      if (!usageCheck.allowed) {
        console.log(`[Vercel Catch-All] /api/generate - Request blocked: usage limit reached for ${toolName} (${usageCheck.count}/30)`);
        return res.status(429).json({
          error: `You've reached your 30-report limit for the ${displayName} soft launch.`,
          limitReached: true,
          count: usageCheck.count,
          limit: 30,
          tool: toolName
        });
      }

      console.log(`[Vercel Catch-All] /api/generate - Usage check passed: ${usageCheck.count}/30 for ${toolName}`);
      console.log('[Vercel Catch-All] /api/generate - Form data:', {
        filingType: formData.filingType,
        jurisdiction: formData.jurisdiction,
        entityType: formData.entityType,
        businessName: formData.businessName
      });

      // Try pre-built profile first
      const profile = resolveProfile(
        formData.filingType || '',
        formData.jurisdiction || '',
        formData.entityType || ''
      );

      let reportHtml = '';
      
      if (profile) {
        console.log('[Vercel] /api/generate - Using pre-built profile:', profile.name);
        
        // Generate HTML from profile
        const checklistHtml = profile.checklist.map(item => 
          `<li><strong>${item.label}:</strong> ${item.description}</li>`
        ).join('\n');
        
        reportHtml = `<h2>Filing Profile: ${profile.name}</h2>
<h3>Requirements Checklist</h3>
<ul>${checklistHtml}</ul>`;
      } else {
        console.log('[Vercel] /api/generate - Using OpenAI for report generation');
        
        try {
          const ai = getOpenAI();
          const prompt = `Generate a compliance report for:
Entity: ${formData.entityName}
Type: ${formData.entityType}
Jurisdiction: ${formData.jurisdiction}
Filing Type: ${formData.filingType}
Deadline: ${formData.deadline || 'Not specified'}`;

          console.log('[Vercel] /api/generate - Calling OpenAI API...');
          
          // Add timeout protection for OpenAI call (9 seconds to be safe)
          const completion = await Promise.race([
            ai.chat.completions.create({
              model: "gpt-4o",
              messages: [{
                role: "system",
                content: "You are GrantGenie, an AI grant writing assistant. Generate professional grant proposals in HTML format with structured sections."
              }, {
                role: "user",
                content: prompt
              }],
              max_tokens: 4000,
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('OpenAI API timeout')), 9000)
            )
          ]) as any;

          console.log('[Vercel] /api/generate - OpenAI API call completed');
          reportHtml = completion.choices[0].message.content || '';
        } catch (error: any) {
          console.error('[Vercel] /api/generate - OpenAI error:', error.message);
          
          // Return a friendly error instead of crashing
          return res.status(500).json({ 
            error: 'Failed to generate report. Please try again.',
            details: error.message 
          });
        }
      }

      console.log(`[Vercel Catch-All] /api/generate - Report generated successfully for ${toolName}`);
      
      // Increment usage counter AFTER successful generation
      const incrementResult = await incrementUsage(req, toolName);
      
      // If increment failed due to limit (race condition), reject the request
      if (!incrementResult.success && incrementResult.limitReached) {
        console.log(`[Vercel Catch-All] /api/generate - Limit reached during increment for ${toolName}: ${incrementResult.count}/30`);
        return res.status(429).json({
          error: `You've reached your 30-report limit for the ${displayName} soft launch.`,
          limitReached: true,
          count: incrementResult.count,
          limit: 30,
          tool: toolName
        });
      }

      console.log(`[Vercel Catch-All] /api/generate - Usage incremented: ${incrementResult.count}/30 for ${toolName}`);
      return res.json({ reportHtml });
    }

    // All routes below require authentication
    let userId: string;
    try {
      userId = await authenticateRequest(req);
    } catch (error: any) {
      if (error.message === 'AUTH_SERVICE_UNAVAILABLE') {
        return res.status(503).json({ error: 'Authentication service temporarily unavailable.' });
      }
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Route: /api/reports/save (POST) - requires authentication
    if (path.endsWith('/api/reports/save') && method === 'POST') {
      // Strip any user-controlled fields that should be server-controlled
      const { userId: _, ownerId: __, ...sanitizedBody } = req.body as any;
      
      // Validate request body
      const reportData = insertComplianceReportSchema.parse(sanitizedBody);
      
      // Sanitize HTML content and enforce ownership
      const finalData = {
        ...reportData,
        htmlContent: sanitizeHtmlContent(reportData.htmlContent),
        userId: userId, // Always use authenticated user ID
        ownerId: '', // Clear ownerId in production
      };

      const db = getDb();
      const [report] = await db.insert(complianceReports).values(finalData).returning();
      
      return res.json(report);
    }

    // Route: /api/reports/list (GET) - requires authentication
    if (path.endsWith('/api/reports/list') && method === 'GET') {
      const toolkitCode = req.query.toolkit as string;

      if (!toolkitCode) {
        return res.status(400).json({ error: 'toolkit query parameter is required' });
      }

      const db = getDb();
      
      const reports = await db
        .select({
          id: complianceReports.id,
          name: complianceReports.name,
          entityName: complianceReports.entityName,
          entityType: complianceReports.entityType,
          jurisdiction: complianceReports.jurisdiction,
          filingType: complianceReports.filingType,
          deadline: complianceReports.deadline,
          checksum: complianceReports.checksum,
          createdAt: complianceReports.createdAt,
        })
        .from(complianceReports)
        .where(and(
          eq(complianceReports.toolkitCode, toolkitCode),
          eq(complianceReports.userId, userId)
        ))
        .orderBy(desc(complianceReports.createdAt));

      return res.json(reports);
    }

    // Route: /api/reports/:id (GET) - requires authentication
    if (path.match(/\/api\/reports\/[^/]+$/) && method === 'GET') {
      const id = path.split('/').pop() as string;
      const db = getDb();
      
      const [report] = await db
        .select()
        .from(complianceReports)
        .where(and(
          eq(complianceReports.id, id),
          eq(complianceReports.userId, userId)
        ));

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      return res.json(report);
    }

    // Route: /api/reports/:id (DELETE) - requires authentication
    if (path.match(/\/api\/reports\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/').pop() as string;
      const db = getDb();
      
      const result = await db
        .delete(complianceReports)
        .where(and(
          eq(complianceReports.id, id),
          eq(complianceReports.userId, userId)
        ))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Report not found or access denied' });
      }

      return res.json({ success: true });
    }

    // No route matched
    return res.status(404).json({ error: 'Not found' });

  } catch (error: any) {
    console.error('[Vercel] API error:', error);
    console.error('[Vercel] Error stack:', error.stack);
    console.error('[Vercel] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    
    // ALWAYS return JSON, never let Vercel show HTML error page
    try {
      return res.status(500).json({ 
        error: 'Something went wrong. Please try again later.',
        ...(process.env.NODE_ENV !== 'production' && { 
          debug: error.message,
          stack: error.stack 
        })
      });
    } catch (jsonError) {
      // Last resort: if JSON serialization fails, send plain text JSON
      res.status(500).send(JSON.stringify({ 
        error: 'Internal server error' 
      }));
    }
  }
}
