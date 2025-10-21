import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './db-serverless';
import { validateEnv } from './config';
import OpenAI from 'openai';
import { resolveProfile } from '../shared/filing-profiles';
import { complianceReports, insertComplianceReportSchema } from '../shared/schema';
import { eq, desc, or, and, sql } from 'drizzle-orm';

// Validate environment on cold start
try {
  validateEnv();
} catch (error: any) {
  console.error('Environment validation failed:', error.message);
}

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

// Helper to get caller identity
function getCaller(req: VercelRequest) {
  const userId = (req.headers['x-user-id'] as string) || null;
  const ownerId = (req.headers['x-owner-id'] as string) || null;
  return { userId, ownerId };
}

// Helper for CORS
function setCORS(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-owner-id');
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url = '', method = 'GET' } = req;
  const path = url.split('?')[0];

  try {
    // Route: /api/db/ping (Database health check)
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
          error: error.message,
          database: 'disconnected'
        });
      }
    }

    // Route: /api/auth/config
    if (path.endsWith('/api/auth/config') && method === 'GET') {
      return res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        authEnabled: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
      });
    }

    // Route: /api/generate (POST)
    if (path.endsWith('/api/generate') && method === 'POST') {
      const { formData } = req.body as any;
      
      if (!formData) {
        return res.status(400).json({ error: 'formData is required' });
      }

      // Try pre-built profile first
      const profile = resolveProfile(
        formData.filingType || '',
        formData.jurisdiction || '',
        formData.entityType || ''
      );

      let reportHtml = '';
      
      if (profile) {
        // Generate HTML from profile
        const checklistHtml = profile.checklist.map(item => 
          `<li><strong>${item.label}:</strong> ${item.description}</li>`
        ).join('\n');
        
        reportHtml = `<h2>Filing Profile: ${profile.name}</h2>
<h3>Requirements Checklist</h3>
<ul>${checklistHtml}</ul>`;
      } else {
        // Use AI
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
            content: "You are CompliPilot, a compliance assistant. Generate professional compliance reports in HTML format with structured sections."
          }, {
            role: "user",
            content: prompt
          }],
          max_tokens: 4000,
        });

        reportHtml = completion.choices[0].message.content || '';
      }

      return res.json({ reportHtml });
    }

    // Route: /api/reports/save (POST)
    if (path.endsWith('/api/reports/save') && method === 'POST') {
      const { userId, ownerId } = getCaller(req);
      
      // Require at least one identifier
      if (!userId && !ownerId) {
        return res.status(401).json({ error: 'Authentication required. Please provide x-user-id or x-owner-id header.' });
      }

      const data = {
        ...req.body,
        userId: userId || undefined,
        ownerId: ownerId || undefined,
      };

      const validated = insertComplianceReportSchema.parse(data);
      const db = getDb();
      const [report] = await db.insert(complianceReports).values(validated).returning();
      
      return res.json(report);
    }

    // Route: /api/reports/list (GET)
    if (path.endsWith('/api/reports/list') && method === 'GET') {
      const { userId, ownerId } = getCaller(req);
      const toolkitCode = req.query.toolkit as string;

      // Require toolkit parameter
      if (!toolkitCode) {
        return res.status(400).json({ error: 'toolkit query parameter is required' });
      }

      // Require at least one identifier
      if (!userId && !ownerId) {
        return res.status(401).json({ error: 'Authentication required. Please provide x-user-id or x-owner-id header.' });
      }

      const db = getDb();
      
      // Build WHERE clause dynamically without undefined values
      const whereConditions: any[] = [eq(complianceReports.toolkitCode, toolkitCode)];
      
      // Add ownership filter
      if (userId && ownerId) {
        whereConditions.push(or(
          eq(complianceReports.userId, userId),
          eq(complianceReports.ownerId, ownerId)
        ));
      } else if (userId) {
        whereConditions.push(eq(complianceReports.userId, userId));
      } else if (ownerId) {
        whereConditions.push(eq(complianceReports.ownerId, ownerId));
      }

      const reports = await db
        .select()
        .from(complianceReports)
        .where(and(...whereConditions))
        .orderBy(desc(complianceReports.createdAt));

      return res.json(reports);
    }

    // Route: /api/reports/:id (GET)
    if (path.match(/\/api\/reports\/[^/]+$/) && method === 'GET') {
      const { userId, ownerId } = getCaller(req);
      const id = path.split('/').pop() as string;

      const db = getDb();
      const [report] = await db
        .select()
        .from(complianceReports)
        .where(eq(complianceReports.id, id));

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Verify ownership
      if (report.userId !== userId && report.ownerId !== ownerId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json(report);
    }

    // Route: /api/reports/:id (DELETE)
    if (path.match(/\/api\/reports\/[^/]+$/) && method === 'DELETE') {
      const { userId, ownerId } = getCaller(req);
      const id = path.split('/').pop() as string;

      // Require authentication
      if (!userId && !ownerId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const db = getDb();
      
      // First verify ownership
      const [report] = await db
        .select()
        .from(complianceReports)
        .where(eq(complianceReports.id, id));

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      if (report.userId !== userId && report.ownerId !== ownerId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await db.delete(complianceReports).where(eq(complianceReports.id, id));
      return res.json({ success: true });
    }

    // No route matched
    return res.status(404).json({ error: 'Not found' });

  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
