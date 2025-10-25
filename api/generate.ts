import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { resolveProfile } from './shared/filing-profiles.js';

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

// Helper: Compute timeline dates from deadline with validation
function computeTimelineDates(timeline: any[], deadline: string | null) {
  if (!deadline) {
    return timeline.map(item => ({
      milestone: item.milestone,
      owner: item.owner,
      dueDate: `T${item.offsetDays}`,
      notes: item.notes
    }));
  }
  
  // Validate deadline format
  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) {
    console.warn(`[Vercel] Invalid deadline format: ${deadline}, falling back to relative dates`);
    return timeline.map(item => ({
      milestone: item.milestone,
      owner: item.owner,
      dueDate: `T${item.offsetDays}`,
      notes: item.notes
    }));
  }
  
  return timeline.map(item => {
    const dueDate = new Date(deadlineDate);
    dueDate.setDate(dueDate.getDate() + item.offsetDays);
    
    const month = String(dueDate.getMonth() + 1).padStart(2, '0');
    const day = String(dueDate.getDate()).padStart(2, '0');
    const year = dueDate.getFullYear();
    
    return {
      milestone: item.milestone,
      owner: item.owner,
      dueDate: `${month}/${day}/${year}`,
      notes: item.notes
    };
  });
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

    const {
      entityName,
      entityType,
      jurisdiction,
      filingType,
      deadline,
      requirements = [],
      risks,
      mitigation
    } = formData;

    // Validate required fields
    if (!entityType || !filingType) {
      return res.status(400).json({
        error: "Entity type and filing type are required.",
      });
    }

    console.log('[Vercel] /api/generate - Form data:', {
      filingType,
      jurisdiction,
      entityType
    });

    // STEP 1: Try to resolve filing profile (expert knowledge base)
    const profile = resolveProfile(filingType, jurisdiction, entityType);
    const useAIMode = !profile;
    
    if (useAIMode) {
      console.log(`[Vercel] No pre-built profile found - using super smart AI mode for ${jurisdiction} ${filingType}`);
    }

    // Build user context for AI
    const userContext: string[] = [];
    if (requirements.length > 0) {
      userContext.push(`Selected requirements: ${requirements.join(', ')}`);
    }
    if (risks) {
      userContext.push(`Risk concerns: ${risks}`);
    }
    if (mitigation) {
      userContext.push(`Mitigation plan: ${mitigation}`);
    }

    // Initialize OpenAI client
    const ai = getOpenAI();

    let response;

    if (useAIMode) {
      // SUPER SMART AI MODE: Generate everything through AI
      const superSmartPrompt = `You are a professional compliance intelligence system specializing in business filing requirements across all 50 US states.

Generate a comprehensive compliance report for:
- Entity: ${entityName || '[Entity Name]'} (${entityType})
- Jurisdiction: ${jurisdiction || 'General'}
- Filing Type: ${filingType}
- Deadline: ${deadline || '[Not specified]'}
${userContext.length > 0 ? '\nUser Context:\n' + userContext.join('\n') : ''}

CRITICAL: Research and provide ACCURATE, STATE-SPECIFIC information. Do not provide generic placeholder content.

Generate a JSON object with these fields:
{
  "summary": "2-3 professional paragraphs explaining: (1) What this ${filingType} is and why it matters for ${entityName || 'this entity'} in ${jurisdiction}, (2) Specific ${jurisdiction} requirements and deadlines, (3) Real consequences of non-compliance (actual penalties, suspension risks, etc.)",
  
  "checklist": [
    "List 5-7 specific filing requirements for ${filingType} in ${jurisdiction}. Include actual form numbers, fee amounts, and state-specific documents (e.g., 'Statement of Information Form SI-550' for California LLCs, not generic placeholders)"
  ],
  
  "timeline": [
    {"milestone": "Milestone name", "owner": "Responsible party", "offsetDays": -30, "notes": "Specific action required"},
    {"milestone": "Milestone name", "owner": "Responsible party", "offsetDays": -14, "notes": "Specific action required"},
    {"milestone": "Milestone name", "owner": "Responsible party", "offsetDays": -7, "notes": "Specific action required"},
    {"milestone": "Milestone name", "owner": "Responsible party", "offsetDays": 0, "notes": "Specific action required"}
  ],
  
  "riskMatrix": [
    {"risk": "Specific compliance risk", "severity": "High|Medium|Low", "likelihood": "High|Medium|Low", "mitigation": "Specific mitigation action"},
    {"risk": "Another specific risk", "severity": "High|Medium|Low", "likelihood": "High|Medium|Low", "mitigation": "Specific mitigation action"}
  ],
  
  "recommendations": [
    "3-5 actionable recommendations specific to ${jurisdiction} ${filingType}"
  ],
  
  "references": [
    "Official ${jurisdiction} filing portal with actual URL",
    "State agency website with actual URL", 
    "Relevant government resources with actual URLs"
  ]
}

IMPORTANT: 
- Use actual ${jurisdiction} requirements, forms, fees, and portal URLs
- Timeline offsetDays are relative to deadline: negative = before, 0 = deadline day
- Include 4-6 timeline milestones covering preparation to filing
- Provide real risk assessment with actual consequences
- Return ONLY valid JSON, no explanations`;

      try {
        console.log('[Vercel] /api/generate - Calling OpenAI API (AI Mode)...');
        
        const completion = await ai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a compliance intelligence expert with deep knowledge of business filing requirements across all US states. Provide accurate, jurisdiction-specific information. Return valid JSON only."
            },
            {
              role: "user",
              content: superSmartPrompt,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 2500,
        });

        console.log('[Vercel] /api/generate - OpenAI API call completed');
        
        const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');
        
        // Compute timeline dates
        const timelineWithDates = aiResponse.timeline 
          ? computeTimelineDates(aiResponse.timeline, deadline)
          : [];

        response = {
          summary: aiResponse.summary || `This compliance report addresses the ${filingType} requirement for ${entityName || 'your business'}.`,
          checklist: aiResponse.checklist || [],
          timeline: timelineWithDates,
          riskMatrix: aiResponse.riskMatrix || [],
          recommendations: aiResponse.recommendations || ["File well before deadline", "Set calendar reminders"],
          references: aiResponse.references || []
        };

      } catch (error: any) {
        console.error('[Vercel] /api/generate - OpenAI error in AI mode:', error.message);
        console.error('[Vercel] /api/generate - Full error:', error);
        
        // Return a friendly error with details for debugging
        return res.status(500).json({ 
          error: 'Failed to generate AI report. Please try again.',
          details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
      }

    } else {
      // PROFILE-BASED MODE: Use pre-built knowledge + AI enhancement
      console.log('[Vercel] /api/generate - Using pre-built profile:', profile.name);
      
      const timelineWithDates = computeTimelineDates(profile.timeline, deadline);

      const aiPrompt = `Generate a personalized executive summary and recommendations for:

Entity: ${entityName || '[Entity Name]'} (${entityType})
Jurisdiction: ${jurisdiction || 'General'}
Filing Type: ${filingType}
Deadline: ${deadline || '[Not provided]'}
${userContext.length > 0 ? '\nUser Context:\n' + userContext.join('\n') : ''}

Generate ONLY a JSON object:
{
  "summary": "2-3 paragraphs explaining why this ${filingType} matters for ${entityName || 'this entity'}, consequences of late filing, and key compliance considerations specific to ${jurisdiction}. ${userContext.length > 0 ? 'Address user context.' : ''}",
  "recommendations": [
    "3-5 specific actionable recommendations tailored to ${entityName || 'this business'}"
  ]
}`;

      try {
        console.log('[Vercel] /api/generate - Calling OpenAI API (Profile Mode)...');
        
        const completion = await ai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a compliance expert. Return valid JSON only."
            },
            {
              role: "user",
              content: aiPrompt,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
        });

        console.log('[Vercel] /api/generate - OpenAI API call completed');
        
        const aiResponse = JSON.parse(completion.choices[0].message.content || '{"summary":"","recommendations":[]}');

        // Format profile data
        const checklistItems = profile.checklist.map(item => 
          `${item.label} - ${item.description}`
        );

        const riskItems = profile.risks.map(r => ({
          risk: r.risk,
          severity: r.severity,
          likelihood: r.likelihood,
          mitigation: r.mitigation
        }));

        const referenceLinks = profile.links.map(link => 
          `${link.label}: ${link.url}`
        );

        response = {
          summary: aiResponse.summary || `This compliance report addresses the ${filingType} requirement for ${entityName || 'your business'}.`,
          checklist: checklistItems,
          timeline: timelineWithDates,
          riskMatrix: riskItems,
          recommendations: aiResponse.recommendations && aiResponse.recommendations.length > 0 
            ? aiResponse.recommendations 
            : ["File well before deadline", "Set calendar reminders", "Consult with compliance advisor"],
          references: referenceLinks
        };

      } catch (error: any) {
        console.error('[Vercel] /api/generate - OpenAI error in profile mode:', error.message);
        console.error('[Vercel] /api/generate - Full error:', error);
        
        // Return a friendly error with details for debugging
        return res.status(500).json({ 
          error: 'Failed to generate profile-based report. Please try again.',
          details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
      }
    }

    console.log('[Vercel] /api/generate - Hybrid compliance intelligence generated successfully');

    return res.status(200).json(response);

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
