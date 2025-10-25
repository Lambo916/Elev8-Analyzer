import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { resolveProfile } from './_lib/filing-profiles.js';
import { getDb } from './_lib/db-serverless.js';
import { usageTracking } from './_lib/schema.js';
import { eq, sql } from 'drizzle-orm';

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

// Get client IP address from request
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  
  return typeof ip === 'string' ? ip.trim() : 'unknown';
}

// Check usage limit (read-only check before generation)
async function checkUsageLimit(req: VercelRequest): Promise<{ allowed: boolean; count: number }> {
  try {
    const ipAddress = getClientIp(req);
    
    if (ipAddress === 'unknown') {
      console.error('[Usage] Unable to determine client IP - blocking request for security');
      return { allowed: false, count: 30 }; // Treat as limit reached to block generation
    }

    const db = getDb();
    
    // Check current usage
    const existing = await db
      .select()
      .from(usageTracking)
      .where(eq(usageTracking.ipAddress, ipAddress))
      .limit(1);

    const currentCount = existing.length > 0 ? existing[0].reportCount : 0;

    // Check against 30-report limit
    if (currentCount >= 30) {
      console.log(`[Usage] IP ${ipAddress} has reached limit: ${currentCount}/30`);
      return { allowed: false, count: currentCount };
    }

    console.log(`[Usage] IP ${ipAddress} current usage: ${currentCount}/30`);
    return { allowed: true, count: currentCount };
  } catch (error) {
    console.error('[Usage] Check error:', error);
    // Fail open for soft launch - allow generation if usage tracking fails
    return { allowed: true, count: 0 };
  }
}

// Increment usage after successful generation (atomic with limit enforcement)
async function incrementUsage(req: VercelRequest): Promise<{ success: boolean; count: number; limitReached?: boolean }> {
  try {
    const ipAddress = getClientIp(req);
    
    if (ipAddress === 'unknown') {
      console.error('[Usage] Unable to determine client IP - failing increment for security');
      return { success: false, count: 30, limitReached: true }; // Fail closed to prevent bypass
    }

    const db = getDb();
    
    // Atomic increment with strict limit enforcement
    // Only increments if count < 30 (prevents race conditions)
    const updated = await db
      .update(usageTracking)
      .set({
        reportCount: sql`${usageTracking.reportCount} + 1`,
        lastUpdated: new Date(),
      })
      .where(sql`${usageTracking.ipAddress} = ${ipAddress} AND ${usageTracking.reportCount} < 30`)
      .returning();

    if (updated.length > 0) {
      // Successfully incremented
      console.log(`[Usage] IP ${ipAddress} incremented to ${updated[0].reportCount}/30`);
      return { success: true, count: updated[0].reportCount };
    }

    // No rows updated - either doesn't exist or already at limit
    const existing = await db
      .select()
      .from(usageTracking)
      .where(eq(usageTracking.ipAddress, ipAddress))
      .limit(1);

    if (existing.length > 0) {
      // Record exists and is at/over limit
      console.log(`[Usage] IP ${ipAddress} already at limit: ${existing[0].reportCount}/30`);
      return { success: false, count: existing[0].reportCount, limitReached: true };
    }

    // First report for this IP - insert with count 1
    const inserted = await db
      .insert(usageTracking)
      .values({
        ipAddress,
        reportCount: 1,
      })
      .returning();
    
    console.log(`[Usage] IP ${ipAddress} first report: 1/30`);
    return { success: true, count: inserted[0].reportCount };
  } catch (error) {
    console.error('[Usage] Increment error - CRITICAL:', error);
    // Return error state to prevent uncounted report delivery
    return { success: false, count: 0, limitReached: true };
  }
}

// Helper for CORS (production-locked with development support)
function setCORS(res: VercelResponse, origin: string | undefined) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const allowedOrigins = [
    'https://grant.yourbizguru.com',
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

  res.setHeader('Access-Control-Allow-Origin', allowOrigin && origin ? origin : 'https://grant.yourbizguru.com');
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

  // Check 30-report usage limit BEFORE generation (soft launch protection)
  const usageCheck = await checkUsageLimit(req);
  if (!usageCheck.allowed) {
    console.log(`[Vercel] /api/generate - Request blocked: usage limit reached (${usageCheck.count}/30)`);
    return res.status(429).json({
      error: 'You have reached your 30-report limit for the GrantGenie soft launch. Please upgrade to continue.',
      limitReached: true,
      count: usageCheck.count,
      limit: 30
    });
  }

  try {
    console.log(`[Vercel] /api/generate - Starting report generation (usage: ${usageCheck.count}/30)`);
    
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

    // Increment usage counter AFTER successful generation (atomic operation with limit enforcement)
    const incrementResult = await incrementUsage(req);
    
    // If increment failed due to limit (race condition), reject the request
    if (!incrementResult.success && incrementResult.limitReached) {
      console.log(`[Vercel] /api/generate - Request completed but limit reached during increment: ${incrementResult.count}/30`);
      return res.status(429).json({
        error: 'You have reached your 30-report limit for the GrantGenie soft launch. Please upgrade to continue.',
        limitReached: true,
        count: incrementResult.count,
        limit: 30
      });
    }

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
