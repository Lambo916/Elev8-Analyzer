import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db-serverless.js';
import { usageTracking } from './_lib/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// Get client IP address from request
function getClientIp(req: VercelRequest): string {
  const vercelIp = req.headers['x-vercel-forwarded-for'] || req.headers['x-vercel-ip-address'];
  if (vercelIp) {
    return typeof vercelIp === 'string' ? vercelIp.split(',')[0].trim() : String(vercelIp).trim();
  }
  
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : String(forwarded[0]).trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp.trim() : String(realIp).trim();
  }
  
  return req.socket?.remoteAddress || 'unknown';
}

// Normalize tool parameter
function normalizeTool(tool: any): string {
  return String(tool || 'elev8analyzer').toLowerCase().trim();
}

// Helper for CORS
function setCORS(res: VercelResponse, origin: string | undefined) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const allowedOrigins = [
    'https://analyzer.yourbizguru.com',
    'https://www.yourbizguru.com',
    /https:\/\/.*\.vercel\.app$/,
    /https:\/\/.*\.replit\.dev$/,
  ];

  if (isDevelopment && origin?.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Get report cap from environment
function getReportCap(): number {
  const cap = parseInt(process.env.REPORT_CAP || '30', 10);
  return isNaN(cap) ? 30 : cap;
}

// Check if enforcement is enabled
function isEnforcementEnabled(): boolean {
  const enforcement = process.env.FEATURE_USAGE_ENFORCEMENT || 'on';
  return enforcement.toLowerCase() === 'on';
}

// Main handler for /api/usage (combines check and increment)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  setCORS(res, origin);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const action = req.query.action as string || 'check';
    const ipAddress = getClientIp(req);
    
    if (ipAddress === 'unknown') {
      return res.status(400).json({ error: 'Unable to determine client IP address' });
    }

    const tool = normalizeTool(req.query.tool || req.body?.tool);
    const reportCap = getReportCap();
    const enforcementEnabled = isEnforcementEnabled();

    const db = getDb();

    // Handle CHECK action
    if (action === 'check' || req.method === 'GET') {
      const usageRecord = await db
        .select()
        .from(usageTracking)
        .where(and(
          eq(usageTracking.ipAddress, ipAddress),
          eq(usageTracking.tool, tool)
        ))
        .limit(1);

      const reportCount = usageRecord.length > 0 ? usageRecord[0].reportCount : 0;
      const hasReachedLimit = reportCount >= reportCap;

      return res.status(200).json({
        reportCount,
        hasReachedLimit: enforcementEnabled && hasReachedLimit,
        limit: reportCap,
        tool,
        mode: enforcementEnabled ? 'enforcing' : 'monitor-only'
      });
    }

    // Handle INCREMENT action
    if (action === 'increment' || req.method === 'POST') {
      // In monitor-only mode, always increment (no cap enforcement)
      // In enforcing mode, only increment if below cap
      const whereConditions = enforcementEnabled
        ? and(
            eq(usageTracking.ipAddress, ipAddress),
            eq(usageTracking.tool, tool),
            sql`${usageTracking.reportCount} < ${reportCap}`
          )
        : and(
            eq(usageTracking.ipAddress, ipAddress),
            eq(usageTracking.tool, tool)
          );
      
      // Atomic increment
      const updated = await db
        .update(usageTracking)
        .set({
          reportCount: sql`${usageTracking.reportCount} + 1`,
          lastUpdated: new Date(),
        })
        .where(whereConditions)
        .returning();

      if (updated.length > 0) {
        const newCount = updated[0].reportCount;
        return res.status(200).json({
          success: true,
          reportCount: newCount,
          limit: reportCap,
          tool,
          mode: enforcementEnabled ? 'enforcing' : 'monitor-only'
        });
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
        const currentCount = existing[0].reportCount;
        
        if (enforcementEnabled && currentCount >= reportCap) {
          return res.status(429).json({
            success: false,
            error: 'Usage limit reached',
            reportCount: currentCount,
            limit: reportCap,
            tool
          });
        }
        
        // Monitor-only mode: return success even if at cap
        return res.status(200).json({
          success: true,
          reportCount: currentCount,
          limit: reportCap,
          tool,
          mode: 'monitor-only'
        });
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
      
      return res.status(200).json({
        success: true,
        reportCount: inserted[0].reportCount,
        limit: reportCap,
        tool,
        mode: enforcementEnabled ? 'enforcing' : 'monitor-only'
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error: any) {
    console.error('[Vercel] /api/usage - Error:', error);
    
    return res.status(500).json({ 
      error: 'Something went wrong. Please try again later.',
      ...(process.env.NODE_ENV !== 'production' && { debug: error.message })
    });
  }
}
