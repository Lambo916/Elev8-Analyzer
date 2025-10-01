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

  // API endpoint for generating toolkit results
  app.post("/api/generate", async (req, res) => {
    const { prompt: userPrompt, formData } = req.body;
    
    try {

      // Input validation
      if (!userPrompt || typeof userPrompt !== "string") {
        return res.status(400).json({
          error: "Invalid request. Prompt is required and must be a string.",
        });
      }

      if (userPrompt.trim().length === 0) {
        return res.status(400).json({
          error: "Prompt cannot be empty.",
        });
      }

      if (userPrompt.length > 5000) {
        return res.status(400).json({
          error: "Prompt is too long. Maximum 5000 characters allowed.",
        });
      }

      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        console.error("OpenAI API key not configured");
        return res.status(500).json({
          error: "Service configuration error. Please contact support.",
        });
      }

      console.log(
        "Generating compliance report:",
        formData ? `${formData.filingType} - ${formData.entityType}` : userPrompt.substring(0, 100)
      );


      // Call OpenAI API with latest model  
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: getComplianceSystemPrompt(),
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 2500,
      });

      const result = completion.choices[0].message.content;

      console.log("Response generated successfully");

      res.json({
        result,
        timestamp: new Date().toISOString(),
        model: "gpt-4o-mini",
      });
    } catch (error: any) {
      console.error("Error in /api/generate:", error);

      // Handle specific OpenAI errors
      if (error.code === "insufficient_quota") {
        return res.status(503).json({
          error: "Service temporarily unavailable. Please try again later.",
        });
      }

      if (error.code === "model_not_found") {
        // Fallback to gpt-3.5-turbo if gpt-4o-mini not available
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: getComplianceSystemPrompt(),
              },
              {
                role: "user", 
                content: userPrompt,
              },
            ],
            max_tokens: 2500,
          });
          
          const result = completion.choices[0].message.content;
          console.log("Response generated successfully with fallback model");
          return res.json({
            result,
            timestamp: new Date().toISOString(),
            model: "gpt-3.5-turbo"
          });
        } catch (fallbackError) {
          return res.status(503).json({
            error: "AI models temporarily unavailable. Please try again later.",
          });
        }
      }

      if (error.status === 429) {
        return res.status(429).json({
          error: "Too many requests. Please wait a moment and try again.",
        });
      }

      if (error.status === 401) {
        return res.status(401).json({
          error: "Authentication failed",
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
