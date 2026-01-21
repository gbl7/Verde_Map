import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

// Initialize OpenAI with Replit AI Integrations env vars
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Pins API
  app.get(api.pins.list.path, async (req, res) => {
    const pins = await storage.getPins();
    res.json(pins);
  });

  app.post(api.pins.create.path, async (req, res) => {
    try {
      const input = api.pins.create.input.parse(req.body);
      const pin = await storage.createPin(input);
      res.status(201).json(pin);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Analysis API
  app.post(api.analysis.analyze.path, async (req, res) => {
    try {
      const { lat, lng } = api.analysis.analyze.input.parse(req.body);

      // Construct a prompt for the AI
      // In a real app, we might reverse geocode here to get the city name, 
      // but we can also just ask the AI to estimate based on the coordinates if it knows them, 
      // or more likely, we just simulate the "vibe" generation for this demo if the AI doesn't know specific lat/lng.
      // However, GPT-4o often has good geographical knowledge.
      
      const prompt = `
        Analyze the environmental quality for the location at Latitude: ${lat}, Longitude: ${lng}.
        If you don't know the exact specific street location, estimate based on the general area (city/region).
        Provide a JSON response with the following fields:
        - location: A readable name for the location (e.g., "Central Park, NY")
        - summary: A 2-3 sentence summary of the environmental vibe.
        - scores: An object with numeric scores (0-100) for:
          - airQuality (100 is best)
          - waterQuality (100 is best)
          - walkability (100 is best)
          - greenSpace (100 is best)
          - pollution (100 is cleanest/least pollution)
        
        Return ONLY valid JSON.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are an environmental data analyst. Return JSON only." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No response from AI");

      const data = JSON.parse(content);
      
      // Validate structure roughly (or let the frontend handle it, but better here)
      // We'll trust the AI followed the JSON structure for the MVP
      
      res.json(data);

    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze location" });
    }
  });

  // Initial Seed
  const existingPins = await storage.getPins();
  if (existingPins.length === 0) {
    console.log("Seeding database...");
    await storage.createPin({
      lat: 40.785091,
      lng: -73.968285,
      type: "trail",
      description: "Great walking path around the reservoir.",
    });
    await storage.createPin({
      lat: 40.7812,
      lng: -73.9665,
      type: "animal",
      description: "Saw a red-tailed hawk here!",
    });
    await storage.createPin({
      lat: 40.779,
      lng: -73.969,
      type: "pollution",
      description: "Overflowing trash can.",
    });
    console.log("Database seeded.");
  }

  return httpServer;
}
