import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { queryNearbyEpaFacilities } from "./epaQuery";
import { queryAirQuality, aqiToScore, getAqiCategory } from "./waqiQuery";
import { queryClimateTraceSources, formatEmissions, getSectorLabel } from "./climateTraceQuery";

// Reverse geocode coordinates to get accurate location name
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // Request English language results with accept-language header
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1&accept-language=en`,
      {
        headers: {
          'User-Agent': 'Verde/1.0 (environmental mapping app)',
          'Accept-Language': 'en'
        }
      }
    );
    
    if (!response.ok) {
      console.warn(`Reverse geocoding failed: ${response.status}`);
      return `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    
    const data = await response.json();
    const addr = data.address || {};
    
    // Build location name from address components
    const parts: string[] = [];
    
    // Try to get the most specific name first
    const specificPlace = addr.neighbourhood || addr.suburb || addr.hamlet || addr.village;
    if (specificPlace) parts.push(specificPlace);
    
    // Add city/town
    const city = addr.city || addr.town || addr.municipality;
    if (city && city !== specificPlace) parts.push(city);
    
    // Add state abbreviation
    const state = addr.state;
    if (state) {
      // Common US state abbreviations
      const stateAbbrevs: Record<string, string> = {
        'California': 'CA', 'New York': 'NY', 'Texas': 'TX', 'Florida': 'FL',
        'Illinois': 'IL', 'Pennsylvania': 'PA', 'Ohio': 'OH', 'Georgia': 'GA',
        'North Carolina': 'NC', 'Michigan': 'MI', 'New Jersey': 'NJ', 'Virginia': 'VA',
        'Washington': 'WA', 'Arizona': 'AZ', 'Massachusetts': 'MA', 'Tennessee': 'TN',
        'Indiana': 'IN', 'Missouri': 'MO', 'Maryland': 'MD', 'Wisconsin': 'WI',
        'Colorado': 'CO', 'Minnesota': 'MN', 'South Carolina': 'SC', 'Alabama': 'AL',
        'Louisiana': 'LA', 'Kentucky': 'KY', 'Oregon': 'OR', 'Oklahoma': 'OK',
        'Connecticut': 'CT', 'Utah': 'UT', 'Iowa': 'IA', 'Nevada': 'NV',
        'Arkansas': 'AR', 'Mississippi': 'MS', 'Kansas': 'KS', 'New Mexico': 'NM',
        'Nebraska': 'NE', 'Idaho': 'ID', 'West Virginia': 'WV', 'Hawaii': 'HI',
        'New Hampshire': 'NH', 'Maine': 'ME', 'Montana': 'MT', 'Rhode Island': 'RI',
        'Delaware': 'DE', 'South Dakota': 'SD', 'North Dakota': 'ND', 'Alaska': 'AK',
        'District of Columbia': 'DC', 'Vermont': 'VT', 'Wyoming': 'WY'
      };
      parts.push(stateAbbrevs[state] || state);
    }
    
    if (parts.length === 0) {
      return data.display_name?.split(',').slice(0, 2).join(',') || 
             `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    
    return parts.join(', ');
  } catch (error) {
    console.warn('Reverse geocoding error:', error);
    return `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

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

      // Get accurate location name via reverse geocoding (in parallel with EPA, WAQI, and Climate TRACE queries)
      const [locationName, epaData, aqiData, climateData] = await Promise.all([
        reverseGeocode(lat, lng),
        queryNearbyEpaFacilities(lat, lng, 10),
        queryAirQuality(lat, lng),
        queryClimateTraceSources(lat, lng, 50)
      ]);
      
      console.log(`Location: ${locationName}, EPA: ${epaData.totalFacilities} facilities, AQI: ${aqiData.aqi}, Climate TRACE: ${climateData.sources.length} sources`);
      
      // Build context about nearby facilities and air quality
      let facilityContext = "";
      let airQualityContext = "";
      
      // Add real-time air quality data if available
      if (aqiData.aqi !== null) {
        const aqiCategory = getAqiCategory(aqiData.aqi);
        const suggestedScore = aqiToScore(aqiData.aqi);
        const pollutantInfo = Object.entries(aqiData.pollutants)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
          .join(", ");
        
        // Only include score guidance if we have a valid calculated score
        const scoreGuidance = suggestedScore !== null 
          ? `IMPORTANT: Your airQuality score MUST be close to ${suggestedScore} (derived from real AQI of ${aqiData.aqi}).
AQI 0-50 = Good (score 90-100), AQI 51-100 = Moderate (score 60-89), AQI 101-150 = Unhealthy for Sensitive (score 40-59), AQI 151-200 = Unhealthy (score 25-39), AQI 201+ = Very Unhealthy/Hazardous (score <25).`
          : `Use the AQI value of ${aqiData.aqi} to inform your airQuality score.`;
        
        airQualityContext = `
REAL-TIME AIR QUALITY DATA:
- Current AQI: ${aqiData.aqi} (${aqiCategory})
- Nearest monitoring station: ${aqiData.stationName || "Unknown"}
- Dominant pollutant: ${aqiData.dominantPollutant?.toUpperCase() || "Not specified"}
- Pollutant readings: ${pollutantInfo || "Not available"}
- Last updated: ${aqiData.lastUpdated || "Unknown"}

${scoreGuidance}
`;
      } else {
        airQualityContext = `
AIR QUALITY DATA: No real-time AQI data available for this location. Estimate based on EPA facility data and general knowledge.
`;
      }
      if (epaData.totalFacilities > 0) {
        facilityContext = `
REAL EPA DATA (within 10 miles):
- Total regulated facilities: ${epaData.totalFacilities}
- Major emitters: ${epaData.majorFacilities}
- Facilities with violations: ${epaData.facilitiesWithViolations}
- Industry breakdown: ${Object.entries(epaData.industryBreakdown).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Nearest facilities: ${epaData.nearbyFacilities.slice(0, 5).map(f => `${f.name} (${f.type}, ${f.distance.toFixed(1)} mi${f.hasViolation ? ", HAS VIOLATIONS" : ""})`).join("; ")}

Use this real data to inform your pollution and air quality scores. More facilities, major emitters, and violations should lower scores.`;
      } else {
        facilityContext = `
EPA DATA: No regulated industrial facilities found within 10 miles. This is a positive indicator for pollution/air quality scores.`;
      }
      
      // Add Climate TRACE global emissions context
      let climateContext = "";
      if (climateData.sources.length > 0) {
        const sectorSummary = Object.entries(climateData.sectorBreakdown)
          .sort((a, b) => b[1].emissions - a[1].emissions)
          .slice(0, 5)
          .map(([sector, data]) => `${getSectorLabel(sector)}: ${data.count} sources (${formatEmissions(data.emissions)} tonnes CO2e)`)
          .join("; ");
        
        const topSources = climateData.sources
          .slice(0, 5)
          .map(s => `${s.name} (${getSectorLabel(s.sector)}, ${s.emissions ? formatEmissions(s.emissions) + ' tonnes CO2e' : 'emissions data pending'})`)
          .join("; ");
        
        climateContext = `
CLIMATE TRACE NATIONAL EMISSIONS DATA (for this country):
- Top emission sources tracked: ${climateData.sources.length}
- Total CO2e emissions: ${formatEmissions(climateData.totalEmissions)} tonnes/year
- Sector breakdown: ${sectorSummary}
- Largest emitters: ${topSources}

This national emissions data covers power plants, factories, and industrial facilities tracked by Climate TRACE satellite monitoring. These are country-level statistics that provide context for the broader emissions landscape.`;
      }
      
      const prompt = `
Analyze the environmental quality for the location: "${locationName}" (Coordinates: ${lat}, ${lng}).
This location has been verified via reverse geocoding - use this exact location name in your response.
${airQualityContext}
${facilityContext}
${climateContext}

Provide a JSON response with the following fields:
- location: Use "${locationName}" or a slightly more descriptive version (e.g., add a neighborhood if known)
- summary: A 2-3 sentence summary of the environmental vibe. If EPA facilities were found, mention the industrial context.
- scores: An object with numeric scores (0-100) for:
  - airQuality (100 is best) - factor in nearby major emitters
  - waterQuality (100 is best)
  - walkability (100 is best)
  - greenSpace (100 is best)
  - pollution (100 is cleanest/least pollution) - directly affected by EPA facility count and violations
- scoreDetails: An object with detailed breakdown for each score category. Each has:
  - value: the score (same as in scores)
  - factors: array of 2-4 brief reasons affecting this score (e.g., "Heavy industrial activity within 5 miles", "Multiple EPA facilities with violations")
  - tips: array of 1-2 suggestions for improvement or things to be aware of
  
Example scoreDetails entry:
"airQuality": {
  "value": 45,
  "factors": ["73 major emitters within 10 miles", "Petrochemical industry presence", "Highway traffic corridor"],
  "tips": ["Check daily AQI before outdoor activities", "Consider indoor air filtration"]
}

Return ONLY valid JSON.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are an environmental data analyst. Use the provided EPA data to generate accurate, data-driven scores. Return JSON only." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No response from AI");

      const aiData = JSON.parse(content);
      
      // Build deterministic epaContext from actual EPA query results
      const topIndustries = Object.entries(epaData.industryBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([industry]) => industry);
      
      const epaContext = {
        totalFacilities: epaData.totalFacilities,
        majorEmitters: epaData.majorFacilities,
        facilitiesWithViolations: epaData.facilitiesWithViolations,
        topIndustries,
      };
      
      // Build AQI context if available
      const aqiContext = aqiData.aqi !== null ? {
        aqi: aqiData.aqi,
        category: getAqiCategory(aqiData.aqi),
        station: aqiData.stationName,
        dominantPollutant: aqiData.dominantPollutant,
        lastUpdated: aqiData.lastUpdated,
      } : null;
      
      // Build Climate TRACE context if available
      const climateTraceContext = climateData.sources.length > 0 ? {
        sourcesCount: climateData.sources.length,
        totalEmissions: climateData.totalEmissions,
        totalEmissionsFormatted: formatEmissions(climateData.totalEmissions),
        topSources: climateData.sources.slice(0, 5).map(s => ({
          name: s.name,
          sector: getSectorLabel(s.sector),
          emissions: s.emissions,
          emissionsFormatted: s.emissions ? formatEmissions(s.emissions) : null,
        })),
        sectorBreakdown: Object.entries(climateData.sectorBreakdown)
          .sort((a, b) => b[1].emissions - a[1].emissions)
          .slice(0, 5)
          .map(([sector, data]) => ({
            sector: getSectorLabel(sector),
            count: data.count,
            emissions: data.emissions,
            emissionsFormatted: formatEmissions(data.emissions),
          })),
      } : null;
      
      // Merge AI response with server-computed data
      res.json({
        ...aiData,
        epaContext,
        aqiContext,
        climateTraceContext,
      });

    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze location" });
    }
  });

  // Ask Question API
  app.post(api.analysis.askQuestion.path, async (req, res) => {
    try {
      const { lat, lng, location, question } = api.analysis.askQuestion.input.parse(req.body);

      const prompt = `
        The user is asking about the location "${location}" (Latitude: ${lat}, Longitude: ${lng}).
        
        User question: "${question}"
        
        Provide a helpful, informative answer about this location related to the question.
        Focus on environmental, geographic, cultural, or practical information.
        Keep your answer concise (2-4 sentences) but informative.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are a helpful environmental and geographic expert. Provide informative answers about locations." },
          { role: "user", content: prompt }
        ],
      });

      const answer = response.choices[0].message.content || "I couldn't find information about that.";
      
      res.json({ answer });

    } catch (error) {
      console.error("Ask question error:", error);
      res.status(500).json({ message: "Failed to get answer" });
    }
  });

  // Email Subscription API
  app.post(api.subscribers.create.path, async (req, res) => {
    try {
      const input = api.subscribers.create.input.parse(req.body);
      
      // Check if already subscribed
      const existing = await storage.getEmailSubscriberByEmail(input.email);
      if (existing) {
        return res.status(409).json({ message: "This email is already subscribed" });
      }
      
      await storage.createEmailSubscriber({
        email: input.email,
        lat: input.lat || null,
        lng: input.lng || null,
        locationName: input.locationName || null,
      });
      
      res.status(201).json({ message: "Successfully subscribed to environmental alerts!" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Subscription error:", err);
      res.status(500).json({ message: "Failed to subscribe" });
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
