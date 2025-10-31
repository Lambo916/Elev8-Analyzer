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
    // EMERGENCY BYPASS: Temporarily disable all usage limits
    if (process.env.DISABLE_USAGE_LIMITS === 'true') {
      console.log(`[Usage Check] EMERGENCY BYPASS ACTIVE - Allowing all requests`);
      return { allowed: true, count: 0 };
    }

    const ipAddress = getClientIp(req);
    const toolLower = tool.toLowerCase();
    
    console.log(`[Usage Check] Starting - IP: ${ipAddress}, Tool: ${tool} (normalized: ${toolLower})`);
    
    if (ipAddress === 'unknown') {
      console.warn(`[Usage] Unable to determine client IP for ${tool} - ALLOWING REQUEST with monitoring`);
      return { allowed: true, count: 0 };
    }

    const db = getDb();
    
    // Check current usage for this specific tool (case-insensitive)
    const existing = await db
      .select()
      .from(usageTracking)
      .where(and(
        eq(usageTracking.ipAddress, ipAddress),
        eq(usageTracking.tool, toolLower)
      ))
      .limit(1);

    const currentCount = existing.length > 0 ? existing[0].reportCount : 0;
    
    console.log(`[Usage Check] Query result - Records found: ${existing.length}, Count: ${currentCount}`);

    if (currentCount >= 30) {
      console.log(`[Usage] IP ${ipAddress} has reached limit for ${toolLower}: ${currentCount}/30 - BLOCKING`);
      return { allowed: false, count: currentCount };
    }

    console.log(`[Usage] IP ${ipAddress} within limit for ${toolLower}: ${currentCount}/30 - ALLOWING`);
    return { allowed: true, count: currentCount };
  } catch (error: any) {
    console.error(`[Usage] Check error for ${tool} - FAIL-SAFE: ALLOWING REQUEST`, error.message);
    // CRITICAL: Fail open - allow request if anything goes wrong
    return { allowed: true, count: 0 };
  }
}

// Increment usage counter for a specific tool
async function incrementUsage(req: VercelRequest, tool: string): Promise<{ success: boolean; count: number; limitReached?: boolean }> {
  try {
    const ipAddress = getClientIp(req);
    const toolLower = tool.toLowerCase();
    
    if (ipAddress === 'unknown') {
      console.warn(`[Usage Increment] Unable to determine client IP for ${tool} - skipping usage tracking`);
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
        eq(usageTracking.tool, toolLower),
        sql`${usageTracking.reportCount} < 30`
      ))
      .returning();

    if (updated.length > 0) {
      console.log(`[Usage Increment] IP ${ipAddress} incremented to ${updated[0].reportCount}/30 for ${toolLower}`);
      return { success: true, count: updated[0].reportCount };
    }

    // Check if record exists
    const existing = await db
      .select()
      .from(usageTracking)
      .where(and(
        eq(usageTracking.ipAddress, ipAddress),
        eq(usageTracking.tool, toolLower)
      ))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[Usage Increment] IP ${ipAddress} already at limit for ${toolLower}: ${existing[0].reportCount}/30`);
      return { success: false, count: existing[0].reportCount, limitReached: true };
    }

    // First report for this IP and tool
    const inserted = await db
      .insert(usageTracking)
      .values({
        ipAddress,
        reportCount: 1,
        tool: toolLower,
      })
      .returning();
    
    console.log(`[Usage Increment] IP ${ipAddress} first report for ${toolLower}: 1/30`);
    return { success: true, count: inserted[0].reportCount };
  } catch (error: any) {
    console.error(`[Usage Increment] Error for ${tool}:`, error.message);
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

      // Normalize tool name to lowercase for database consistency
      const toolName = tool ? String(tool).toLowerCase() : 'elev8analyzer';
      const displayName = toolName === 'grantgenie' ? 'GrantGenie' : toolName === 'elev8analyzer' ? 'Elev8 Analyzer' : 'CompliPilot';
      
      console.log(`[Vercel Catch-All] /api/generate - Processing ${displayName} request (tool: ${toolName})`);

      // Check 30-report usage limit BEFORE generation
      const usageCheck = await checkUsageLimit(req, toolName);
      if (!usageCheck.allowed) {
        console.log(`[Vercel Catch-All] /api/generate - Request BLOCKED: usage limit reached for ${toolName} (${usageCheck.count}/30)`);
        return res.status(429).json({
          error: `You've reached your 30-report limit for the ${displayName} soft launch.`,
          limitReached: true,
          count: usageCheck.count,
          limit: 30,
          tool: toolName
        });
      }

      console.log(`[Vercel Catch-All] /api/generate - Usage check PASSED: ${usageCheck.count}/30 for ${toolName}`);

      let response;

      // Handle Elev8 Analyzer diagnostic flow
      if (toolName === 'elev8analyzer') {
        const {
          businessName,
          industry,
          revenueRange,
          creditProfile,
          employees,
          challenges,
          goals
        } = formData;

        console.log(`[Vercel Catch-All] Generating Elev8 analysis for: ${businessName} (${industry})`);

        // Validate required fields
        if (!businessName || !industry || !revenueRange || !employees) {
          return res.status(400).json({
            error: "Business name, industry, revenue range, and employee count are required.",
          });
        }

        // Build diagnostic prompt
        const diagnosticPrompt = `Generate a comprehensive business health diagnostic for the following company:

BUSINESS PROFILE:
- Business Name: ${businessName}
- Industry: ${industry}
- Annual Revenue: ${revenueRange}
- Credit Profile: ${creditProfile || 'Not provided'}
- Employees: ${employees}

CHALLENGES:
${challenges || 'Not specified'}

STRATEGIC GOALS:
${goals || 'Not specified'}

Analyze this business across all 8 pillars and provide a detailed, actionable assessment. Be specific and realistic based on the profile provided. Return ONLY valid JSON matching the exact structure specified in the system prompt.`;

        const systemPrompt = `You are Elev8 Analyzer, an expert business diagnostic assistant that evaluates companies across 8 critical pillars of business health and growth.

Your role is to generate comprehensive, actionable reports that score each pillar (0-100), assign status indicators, and provide prioritized roadmaps for improvement.

CRITICAL OUTPUT STRUCTURE - You MUST return valid JSON matching this exact schema:

{
  "overall": {
    "score": <number 0-100>,
    "summary": "<2-3 sentence high-level assessment>"
  },
  "pillars": [
    {
      "name": "Formation & Compliance",
      "score": <0-100>,
      "status": "red|yellow|green",
      "insights": ["insight 1", "insight 2"],
      "actions": ["action 1", "action 2", "action 3"]
    },
    {
      "name": "Business Credit Readiness",
      "score": <0-100>,
      "status": "red|yellow|green",
      "insights": ["insight 1", "insight 2"],
      "actions": ["action 1", "action 2", "action 3"]
    },
    {
      "name": "Financials & Cash Flow",
      "score": <0-100>,
      "status": "red|yellow|green",
      "insights": ["insight 1", "insight 2"],
      "actions": ["action 1", "action 2", "action 3"]
    },
    {
      "name": "Operations & Systems",
      "score": <0-100>,
      "status": "red|yellow|green",
      "insights": ["insight 1", "insight 2"],
      "actions": ["action 1", "action 2", "action 3"]
    },
    {
      "name": "Sales & Marketing",
      "score": <0-100>,
      "status": "red|yellow|green",
      "insights": ["insight 1", "insight 2"],
      "actions": ["action 1", "action 2", "action 3"]
    },
    {
      "name": "Brand & Web Presence",
      "score": <0-100>,
      "status": "red|yellow|green",
      "insights": ["insight 1", "insight 2"],
      "actions": ["action 1", "action 2", "action 3"]
    },
    {
      "name": "Risk & Legal Posture",
      "score": <0-100>,
      "status": "red|yellow|green",
      "insights": ["insight 1", "insight 2"],
      "actions": ["action 1", "action 2", "action 3"]
    },
    {
      "name": "Growth Strategy & Execution",
      "score": <0-100>,
      "status": "red|yellow|green",
      "insights": ["insight 1", "insight 2"],
      "actions": ["action 1", "action 2", "action 3"]
    }
  ],
  "roadmap": {
    "d30": ["30-day action 1", "30-day action 2", "30-day action 3"],
    "d60": ["60-day action 1", "60-day action 2", "60-day action 3"],
    "d90": ["90-day action 1", "90-day action 2", "90-day action 3"]
  }
}

SCORING GUIDELINES:
- Scores 0-40: Red status (critical issues, immediate attention required)
- Scores 41-70: Yellow status (needs improvement, moderate priority)
- Scores 71-100: Green status (solid foundation, optimize and maintain)
- Overall score: Weighted average emphasizing Financials, Operations, and Sales & Marketing

INSIGHTS GUIDELINES:
- Provide 2 specific, data-driven insights per pillar
- Reference the business information provided
- Be honest but constructive

ACTIONS GUIDELINES:
- Provide exactly 3 prioritized, actionable steps per pillar
- Make them specific, measurable, and achievable
- Start with highest-impact items
- Be realistic given company size and resources

ROADMAP GUIDELINES:
- 30-day: Quick wins and foundational fixes
- 60-day: Process improvements and systematic changes
- 90-day: Strategic initiatives and growth investments
- Each timeframe should have 3 specific actions

REMEMBER: Return ONLY valid JSON. No markdown, no extra text, just the JSON object.`;

        try {
          const ai = getOpenAI();
          
          const completion = await ai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: diagnosticPrompt,
              },
            ],
            response_format: { type: "json_object" },
            max_tokens: 3500,
          });

          response = JSON.parse(completion.choices[0].message.content || '{}');
          console.log(`[Vercel Catch-All] Elev8 analysis generated successfully`);

        } catch (error: any) {
          console.error('[Vercel Catch-All] OpenAI error:', error.message);
          return res.status(500).json({ 
            error: 'Failed to generate analysis. Please try again.',
            details: error.message 
          });
        }

      } else {
        // Handle GrantGenie/CompliPilot (legacy HTML generation)
        console.log('[Vercel Catch-All] Using legacy HTML generation for', toolName);
        
        const profile = resolveProfile(
          formData.filingType || '',
          formData.jurisdiction || '',
          formData.entityType || ''
        );

        let reportHtml = '';
        
        if (profile) {
          const checklistHtml = profile.checklist.map(item => 
            `<li><strong>${item.label}:</strong> ${item.description}</li>`
          ).join('\n');
          
          reportHtml = `<h2>Filing Profile: ${profile.name}</h2>
<h3>Requirements Checklist</h3>
<ul>${checklistHtml}</ul>`;
        } else {
          try {
            const ai = getOpenAI();
            const prompt = `Generate a compliance report for:
Entity: ${formData.entityName}
Type: ${formData.entityType}
Jurisdiction: ${formData.jurisdiction}
Filing Type: ${formData.filingType}
Deadline: ${formData.deadline || 'Not specified'}`;

            const completion = await ai.chat.completions.create({
              model: "gpt-4o",
              messages: [{
                role: "system",
                content: "You are an AI assistant. Generate professional reports in HTML format."
              }, {
                role: "user",
                content: prompt
              }],
              max_tokens: 4000,
            });

            reportHtml = completion.choices[0].message.content || '';
          } catch (error: any) {
            console.error('[Vercel Catch-All] OpenAI error:', error.message);
            return res.status(500).json({ 
              error: 'Failed to generate report. Please try again.',
              details: error.message 
            });
          }
        }

        response = { reportHtml };
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
      return res.json(response);
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
