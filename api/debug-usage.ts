import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db-serverless.js';
import { usageTracking } from './_lib/schema.js';
import { eq, and } from 'drizzle-orm';

// Get client IP address from request (Vercel-optimized)
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
  
  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    return socketIp;
  }
  
  return 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const ipAddress = getClientIp(req);
    const db = getDb();
    
    // Get all usage records for this IP
    const allRecords = await db
      .select()
      .from(usageTracking)
      .where(eq(usageTracking.ipAddress, ipAddress));

    // Get headers for debugging
    const headers = {
      'x-vercel-forwarded-for': req.headers['x-vercel-forwarded-for'],
      'x-vercel-ip-address': req.headers['x-vercel-ip-address'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
    };

    return res.status(200).json({
      detectedIp: ipAddress,
      headers,
      usageRecords: allRecords,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Debug Usage] Error:', error);
    return res.status(500).json({ 
      error: 'Debug failed',
      message: error.message 
    });
  }
}
