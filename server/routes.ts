import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import path from "path";
import OpenAI from "openai";

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

  // API endpoint for generating structured compliance data
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

      console.log(`Generating structured compliance data for: ${filingType} - ${entityType} (${jurisdiction || 'General'})`);

      // Build context-aware prompt for AI to return structured JSON
      const userPrompt = `Generate a compliance intelligence report for the following filing:

**Entity Information:**
- Name: ${entityName || '[Not provided]'}
- Type: ${entityType}
- Jurisdiction: ${jurisdiction || '[General]'}
- Filing Type: ${filingType}
- Deadline: ${deadline || '[Not provided]'}

**User-Provided Context:**
- Selected Requirements: ${requirements.length > 0 ? requirements.join(', ') : '[None selected]'}
- Risk Concerns: ${risks || '[None provided]'}
- Mitigation Plan: ${mitigation || '[None provided]'}

You MUST return a valid JSON object with this exact structure:
{
  "summary": "2-3 paragraph executive summary explaining the filing requirement, its importance, and key deadlines",
  "checklist": ["item 1", "item 2", ...],
  "timeline": [
    {"milestone": "Task name", "owner": "Responsible party", "dueDate": "YYYY-MM-DD or relative like T-30", "notes": "Additional context"}
  ],
  "riskMatrix": [
    {"risk": "Risk description", "severity": "High/Medium/Low", "likelihood": "High/Medium/Low", "mitigation": "How to address"}
  ],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "references": ["Link to official portal: https://..."]
}

Guidelines:
- Be specific to ${filingType} in ${jurisdiction || 'applicable jurisdictions'}
- Include at least 5 checklist items (required documents/steps)
- Include at least 4 timeline milestones (spanning from preparation to submission)
- Include at least 3 risk items (late filing, missing docs, etc.)
- Include at least 3 actionable recommendations
- For timeline dates, use actual dates if deadline provided, otherwise use relative days like "T-30" (30 days before deadline)
- Return ONLY valid JSON, no markdown formatting`;

      // Call OpenAI to generate structured data
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a compliance expert. You MUST respond with valid JSON only. No markdown, no explanations outside the JSON structure."
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2500,
      });

      const rawResponse = completion.choices[0].message.content || "{}";
      let structuredData;

      try {
        structuredData = JSON.parse(rawResponse);
      } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", parseError);
        throw new Error("AI returned invalid JSON format");
      }

      // Validate and ensure all required fields exist with defaults
      const response = {
        summary: structuredData.summary || "Compliance summary unavailable",
        checklist: Array.isArray(structuredData.checklist) ? structuredData.checklist : [],
        timeline: Array.isArray(structuredData.timeline) ? structuredData.timeline : [],
        riskMatrix: Array.isArray(structuredData.riskMatrix) ? structuredData.riskMatrix : [],
        recommendations: Array.isArray(structuredData.recommendations) ? structuredData.recommendations : [],
        references: Array.isArray(structuredData.references) ? structuredData.references : []
      };

      console.log("Structured compliance data generated successfully");

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
