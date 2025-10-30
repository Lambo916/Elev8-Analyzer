import type { VercelRequest, VercelResponse } from '@vercel/node';

// Get client IP address from request (Vercel-optimized with diagnostics)
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

// IP detection test endpoint (for troubleshooting Vercel deployments)
export default function handler(req: VercelRequest, res: VercelResponse) {
  const detectedIp = getClientIp(req);
  
  res.json({
    detectedIp,
    headers: {
      'x-vercel-forwarded-for': req.headers['x-vercel-forwarded-for'] || null,
      'x-vercel-ip-address': req.headers['x-vercel-ip-address'] || null,
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'x-real-ip': req.headers['x-real-ip'] || null,
      'socket.remoteAddress': req.socket?.remoteAddress || null,
    },
    isUnknown: detectedIp === 'unknown',
    timestamp: new Date().toISOString()
  });
}
