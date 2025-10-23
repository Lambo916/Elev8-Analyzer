import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { resolveProfile } from './shared/filing-profiles';

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

// Helper for CORS (production-locked with development support)
function setCORS(res: VercelResponse, origin: string | undefined) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const allowedOrigins = [
    'https://compli.yourbizguru.com',
    /https:\/\/.*\.vercel\.app$/,
    /https:\/\/.*\.replit\.dev$/,
  ];

  // In development, also allow localhost
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

// Main handler for /api/generate
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  setCORS(res, origin);

  // Always set JSON content type
  res.setHeader('Content-Type', 'application/json');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[Vercel] /api/generate - Starting report generation');
    
    const { formData } = req.body as any;
    
    if (!formData) {
      console.error('[Vercel] /api/generate - Missing formData');
      return res.status(400).json({ error: 'formData is required' });
    }

    console.log('[Vercel] /api/generate - Form data:', {
      filingType: formData.filingType,
      jurisdiction: formData.jurisdiction,
      entityType: formData.entityType
    });

    // Try pre-built profile first
    const profile = resolveProfile(
      formData.filingType || '',
      formData.jurisdiction || '',
      formData.entityType || ''
    );

    let reportHtml = '';
    
    if (profile) {
      console.log('[Vercel] /api/generate - Using pre-built profile:', profile.name);
      
      // Generate HTML from profile
      const checklistHtml = profile.checklist.map(item => 
        `<li><strong>${item.label}:</strong> ${item.description}</li>`
      ).join('\n');
      
      reportHtml = `<h2>Filing Profile: ${profile.name}</h2>
<h3>Requirements Checklist</h3>
<ul>${checklistHtml}</ul>`;
    } else {
      console.log('[Vercel] /api/generate - Using OpenAI for report generation');
      
      try {
        const ai = getOpenAI();
        const prompt = `Generate a compliance report for:
Entity: ${formData.entityName}
Type: ${formData.entityType}
Jurisdiction: ${formData.jurisdiction}
Filing Type: ${formData.filingType}
Deadline: ${formData.deadline || 'Not specified'}`;

        console.log('[Vercel] /api/generate - Calling OpenAI API...');
        
        // Add timeout protection for OpenAI call (9 seconds to be safe)
        const completion = await Promise.race([
          ai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
              role: "system",
              content: "You are CompliPilot, a compliance assistant. Generate professional compliance reports in HTML format with structured sections."
            }, {
              role: "user",
              content: prompt
            }],
            max_tokens: 4000,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OpenAI API timeout')), 9000)
          )
        ]) as any;

        console.log('[Vercel] /api/generate - OpenAI API call completed');
        reportHtml = completion.choices[0].message.content || '';
      } catch (error: any) {
        console.error('[Vercel] /api/generate - OpenAI error:', error.message);
        
        // Return a friendly error instead of crashing
        return res.status(500).json({ 
          error: 'Failed to generate report. Please try again.',
          details: error.message 
        });
      }
    }

    console.log('[Vercel] /api/generate - Report generated successfully');
    return res.status(200).json({ reportHtml });

  } catch (error: any) {
    console.error('[Vercel] /api/generate - Error:', error);
    console.error('[Vercel] /api/generate - Stack:', error.stack);
    
    // ALWAYS return JSON, never let Vercel show HTML error page
    try {
      return res.status(500).json({ 
        error: 'Something went wrong. Please try again later.',
        ...(process.env.NODE_ENV !== 'production' && { 
          debug: error.message,
          stack: error.stack 
        })
      });
    } catch (jsonError) {
      // Last resort: if JSON serialization fails, send plain text JSON
      res.status(500).send(JSON.stringify({ 
        error: 'Internal server error' 
      }));
    }
  }
}
