import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { queryNearbyEpaFacilities } from "./epaQuery";
import { queryAirQuality, aqiToScore, getAqiCategory } from "./waqiQuery";
import { queryClimateTraceSources, queryClimateTraceSourcesForMap, formatEmissions, getSectorLabel, ClimateTraceSource, queryEmissionsFromDatabase, queryEmissionsNearLocation, getEmissionsDatabaseCount } from "./climateTraceQuery";
import { queryLandCover } from "./landCoverQuery";
import { queryCalEnviroScreen, isCaliforniaLocation, CalEnviroScreenData } from "./calenviroScreenQuery";
import { computeAirQualityScore, computeGreenSpaceScore, computePollutionScore, computeWaterQualityScore, computeClimateEmissionsScore, ScoreResult, CesData, ClimateEmissionsInput } from "./scoringEngine";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { stripeService } from "./stripeService";
import { stripeStorage } from "./stripeStorage";
import { getStripePublishableKey } from "./stripeClient";

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
  
  // Setup authentication (BEFORE other routes)
  await setupAuth(app);
  registerAuthRoutes(app);
  
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

  // Helper: convert CalEnviroScreenData to flat CesData for scoring engine
  function toCesData(ces: CalEnviroScreenData): CesData {
    return {
      CIscoreP: ces.overallPercentile ?? undefined,
      ozoneP: ces.indicators.ozone.percentile ?? undefined,
      pmP: ces.indicators.pm25.percentile ?? undefined,
      dieselP: ces.indicators.dieselPM.percentile ?? undefined,
      pesticidesP: ces.indicators.pesticides.percentile ?? undefined,
      toxrelP: ces.indicators.toxicReleases.percentile ?? undefined,
      trafficP: ces.indicators.traffic.percentile ?? undefined,
      cleanupsP: ces.indicators.cleanups.percentile ?? undefined,
      gwthreatsP: ces.indicators.groundwaterThreats.percentile ?? undefined,
      hazP: ces.indicators.hazardousWaste.percentile ?? undefined,
      drinkP: ces.indicators.drinkingWater.percentile ?? undefined,
      iwbP: ces.indicators.impairedWaterBodies.percentile ?? undefined,
      solidwasteP: ces.indicators.solidWaste.percentile ?? undefined,
      polburdP: ces.pollutionBurden.percentile ?? undefined,
      ozone: ces.indicators.ozone.value ?? undefined,
      pm: ces.indicators.pm25.value ?? undefined,
      diesel: ces.indicators.dieselPM.value ?? undefined,
      pesticides: ces.indicators.pesticides.value ?? undefined,
      toxrel: ces.indicators.toxicReleases.value ?? undefined,
      traffic: ces.indicators.traffic.value ?? undefined,
      cleanups: ces.indicators.cleanups.value ?? undefined,
      gwthreats: ces.indicators.groundwaterThreats.value ?? undefined,
      haz: ces.indicators.hazardousWaste.value ?? undefined,
      drink: ces.indicators.drinkingWater.value ?? undefined,
      iwb: ces.indicators.impairedWaterBodies.value ?? undefined,
      solidwaste: ces.indicators.solidWaste.value ?? undefined,
    };
  }

  // Analysis API
  app.post(api.analysis.analyze.path, async (req, res) => {
    try {
      const startTime = Date.now();
      const { lat, lng } = api.analysis.analyze.input.parse(req.body);

      const dataFetchStart = Date.now();
      
      const dbCount = await getEmissionsDatabaseCount();
      const useDatabase = dbCount > 1000;
      const isCalifornia = isCaliforniaLocation(lat, lng);
      
      const [locationName, epaData, aqiData, climateData, landCoverData, cesRawData] = await Promise.all([
        reverseGeocode(lat, lng),
        queryNearbyEpaFacilities(lat, lng, 10),
        queryAirQuality(lat, lng),
        useDatabase ? queryEmissionsNearLocation(lat, lng, 50) : queryClimateTraceSources(lat, lng, 50),
        queryLandCover(lat, lng, 1000),
        isCalifornia ? queryCalEnviroScreen(lat, lng) : Promise.resolve(null),
      ]);
      const dataFetchTime = Date.now() - dataFetchStart;
      
      console.log(`[TIMING] Data fetch: ${dataFetchTime}ms | Location: ${locationName}, EPA: ${epaData.totalFacilities} facilities, AQI: ${aqiData.aqi}, Climate TRACE: ${climateData.sources.length} sources (DB: ${useDatabase}), Land Cover: ${landCoverData.dominantClass}, CES: ${cesRawData ? `tract ${cesRawData.censusTract} (${cesRawData.overallPercentile?.toFixed(1)}th pctl)` : 'N/A'}`);
      
      // --- Deterministic scoring ---
      const cesData = cesRawData ? toCesData(cesRawData) : null;
      const landCoverInput = landCoverData.totalPixels > 0 ? {
        vegetationPercentage: landCoverData.vegetationPercentage,
        treePercentage: landCoverData.treePercentage,
        builtPercentage: landCoverData.builtPercentage,
        waterPercentage: landCoverData.waterPercentage,
        cropPercentage: landCoverData.cropPercentage,
      } : null;
      const epaInput = epaData.totalFacilities > 0 ? {
        totalFacilities: epaData.totalFacilities,
        majorFacilities: epaData.majorFacilities,
        facilitiesWithViolations: epaData.facilitiesWithViolations,
      } : null;
      const climateInput = climateData.sources.length > 0 ? {
        totalEmissions: climateData.totalEmissions,
        sources: climateData.sources.map(s => ({ emissions: s.emissions })),
      } : null;

      const climateEmissionsInput: ClimateEmissionsInput | null = climateData.sources.length > 0 ? {
        totalEmissions: climateData.totalEmissions,
        sourcesCount: climateData.sources.length,
        sectorBreakdown: climateData.sectorBreakdown,
        topSources: climateData.sources.slice(0, 5).map(s => ({
          name: s.name,
          sector: s.sector,
          emissions: s.emissions,
        })),
        radiusKm: 50,
      } : null;

      const deterministicScores: Record<string, ScoreResult | null> = {
        airQuality: computeAirQualityScore(aqiData.aqi, cesData),
        greenSpace: computeGreenSpaceScore(landCoverInput, cesData),
        pollution: computePollutionScore(epaInput, cesData, climateInput),
        waterQuality: computeWaterQualityScore(cesData),
        climateEmissions: computeClimateEmissionsScore(climateEmissionsInput, cesData),
      };

      const scoreSources: Record<string, string> = {};
      const finalScores: Record<string, number> = {};
      const finalScoreDetails: Record<string, { value: number; factors: string[]; tips: string[] }> = {};

      for (const [key, result] of Object.entries(deterministicScores)) {
        if (result) {
          finalScores[key] = result.score;
          finalScoreDetails[key] = { value: result.score, factors: result.factors, tips: result.tips };
          if (key === "climateEmissions") {
            scoreSources[key] = "climate-trace";
          } else if (cesData && (key === "airQuality" || key === "waterQuality" || key === "pollution")) {
            scoreSources[key] = "calenviroscreen";
          } else {
            scoreSources[key] = "deterministic";
          }
        }
      }

      const aiNeededScores = Object.keys(deterministicScores).filter(k => finalScores[k] === undefined);
      console.log(`[SCORING] Deterministic: ${Object.keys(finalScores).join(', ') || 'none'} | AI needed: ${aiNeededScores.join(', ') || 'none'}`);

      // --- Build AI context (always needed for summary, and for missing scores) ---
      let dataContext = "";
      
      if (aqiData.aqi !== null) {
        const aqiCategory = getAqiCategory(aqiData.aqi);
        const pollutantInfo = Object.entries(aqiData.pollutants)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
          .join(", ");
        dataContext += `\nAIR QUALITY: AQI ${aqiData.aqi} (${aqiCategory}), station: ${aqiData.stationName || "Unknown"}, pollutant: ${aqiData.dominantPollutant?.toUpperCase() || "N/A"}, readings: ${pollutantInfo || "N/A"}`;
      }
      
      if (epaData.totalFacilities > 0) {
        dataContext += `\nEPA FACILITIES (10mi): ${epaData.totalFacilities} total, ${epaData.majorFacilities} major, ${epaData.facilitiesWithViolations} with violations. Industries: ${Object.entries(epaData.industryBreakdown).map(([k, v]) => `${k}: ${v}`).join(", ")}`;
      }
      
      if (climateData.sources.length > 0) {
        const topSources = climateData.sources.slice(0, 3).map(s => `${s.name} (${getSectorLabel(s.sector)})`).join("; ");
        dataContext += `\nEMISSIONS: ${climateData.sources.length} sources, ${formatEmissions(climateData.totalEmissions)} tonnes CO2e/yr. Top: ${topSources}`;
      }
      
      if (cesRawData) {
        dataContext += `\nCALENVIROSCREEN 4.0 (Census Tract ${cesRawData.censusTract}): Overall percentile ${cesRawData.overallPercentile?.toFixed(1)}%, Pollution burden ${cesRawData.pollutionBurden.percentile?.toFixed(1)}%`;
        if (cesRawData.indicators.cleanups.value) {
          dataContext += `, Remediation sites: ${cesRawData.indicators.cleanups.value}`;
        }
        if (cesRawData.indicators.groundwaterThreats.percentile) {
          dataContext += `, Groundwater threats: ${cesRawData.indicators.groundwaterThreats.percentile.toFixed(1)}th pctl`;
        }
      }
      
      if (landCoverData.totalPixels > 0) {
        dataContext += `\nLAND COVER: ${landCoverData.dominantClass}, trees ${landCoverData.treePercentage}%, vegetation ${landCoverData.vegetationPercentage}%, built ${landCoverData.builtPercentage}%`;
      }

      // Build AI prompt - only request scores that weren't computed deterministically
      const scoreInstructions = aiNeededScores.length > 0
        ? `Generate scores (0-100) ONLY for these categories: ${aiNeededScores.join(", ")}. The following scores are already computed from hard data and should NOT be included: ${Object.keys(finalScores).join(", ")}.`
        : `All scores have been computed from hard data. Do NOT include any scores.`;

      const prompt = `Analyze the environmental quality for "${locationName}" (${lat}, ${lng}).
${dataContext}

Provide a JSON response:
- location: "${locationName}" (or slightly more descriptive)
- summary: 2-3 sentence environmental summary. ${cesRawData ? 'Mention CalEnviroScreen data and any remediation sites if relevant.' : epaData.totalFacilities > 0 ? 'Mention the industrial context.' : ''}
${aiNeededScores.length > 0 ? `- scores: Object with ONLY these keys: ${aiNeededScores.join(", ")} (each 0-100)
- scoreDetails: Object with ONLY these keys: ${aiNeededScores.join(", ")}. Each has value (number), factors (array of 2-3 strings), tips (array of 1-2 strings).` : ''}

${scoreInstructions}
Return ONLY valid JSON.`;

      const aiStart = Date.now();
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an environmental data analyst. Return JSON only. Only generate scores for categories explicitly requested." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      });
      const aiTime = Date.now() - aiStart;
      console.log(`[TIMING] AI analysis: ${aiTime}ms`);

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No response from AI");

      const aiData = JSON.parse(content);
      
      // Merge AI scores for categories that needed it
      if (aiData.scores) {
        for (const key of aiNeededScores) {
          if (aiData.scores[key] !== undefined) {
            finalScores[key] = aiData.scores[key];
            scoreSources[key] = "ai";
          }
        }
      }
      if (aiData.scoreDetails) {
        for (const key of aiNeededScores) {
          if (aiData.scoreDetails[key]) {
            finalScoreDetails[key] = aiData.scoreDetails[key];
          }
        }
      }

      // Ensure all five scores exist (fallback to 50 if both deterministic and AI failed)
      for (const key of ["airQuality", "waterQuality", "climateEmissions", "greenSpace", "pollution"]) {
        if (finalScores[key] === undefined) {
          finalScores[key] = 50;
          scoreSources[key] = "ai";
          finalScoreDetails[key] = { value: 50, factors: ["Insufficient data for this location"], tips: ["Check back as more data sources become available"] };
        }
      }

      // Build context objects for frontend
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
      
      const aqiContext = aqiData.aqi !== null ? {
        aqi: aqiData.aqi,
        category: getAqiCategory(aqiData.aqi),
        station: aqiData.stationName,
        dominantPollutant: aqiData.dominantPollutant,
        lastUpdated: aqiData.lastUpdated,
      } : null;
      
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
      
      const landCoverContext = landCoverData.totalPixels > 0 ? {
        classes: landCoverData.classes.slice(0, 6),
        dominantClass: landCoverData.dominantClass,
        treePercentage: landCoverData.treePercentage,
        builtPercentage: landCoverData.builtPercentage,
        waterPercentage: landCoverData.waterPercentage,
        cropPercentage: landCoverData.cropPercentage,
        vegetationPercentage: landCoverData.vegetationPercentage,
      } : null;

      const cesContext = cesRawData ? {
        censusTract: cesRawData.censusTract,
        overallPercentile: cesRawData.overallPercentile,
        pollutionBurden: cesRawData.pollutionBurden,
        cleanupSites: cesRawData.indicators.cleanups,
        groundwaterThreats: cesRawData.indicators.groundwaterThreats,
        drinkingWater: cesRawData.indicators.drinkingWater,
        hazardousWaste: cesRawData.indicators.hazardousWaste,
        impairedWaterBodies: cesRawData.indicators.impairedWaterBodies,
        toxicReleases: cesRawData.indicators.toxicReleases,
        pesticides: cesRawData.indicators.pesticides,
      } : null;
      
      const totalTime = Date.now() - startTime;
      console.log(`[TIMING] Total /api/analyze: ${totalTime}ms (data: ${dataFetchTime}ms, AI: ${aiTime}ms)`);
      
      res.json({
        location: aiData.location || locationName,
        summary: aiData.summary || `Environmental analysis for ${locationName}.`,
        scores: {
          airQuality: finalScores.airQuality,
          waterQuality: finalScores.waterQuality,
          climateEmissions: finalScores.climateEmissions,
          greenSpace: finalScores.greenSpace,
          pollution: finalScores.pollution,
        },
        scoreDetails: {
          airQuality: finalScoreDetails.airQuality,
          waterQuality: finalScoreDetails.waterQuality,
          climateEmissions: finalScoreDetails.climateEmissions,
          greenSpace: finalScoreDetails.greenSpace,
          pollution: finalScoreDetails.pollution,
        },
        scoreSources,
        epaContext,
        aqiContext,
        climateTraceContext,
        landCoverContext,
        cesContext,
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
        model: "gpt-4o",
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

  // EPA facilities for map display - cached in memory to avoid repeated heavy fetches
  let epaFacilitiesCache: { facilities: any[]; count: number; fetchedAt: number } | null = null;
  let epaFacilitiesFetchPromise: Promise<{ facilities: any[]; count: number }> | null = null;
  const EPA_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  async function fetchEpaFacilities(): Promise<{ facilities: any[]; count: number }> {
    const baseUrl = "https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer/0/query";
    const allFeatures: any[] = [];
    let offset = 0;
    const limit = 1000;
    const maxPages = 15;

    console.log("EPA facilities: Fetching entire US dataset with pagination");

    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        geometry: "-125,24,-66,50",
        geometryType: "esriGeometryEnvelope",
        inSR: "4326",
        outSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "FAC_NAME,FAC_MAJOR_FLAG,FAC_CURR_SNC_FLG",
        returnGeometry: "true",
        f: "json",
        where: "FAC_MAJOR_FLAG='Y' OR FAC_CURR_SNC_FLG='Y'",
        resultRecordCount: limit.toString(),
        resultOffset: offset.toString(),
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(`${baseUrl}?${params.toString()}`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) break;

        const data = await response.json();
        const features = data.features || [];

        if (features.length === 0) break;

        allFeatures.push(...features);
        console.log(`EPA facilities: Page ${page + 1}, fetched ${features.length}, total ${allFeatures.length}`);

        if (features.length < limit) break;
        offset += limit;
      } catch {
        clearTimeout(timeoutId);
        break;
      }
    }

    const facilities = allFeatures
      .map((f: any) => ({
        id: f.attributes.FAC_NAME || Math.random().toString(36).slice(2),
        name: f.attributes.FAC_NAME || "Unknown Facility",
        isMajor: f.attributes.FAC_MAJOR_FLAG === "Y",
        hasViolation: f.attributes.FAC_CURR_SNC_FLG === "Y",
        lat: f.geometry?.y,
        lng: f.geometry?.x,
      }))
      .filter((f: any) => f.lat && f.lng);

    console.log(`EPA facilities: Found ${facilities.length} total facilities`);
    return { facilities, count: facilities.length };
  }

  app.get("/api/epa-facilities", async (req, res) => {
    try {
      const now = Date.now();

      // Serve from cache if fresh
      if (epaFacilitiesCache && now - epaFacilitiesCache.fetchedAt < EPA_CACHE_TTL_MS) {
        console.log(`EPA facilities: Serving from cache (${epaFacilitiesCache.count} facilities)`);
        return res.json({ facilities: epaFacilitiesCache.facilities, count: epaFacilitiesCache.count });
      }

      // Deduplicate concurrent requests — share a single in-flight fetch
      if (!epaFacilitiesFetchPromise) {
        epaFacilitiesFetchPromise = fetchEpaFacilities()
          .then((result) => {
            epaFacilitiesCache = { ...result, fetchedAt: Date.now() };
            epaFacilitiesFetchPromise = null;
            return result;
          })
          .catch((err) => {
            epaFacilitiesFetchPromise = null;
            throw err;
          });
      } else {
        console.log("EPA facilities: Waiting for in-flight fetch to complete");
      }

      const result = await epaFacilitiesFetchPromise;
      res.json(result);
    } catch (err: any) {
      console.error("EPA facilities error:", err);
      res.status(500).json({ message: "Failed to fetch EPA facilities" });
    }
  });

  // Climate TRACE emissions sources for map display - from database
  // Supports optional viewport filtering via minLat, maxLat, minLng, maxLng params
  app.get("/api/emissions-sources", async (req, res) => {
    try {
      const dbCount = await getEmissionsDatabaseCount();
      
      let sources: ClimateTraceSource[];
      if (dbCount > 0) {
        // Check for viewport bounds
        const minLat = parseFloat(req.query.minLat as string);
        const maxLat = parseFloat(req.query.maxLat as string);
        const minLng = parseFloat(req.query.minLng as string);
        const maxLng = parseFloat(req.query.maxLng as string);
        
        if (!isNaN(minLat) && !isNaN(maxLat) && !isNaN(minLng) && !isNaN(maxLng)) {
          // Viewport-based query for performance
          console.log(`Emissions sources: Using database viewport query (${dbCount} total)`);
          const centerLat = (minLat + maxLat) / 2;
          const centerLng = (minLng + maxLng) / 2;
          const radiusKm = Math.max(
            Math.abs(maxLat - minLat) * 111 / 2,
            Math.abs(maxLng - minLng) * 111 * Math.cos(centerLat * Math.PI / 180) / 2
          ) * 1.5; // Add 50% buffer
          const result = await queryEmissionsNearLocation(centerLat, centerLng, radiusKm);
          sources = result.sources;
        } else {
          // Global query for full map
          console.log(`Emissions sources: Using database (${dbCount} sources)`);
          sources = await queryEmissionsFromDatabase();
        }
      } else {
        console.log("Emissions sources: Database empty, falling back to API");
        const lat = parseFloat(req.query.lat as string) || 0;
        const lng = parseFloat(req.query.lng as string) || 0;
        sources = await queryClimateTraceSourcesForMap(lat, lng, 100);
      }
      
      res.json({
        sources: sources.map(s => ({
          id: s.id,
          name: s.name,
          sector: s.sector,
          sectorLabel: getSectorLabel(s.sector),
          lat: s.lat,
          lng: s.lng,
          emissions: s.emissions,
          emissionsFormatted: s.emissionsFormatted,
        })),
        count: sources.length,
        fromDatabase: dbCount > 0,
      });
    } catch (err) {
      console.error("Emissions sources error:", err);
      res.status(500).json({ message: "Failed to fetch emissions sources" });
    }
  });

  // Subscription status endpoint
  app.get("/api/subscription/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if daily count should be reset
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastAnalysis = user.lastAnalysisDate ? new Date(user.lastAnalysisDate) : null;
      
      let dailyCount = user.dailyAnalysisCount || 0;
      if (!lastAnalysis || lastAnalysis < today) {
        dailyCount = 0;
        // Reset the count in database
        await storage.resetDailyAnalysisCount(userId);
      }
      
      const isPro = user.subscriptionTier === 'pro' && user.subscriptionStatus === 'active';
      const dailyLimit = isPro ? -1 : 5; // -1 means unlimited
      const pinLimit = isPro ? -1 : 10;
      
      res.json({
        tier: user.subscriptionTier || 'free',
        status: user.subscriptionStatus || 'active',
        expiresAt: user.subscriptionExpiresAt,
        usage: {
          dailyAnalyses: dailyCount,
          dailyLimit,
          pinsDropped: user.pinsDropped || 0,
          pinLimit,
        },
        gamification: {
          totalPoints: user.totalPoints || 0,
          pinsDropped: user.pinsDropped || 0,
          locationsExplored: user.locationsExplored || 0,
          currentStreak: user.currentStreak || 0,
          badges: user.badges || [],
        },
      });
    } catch (error) {
      console.error("Subscription status error:", error);
      res.status(500).json({ message: "Failed to get subscription status" });
    }
  });
  
  // Track analysis usage
  app.post("/api/subscription/track-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const isPro = user.subscriptionTier === 'pro' && user.subscriptionStatus === 'active';
      
      // Check daily limit for free users
      if (!isPro) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastAnalysis = user.lastAnalysisDate ? new Date(user.lastAnalysisDate) : null;
        
        let dailyCount = user.dailyAnalysisCount || 0;
        if (lastAnalysis && lastAnalysis >= today) {
          if (dailyCount >= 5) {
            return res.status(429).json({ 
              message: "Daily analysis limit reached",
              upgradeUrl: "/upgrade"
            });
          }
        } else {
          dailyCount = 0;
        }
      }
      
      // Increment usage
      await storage.incrementAnalysisCount(userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Track analysis error:", error);
      res.status(500).json({ message: "Failed to track analysis" });
    }
  });
  
  // Update gamification stats (authenticated version)
  app.post("/api/gamification/update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { action, data } = req.body;
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const updates: any = {};
      const today = new Date();
      const lastActivity = user.lastActivityDate ? new Date(user.lastActivityDate) : null;
      
      // Calculate streak
      if (lastActivity) {
        const daysDiff = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          updates.currentStreak = (user.currentStreak || 0) + 1;
        } else if (daysDiff > 1) {
          updates.currentStreak = 1;
        }
      } else {
        updates.currentStreak = 1;
      }
      
      updates.lastActivityDate = today;
      
      // Calculate points based on action
      let pointsEarned = 0;
      const streakBonus = Math.min(updates.currentStreak || user.currentStreak || 0, 20);
      
      if (action === 'pin_dropped') {
        pointsEarned = 10 + streakBonus;
        updates.pinsDropped = (user.pinsDropped || 0) + 1;
      } else if (action === 'location_explored') {
        pointsEarned = 5 + streakBonus;
        updates.locationsExplored = (user.locationsExplored || 0) + 1;
      }
      
      updates.totalPoints = (user.totalPoints || 0) + pointsEarned;
      
      // Check for new badges
      const badges = (user.badges as string[]) || [];
      const newBadges: string[] = [];
      
      const pinsDropped = updates.pinsDropped || user.pinsDropped || 0;
      const locationsExplored = updates.locationsExplored || user.locationsExplored || 0;
      
      // Pin badges
      if (pinsDropped >= 1 && !badges.includes('first_steps')) newBadges.push('first_steps');
      if (pinsDropped >= 5 && !badges.includes('explorer')) newBadges.push('explorer');
      if (pinsDropped >= 10 && !badges.includes('naturalist')) newBadges.push('naturalist');
      if (pinsDropped >= 25 && !badges.includes('eco_warrior')) newBadges.push('eco_warrior');
      if (pinsDropped >= 50 && !badges.includes('guardian')) newBadges.push('guardian');
      if (pinsDropped >= 100 && !badges.includes('legend')) newBadges.push('legend');
      
      // Exploration badges
      if (locationsExplored >= 5 && !badges.includes('curious')) newBadges.push('curious');
      if (locationsExplored >= 15 && !badges.includes('wanderer')) newBadges.push('wanderer');
      if (locationsExplored >= 50 && !badges.includes('globetrotter')) newBadges.push('globetrotter');
      
      if (newBadges.length > 0) {
        updates.badges = [...badges, ...newBadges];
        updates.totalPoints = updates.totalPoints + (newBadges.length * 25);
      }
      
      await storage.updateUserGamification(userId, updates);
      
      res.json({
        pointsEarned,
        totalPoints: updates.totalPoints,
        newBadges,
        streak: updates.currentStreak || user.currentStreak,
      });
    } catch (error) {
      console.error("Gamification update error:", error);
      res.status(500).json({ message: "Failed to update gamification" });
    }
  });

  // Stripe routes
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Failed to get publishable key:", error);
      res.status(500).json({ message: "Failed to get Stripe configuration" });
    }
  });

  app.get("/api/stripe/products", async (req, res) => {
    try {
      const rows = await stripeStorage.listProductsWithPrices();
      const productsMap = new Map();
      
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
          });
        }
      }
      
      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Failed to list products:", error);
      res.status(500).json({ message: "Failed to list products" });
    }
  });

  app.post("/api/stripe/create-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ message: "Price ID required" });
      }

      // Validate priceId against allowed Verde Pro prices
      const verdeProProductId = process.env.VERDE_PRO_PRODUCT_ID;
      
      // Fail closed: require product ID to be configured
      if (!verdeProProductId) {
        console.error("VERDE_PRO_PRODUCT_ID not configured - rejecting checkout");
        return res.status(500).json({ message: "Subscription checkout not available - configuration error" });
      }
      
      // Always validate price against Stripe - regardless of allowlist
      const price = await stripeStorage.getPrice(priceId);
      
      if (!price || !price.active) {
        return res.status(400).json({ message: "Invalid or inactive price ID" });
      }
      
      // Ensure the price belongs to the Verde Pro product (Stripe uses 'product' field)
      if (price.product !== verdeProProductId) {
        console.warn(`Price ${priceId} belongs to product ${price.product}, not Verde Pro ${verdeProProductId}`);
        return res.status(400).json({ message: "Price does not belong to Verde Pro product" });
      }
      
      // Ensure it's a recurring subscription price (Stripe uses 'type' field or 'recurring' object)
      if (price.type !== 'recurring' && !price.recurring) {
        return res.status(400).json({ message: "Invalid price type - must be recurring subscription" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          user.email || `${userId}@verde.app`,
          userId
        );
        await storage.updateUserSubscription(userId, {
          tier: 'free',
          stripeCustomerId: customer.id,
        });
        customerId = customer.id;
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/?checkout=success`,
        `${baseUrl}/?checkout=cancelled`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Checkout session error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/create-portal-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserById(userId);
      
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No active subscription" });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Portal session error:", error);
      res.status(500).json({ message: "Failed to create portal session" });
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
