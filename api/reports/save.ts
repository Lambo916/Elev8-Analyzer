import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import sanitizeHtml from 'sanitize-html';
import { getDb } from '../db-serverless';
import { complianceReports, insertComplianceReportSchema } from '../shared/schema';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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

// Authenticate request and extract user ID
async function authenticateRequest(req: VercelRequest): Promise<string> {
  const authHeader = req.headers.authorization as string;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  if (!supabase) {
    throw new Error('AUTH_SERVICE_UNAVAILABLE');
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('UNAUTHORIZED');
  }

  return user.id;
}

// Helper for CORS
function setCORS(res: VercelResponse, origin: string | undefined) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const allowedOrigins = [
    'https://compli.yourbizguru.com',
    /https:\/\/.*\.vercel\.app$/,
    /https:\/\/.*\.replit\.dev$/,
  ];

  if (isDevelopment && origin?.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

  res.setHeader('Access-Control-Allow-Origin', allowOrigin && origin ? origin : 'https://compli.yourbizguru.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Main handler for /api/reports/save
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  setCORS(res, origin);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate
    const userId = await authenticateRequest(req);

    const body = req.body as any;

    // Validate input
    const validation = insertComplianceReportSchema.safeParse(body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error.errors 
      });
    }

    const data = validation.data;

    // Sanitize HTML content
    const sanitizedHtml = sanitizeHtmlContent(data.htmlContent);

    // Generate checksum for duplicate detection
    const checksum = crypto
      .createHash('md5')
      .update(`${data.entityName}-${data.jurisdiction}-${data.filingType}`)
      .digest('hex');

    const db = getDb();
    
    const [newReport] = await db
      .insert(complianceReports)
      .values({
        userId,
        toolkitCode: data.toolkitCode || 'complipilot',
        name: data.name,
        entityName: data.entityName,
        entityType: data.entityType,
        jurisdiction: data.jurisdiction,
        filingType: data.filingType,
        deadline: data.deadline,
        htmlContent: sanitizedHtml,
        checksum,
        ownerId: data.ownerId || '',
        metadata: data.metadata || {},
      })
      .returning();

    return res.status(200).json(newReport);

  } catch (error: any) {
    console.error('[Vercel] /api/reports/save - Error:', error);

    if (error.message === 'UNAUTHORIZED') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (error.message === 'AUTH_SERVICE_UNAVAILABLE') {
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
    
    return res.status(500).json({ 
      error: 'Something went wrong. Please try again later.' 
    });
  }
}
