import type { VercelRequest, VercelResponse } from '@vercel/node';

const VERSION = '1.1.0-monitor-mode';
const DEPLOYED_AT = new Date().toISOString();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const enforcementEnabled = (process.env.FEATURE_USAGE_ENFORCEMENT || 'on').toLowerCase() === 'on';
  const reportCap = parseInt(process.env.REPORT_CAP || '30', 10);
  const bypassIps = process.env.BYPASS_IPS?.split(',').map(ip => ip.trim()).length || 0;

  return res.status(200).json({
    version: VERSION,
    deployedAt: DEPLOYED_AT,
    timestamp: new Date().toISOString(),
    usageLimiting: {
      mode: enforcementEnabled ? 'enforcing' : 'monitor-only',
      enforcement: enforcementEnabled,
      reportCap: reportCap,
      bypassIps: bypassIps,
      toolName: process.env.TOOL_NAME || 'elev8analyzer'
    },
    configuration: {
      publicSiteUrl: process.env.PUBLIC_SITE_URL || 'not-set',
      corsOrigins: process.env.CORS_ALLOWED_ORIGINS || 'not-set'
    },
    features: {
      lowercaseToolNames: true,
      enhancedLogging: true,
      failOpenOnError: true,
      monitorOnlyMode: !enforcementEnabled,
      bypassLists: bypassIps > 0
    },
    message: `Elev8 Analyzer v1.1 - Monitor Mode (${enforcementEnabled ? 'Enforcement ON' : 'Enforcement OFF'})`
  });
}