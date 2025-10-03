import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import path from "path";
import OpenAI from "openai";
import { resolveProfile, type FilingProfile } from "@shared/filing-profiles";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from public folder
  app.use(express.static(path.join(process.cwd(), "public")));
  
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

  // CompliPilot compliance system prompt template
  const getComplianceSystemPrompt = () => {
    return `You are CompliPilot, an expert compliance assistant powered by YourBizGuru.

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
    return `You are Elev8 Analyzer, an expert business diagnostic assistant powered by YourBizGuru.

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
    const { formData } = req.body;
    
    try {
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

  const httpServer = createServer(app);

  return httpServer;
}
