import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { db } from '../server/db';
import OpenAI from 'openai';
import { resolveProfile } from '../shared/filing-profiles';
import { complianceReports, insertComplianceReportSchema } from '../shared/schema';
import { eq, desc, or, and } from 'drizzle-orm';

// Create Express app for API routes
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function
function getCaller(req: any) {
  const userId = req.user?.id || null;
  const ownerId = req.headers['x-owner-id'] as string || null;
  return { ownerId, userId };
}

// Auth config endpoint
app.get('/api/auth/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    authEnabled: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  });
});

// Generate compliance report endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { formData } = req.body;
    
    // Try to resolve a pre-built filing profile
    const profile = resolveProfile(
      formData.filingType || '',
      formData.jurisdiction || '',
      formData.entityType || ''
    );

    let reportHtml = '';
    
    if (profile) {
      // Generate HTML from structured profile data
      const checklistHtml = profile.checklist.map(item => 
        `<li><strong>${item.label}:</strong> ${item.description}</li>`
      ).join('\n');
      
      reportHtml = `<h2>Filing Profile: ${profile.name}</h2>
<h3>Requirements Checklist</h3>
<ul>${checklistHtml}</ul>`;
    } else {
      // Use AI to generate report
      const prompt = `Generate a compliance report for:
Entity: ${formData.entityName}
Type: ${formData.entityType}
Jurisdiction: ${formData.jurisdiction}
Filing Type: ${formData.filingType}
Deadline: ${formData.deadline || 'Not specified'}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "system",
          content: "You are CompliPilot, a compliance assistant. Generate professional compliance reports in HTML format."
        }, {
          role: "user",
          content: prompt
        }],
        max_tokens: 4000,
      });

      reportHtml = completion.choices[0].message.content || '';
    }

    res.json({ reportHtml });
  } catch (error: any) {
    console.error('Generate error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

// Save report endpoint
app.post('/api/reports/save', async (req, res) => {
  try {
    const { ownerId, userId } = getCaller(req);
    const data = {
      ...req.body,
      userId: userId || undefined,
      ownerId: ownerId || undefined,
    };

    const validated = insertComplianceReportSchema.parse(data);
    const [report] = await db.insert(complianceReports).values(validated).returning();
    
    res.json(report);
  } catch (error: any) {
    console.error('Save error:', error);
    res.status(500).json({ error: error.message || 'Failed to save report' });
  }
});

// List reports endpoint
app.get('/api/reports/list', async (req, res) => {
  try {
    const { ownerId, userId } = getCaller(req);
    const toolkitCode = req.query.toolkit as string;

    const where = and(
      toolkitCode ? eq(complianceReports.toolkitCode, toolkitCode) : undefined,
      or(
        userId ? eq(complianceReports.userId, userId) : undefined,
        ownerId ? eq(complianceReports.ownerId, ownerId) : undefined
      )
    );

    const reports = await db
      .select()
      .from(complianceReports)
      .where(where)
      .orderBy(desc(complianceReports.createdAt));

    res.json(reports);
  } catch (error: any) {
    console.error('List error:', error);
    res.status(500).json({ error: error.message || 'Failed to list reports' });
  }
});

// Get report by ID
app.get('/api/reports/:id', async (req, res) => {
  try {
    const { ownerId, userId } = getCaller(req);
    const id = req.params.id;

    const [report] = await db
      .select()
      .from(complianceReports)
      .where(eq(complianceReports.id, id));

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error: any) {
    console.error('Get report error:', error);
    res.status(500).json({ error: error.message || 'Failed to get report' });
  }
});

// Delete report by ID  
app.delete('/api/reports/:id', async (req, res) => {
  try {
    const { ownerId, userId } = getCaller(req);
    const id = req.params.id;

    await db.delete(complianceReports).where(eq(complianceReports.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete report' });
  }
});

// Export Vercel handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return new Promise((resolve, reject) => {
    app(req as any, res as any, (err: any) => {
      if (err) reject(err);
      else resolve(undefined);
    });
  });
}
