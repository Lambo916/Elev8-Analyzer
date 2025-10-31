import type { VercelRequest, VercelResponse } from '@vercel/node';

const VERSION = '1.1.0-fix-usage-limit';
const DEPLOYED_AT = new Date().toISOString();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    version: VERSION,
    deployedAt: DEPLOYED_AT,
    timestamp: new Date().toISOString(),
    features: {
      lowercaseToolNames: true,
      enhancedLogging: true,
      failOpenOnError: true,
      emergencyBypass: process.env.DISABLE_USAGE_LIMITS === 'true'
    },
    message: 'Elev8 Analyzer v1.1 - Usage limit fix deployed'
  });
}