import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import path from "path";
import OpenAI from "openai";
import sanitizeHtml from "sanitize-html";
import { resolveProfile, type FilingProfile } from "@shared/filing-profiles";
import { db } from "./db";
import { complianceReports, insertComplianceReportSchema, type ComplianceReport, usageTracking } from "@shared/schema";
import { eq, desc, or, and, sql } from "drizzle-orm";
import { getUserId, hasAccess, requireAuth } from "./auth";

// Get anonymous user ID from browser-provided client ID
function getAnonymousUserId(req: Request): string {
  const clientId = req.headers['x-client-id'] as string;
  if (!clientId) {
    throw new Error('X-Client-Id header is required');
  }
  return `anon_${clientId}`;
}

// Sanitize HTML content to prevent XSS
function sanitizeHtmlContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'class'],
    },
  });
}

// Get client IP address from request (30-report cap enforcement)
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  
  return typeof ip === 'string' ? ip.trim() : 'unknown';
}

// Check usage limit (read-only check before generation)
async function checkUsageLimit(req: Request): Promise<{ allowed: boolean; count: number }> {
  try {
    const ipAddress = getClientIp(req);
    
    if (ipAddress === 'unknown') {
      console.error('[Usage] Unable to determine client IP - blocking request for security');
      return { allowed: false, count: 30 }; // Treat as limit reached to block generation
    }

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
async function incrementUsage(req: Request): Promise<{ success: boolean; count: number; limitReached?: boolean }> {
  try {
    const ipAddress = getClientIp(req);
    
    if (ipAddress === 'unknown') {
      console.error('[Usage] Unable to determine client IP - failing increment for security');
      return { success: false, count: 30, limitReached: true }; // Fail closed to prevent bypass
    }

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from public folder
  app.use(express.static(path.join(process.cwd(), "public")));
  
  // Database health check endpoint
  app.get("/api/db/ping", async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT 1 as ping`);
      res.json({ 
        ok: true, 
        result: result.rows[0],
        database: 'connected'
      });
    } catch (error: any) {
      console.error("Database health check failed:", error);
      res.status(500).json({ 
        ok: false, 
        error: error.message,
        database: 'disconnected'
      });
    }
  });

  // Auth config endpoint (public)
  app.get("/api/auth/config", (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseAnonKey) {
      res.json({
        supabaseUrl,
        supabaseAnonKey,
        authEnabled: true
      });
    } else {
      res.json({
        authEnabled: false,
        message: "Authentication service not configured"
      });
    }
  });
  
  // Initialize OpenAI client
  const rawApiKey = process.env.OPENAI_API_KEY;
  if (!rawApiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
  
  // Clean the API key - remove all whitespace and newlines
  const apiKey = rawApiKey.replace(/\s+/g, '').trim();
  
  
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  // GrantGenie compliance system prompt template
  const getComplianceSystemPrompt = () => {
    return `You are GrantGenie, an expert compliance assistant with AI-powered assistance.

Your role is to generate professional, submission-ready compliance documents that help businesses navigate regulatory requirements with confidence.

CRITICAL FORMATTING RULES:
1. ALWAYS structure your response with these exact 5 sections using markdown headings:
   # Executive Compliance Summary
   ## Filing Requirements Checklist
   ## Compliance Roadmap
   ## Risk Matrix
   ## Next Steps & Recommendations

2. Format each section as follows:
   - Executive Summary: Write 1-2 clear, professional paragraphs (120-150 words)
   - Filing Requirements: Use bulleted list with ✓ symbols for each requirement
   - Compliance Roadmap: Create a markdown table with columns: Phase | Task | Deadline
   - Risk Matrix: Create a markdown table with columns: Risk | Consequence | Mitigation
   - Next Steps: Use numbered list (1., 2., 3., etc.) with specific, actionable items

3. PLACEHOLDER HANDLING:
   - If information is missing, insert clean placeholders like [Pending Input] or [ADD DATE]
   - NEVER leave blank sections or break table structure
   - For empty Risk Matrix, include at least one row: "[Pending Input] | [Pending Input] | [Pending Input]"

4. WRITING STYLE:
   - Use plain English, avoid legalese
   - Be specific and actionable
   - Do NOT invent deadlines, legal codes, or specific regulations you're unsure about
   - Do NOT use ALL-CAPS text (except for proper acronyms like LLC, EIN, BOIR)
   - Maintain professional tone throughout

5. TABLE FORMATTING:
   - Always use proper markdown table syntax with | separators
   - Include header row with column names
   - Include separator row with dashes
   - Add at least 2-3 data rows (use placeholders if needed)
   
REMEMBER: Consistency and structure are critical. Every document must have all 5 sections in the exact format specified.`;
  };

  // Elev8 Analyzer diagnostic system prompt template (SCAFFOLD)
  const getDiagnosticSystemPrompt = () => {
    return `You are Elev8 Analyzer, an expert business diagnostic assistant powered by GrantGenie.

Your role is to generate professional strategic analysis reports that help businesses identify opportunities, address challenges, and elevate their operations.

CRITICAL FORMATTING RULES:
1. ALWAYS structure your response with these exact 4 sections using markdown headings:
   # Executive Summary
   ## SWOT Analysis
   ## Risk & Opportunity Matrix
   ## Strategic Recommendations

2. Format each section as follows:
   - Executive Summary: Write 2-3 clear, insightful paragraphs (150-200 words) analyzing the business profile
   - SWOT Analysis: Create a markdown table with 4 columns: Strengths | Weaknesses | Opportunities | Threats
   - Risk & Opportunity Matrix: Create a markdown table with 3 columns: Factor | Impact Level | Action Priority
   - Strategic Recommendations: Use numbered list (1., 2., 3., etc.) with specific, actionable items

3. PLACEHOLDER HANDLING:
   - If business information is missing, insert clean placeholders like [Pending Input] or [AWAITING DATA]
   - NEVER leave blank sections or break table structure
   - For incomplete matrices, include at least one placeholder row

4. WRITING STYLE:
   - Use clear business language, avoid unnecessary jargon
   - Be strategic and forward-looking
   - Ground insights in the provided business data
   - Focus on actionable intelligence
   - Maintain professional consultant tone throughout

5. TABLE FORMATTING:
   - Always use proper markdown table syntax with | separators
   - Include header row with column names
   - Include separator row with dashes
   - Add at least 3-4 data rows per table (use placeholders if needed)
   
REMEMBER: Your analysis should be data-driven yet strategic, helping business owners make informed decisions.`;
  };

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
      console.warn(`Invalid deadline format: ${deadline}, falling back to relative dates`);
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

  // API endpoint for generating structured compliance data (HYBRID APPROACH)
  app.post("/api/generate", async (req, res) => {
    // Check 30-report usage limit BEFORE generation (soft launch protection)
    const usageCheck = await checkUsageLimit(req);
    if (!usageCheck.allowed) {
      console.log(`[Express] /api/generate - Request blocked: usage limit reached (${usageCheck.count}/30)`);
      return res.status(429).json({
        error: 'You have reached your 30-report limit for the CompliPilot soft launch. Please upgrade to continue.',
        limitReached: true,
        count: usageCheck.count,
        limit: 30
      });
    }

    const { formData } = req.body;
    
    try {
      console.log(`[Express] /api/generate - Starting report generation (usage: ${usageCheck.count}/30)`);
      
      // Input validation
      if (!formData) {
        return res.status(400).json({
          error: "Form data is required.",
        });
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

      console.log(`Generating hybrid compliance intelligence for: ${filingType} - ${entityType} (${jurisdiction || 'General'})`);

      // STEP 1: Try to resolve filing profile (expert knowledge base)
      // If no profile exists, fall back to super smart AI mode
      const profile = resolveProfile(filingType, jurisdiction, entityType);
      const useAIMode = !profile;
      
      if (useAIMode) {
        console.log(`No pre-built profile found - using super smart AI mode for ${jurisdiction} ${filingType}`);
      }

      // Build user context for AI
      const userContext = [];
      if (requirements.length > 0) {
        userContext.push(`Selected requirements: ${requirements.join(', ')}`);
      }
      if (risks) {
        userContext.push(`Risk concerns: ${risks}`);
      }
      if (mitigation) {
        userContext.push(`Mitigation plan: ${mitigation}`);
      }

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

        const completion = await openai.chat.completions.create({
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

      } else {
        // PROFILE-BASED MODE: Use pre-built knowledge + AI enhancement
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

        const completion = await openai.chat.completions.create({
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
      }

      console.log("Hybrid compliance intelligence generated successfully");

      // Increment usage counter AFTER successful generation (atomic operation with limit enforcement)
      const incrementResult = await incrementUsage(req);
      
      // If increment failed due to limit (race condition), reject the request
      if (!incrementResult.success && incrementResult.limitReached) {
        console.log(`[Express] /api/generate - Request completed but limit reached during increment: ${incrementResult.count}/30`);
        return res.status(429).json({
          error: 'You have reached your 30-report limit for the CompliPilot soft launch. Please upgrade to continue.',
          limitReached: true,
          count: incrementResult.count,
          limit: 30
        });
      }

      res.json(response);
    } catch (error: any) {
      console.error("Error in /api/generate:", error);

      // Handle specific OpenAI errors
      if (error.code === "insufficient_quota") {
        return res.status(503).json({
          error: "Service temporarily unavailable. Please try again later.",
        });
      }

      if (error.status === 429) {
        return res.status(429).json({
          error: "Too many requests. Please wait a moment and try again.",
        });
      }

      if (error.status === 401) {
        return res.status(401).json({
          error: "Authentication failed. Please check API configuration.",
        });
      }

      // Generic error response
      res.status(500).json({
        error: "An unexpected error occurred. Please try again.",
      });
    }
  });

  // Save a compliance report (uses browser client ID)
  app.post("/api/reports/save", async (req, res) => {
    try {
      // Get anonymous user ID from browser client ID
      let userId;
      try {
        userId = getAnonymousUserId(req);
      } catch (error: any) {
        if (error.message === 'X-Client-Id header is required') {
          return res.status(400).json({ error: 'X-Client-Id header is required' });
        }
        throw error;
      }
      
      const reportData = insertComplianceReportSchema.parse(req.body);
      
      // Sanitize HTML content before saving
      const sanitizedData = {
        ...reportData,
        htmlContent: sanitizeHtmlContent(reportData.htmlContent),
        userId: userId, // Force ownership to authenticated user
        ownerId: '', // Clear legacy ownerId field
      };
      
      const [savedReport] = await db
        .insert(complianceReports)
        .values(sanitizedData)
        .returning();

      res.json(savedReport);
    } catch (error: any) {
      console.error("Error saving report:", error);
      
      // Production-safe error response
      if (process.env.NODE_ENV === 'production') {
        res.status(400).json({
          error: "Failed to save report. Please try again.",
        });
      } else {
        res.status(400).json({
          error: "Failed to save report. Please check your input.",
          details: error.message,
        });
      }
    }
  });

  // List all saved reports (filtered by toolkit and ownership) - uses browser client ID
  app.get("/api/reports/list", async (req, res) => {
    try {
      // Get anonymous user ID from browser client ID
      let userId;
      try {
        userId = getAnonymousUserId(req);
      } catch (error: any) {
        if (error.message === 'X-Client-Id header is required') {
          return res.status(400).json({ error: 'X-Client-Id header is required' });
        }
        throw error;
      }

      const toolkit = req.query.toolkit as string;
      if (!toolkit) {
        return res.status(400).json({
          error: "toolkit query parameter is required",
        });
      }

      // Filter by authenticated user's ID only
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
          eq(complianceReports.toolkitCode, toolkit),
          eq(complianceReports.userId, userId)
        ))
        .orderBy(desc(complianceReports.createdAt));

      res.json(reports);
    } catch (error: any) {
      console.error("Error listing reports:", error);
      
      // Production-safe error response
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({
          error: "Failed to retrieve reports. Please try again.",
        });
      } else {
        res.status(500).json({
          error: "Failed to retrieve reports.",
          details: error.message,
        });
      }
    }
  });

  // Get a specific report by ID (with ownership validation) - uses browser client ID
  app.get("/api/reports/:id", async (req, res) => {
    try {
      // Get anonymous user ID from browser client ID
      let userId;
      try {
        userId = getAnonymousUserId(req);
      } catch (error: any) {
        if (error.message === 'X-Client-Id header is required') {
          return res.status(400).json({ error: 'X-Client-Id header is required' });
        }
        throw error;
      }

      const { id } = req.params;
      
      const [report] = await db
        .select()
        .from(complianceReports)
        .where(and(
          eq(complianceReports.id, id),
          eq(complianceReports.userId, userId) // Enforce ownership
        ));

      if (!report) {
        return res.status(404).json({
          error: "Report not found.",
        });
      }

      res.json(report);
    } catch (error: any) {
      console.error("Error retrieving report:", error);
      
      // Production-safe error response
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({
          error: "Failed to retrieve report. Please try again.",
        });
      } else {
        res.status(500).json({
          error: "Failed to retrieve report.",
          details: error.message,
        });
      }
    }
  });

  // Delete a specific report by ID (with ownership validation) - uses browser client ID
  app.delete("/api/reports/:id", async (req, res) => {
    try {
      // Get anonymous user ID from browser client ID
      let userId;
      try {
        userId = getAnonymousUserId(req);
      } catch (error: any) {
        if (error.message === 'X-Client-Id header is required') {
          return res.status(400).json({ error: 'X-Client-Id header is required' });
        }
        throw error;
      }

      const { id } = req.params;
      
      // Delete only if owned by the authenticated user
      const result = await db
        .delete(complianceReports)
        .where(and(
          eq(complianceReports.id, id),
          eq(complianceReports.userId, userId) // Enforce ownership
        ))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({
          error: "Report not found or access denied.",
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting report:", error);
      
      // Production-safe error response
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({
          error: "Failed to delete report. Please try again.",
        });
      } else {
        res.status(500).json({
          error: "Failed to delete report.",
          details: error.message,
        });
      }
    }
  });

  // Stub endpoint for merging guest owner to authenticated user (future feature)
  app.post("/api/merge-owner", async (req, res) => {
    try {
      const { owner_id } = req.body;
      
      // No-op for now - will implement when authentication is added
      // This will merge reports from owner_id to the authenticated user's userId
      
      res.json({ success: true, message: "Merge endpoint ready for future auth implementation" });
    } catch (error: any) {
      console.error("Error in merge-owner:", error);
      res.status(500).json({
        error: "Merge operation failed.",
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
