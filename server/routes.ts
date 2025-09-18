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

  // API endpoint for generating toolkit results
  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt: userPrompt } = req.body;

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

      if (userPrompt.length > 2000) {
        return res.status(400).json({
          error: "Prompt is too long. Maximum 2000 characters allowed.",
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
        "Generating response for prompt:",
        userPrompt.substring(0, 100) + (userPrompt.length > 100 ? "..." : "")
      );


      // Call OpenAI API with latest model  
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful business assistant powered by YourBizGuru. Provide professional, actionable advice and solutions. Be concise but comprehensive in your responses.",
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 1000,
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
                content: "You are a helpful business assistant powered by YourBizGuru. Provide professional, actionable advice and solutions. Be concise but comprehensive in your responses.",
              },
              {
                role: "user", 
                content: userPrompt,
              },
            ],
            max_tokens: 1000,
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
