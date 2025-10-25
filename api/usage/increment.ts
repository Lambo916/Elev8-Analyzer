import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/db-serverless.js';
import { usageTracking } from '../_lib/schema.js';
import { eq, sql } from 'drizzle-orm';

// Get client IP address from request
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  
  return typeof ip === 'string' ? ip.trim() : 'unknown';
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

  res.setHeader('Access-Control-Allow-Origin', allowOrigin && origin ? origin : 'https://compli.yourbizguru.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Main handler for /api/usage/increment
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
    const ipAddress = getClientIp(req);
    
    if (ipAddress === 'unknown') {
      return res.status(400).json({ error: 'Unable to determine client IP address' });
    }

    const db = getDb();
    
    // Check if usage record exists for this IP
    const existingRecord = await db
      .select()
      .from(usageTracking)
      .where(eq(usageTracking.ipAddress, ipAddress))
      .limit(1);

    let newCount: number;

    if (existingRecord.length > 0) {
      // Check if already at limit
      if (existingRecord[0].reportCount >= 30) {
        console.log(`[Usage Increment] IP ${ipAddress} already at limit: ${existingRecord[0].reportCount}/30`);
        return res.status(429).json({
          reportCount: existingRecord[0].reportCount,
          hasReachedLimit: true,
          limit: 30,
          error: 'Usage limit already reached'
        });
      }
      
      // Update existing record
      const updated = await db
        .update(usageTracking)
        .set({
          reportCount: sql`${usageTracking.reportCount} + 1`,
          lastUpdated: new Date(),
        })
        .where(eq(usageTracking.ipAddress, ipAddress))
        .returning();
      
      newCount = updated[0].reportCount;
    } else {
      // Create new record
      const inserted = await db
        .insert(usageTracking)
        .values({
          ipAddress,
          reportCount: 1,
        })
        .returning();
      
      newCount = inserted[0].reportCount;
    }

    const hasReachedLimit = newCount >= 30;

    console.log(`[Usage Tracking] IP: ${ipAddress}, Count: ${newCount}, Limit Reached: ${hasReachedLimit}`);

    return res.status(200).json({
      reportCount: newCount,
      hasReachedLimit,
      limit: 30
    });

  } catch (error: any) {
    console.error('[Vercel] /api/usage/increment - Error:', error);
    
    return res.status(500).json({ 
      error: 'Something went wrong. Please try again later.',
      ...(process.env.NODE_ENV !== 'production' && { debug: error.message })
    });
  }
}
