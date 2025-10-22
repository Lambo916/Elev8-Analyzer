import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getDb } from '../db-serverless';
import { complianceReports } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Main handler for /api/reports/list
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  setCORS(res, origin);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate
    const userId = await authenticateRequest(req);

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

    return res.status(200).json(reports);

  } catch (error: any) {
    console.error('[Vercel] /api/reports/list - Error:', error);

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
