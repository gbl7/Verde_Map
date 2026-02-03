import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth models for Replit Auth
export * from "./models/auth"; 

export const pins = pgTable("pins", {
  id: serial("id").primaryKey(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  type: text("type").notNull(), // 'pollution', 'animal', 'trail', 'other'
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPinSchema = createInsertSchema(pins).omit({ id: true, createdAt: true });

export type Pin = typeof pins.$inferSelect;
export type InsertPin = z.infer<typeof insertPinSchema>;

// Email subscribers for air quality alerts
export const emailSubscribers = pgTable("email_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  locationName: text("location_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailSubscriberSchema = createInsertSchema(emailSubscribers).omit({ id: true, createdAt: true });

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type InsertEmailSubscriber = z.infer<typeof insertEmailSubscriberSchema>;

// Climate TRACE emissions sources cache
export const emissionsSources = pgTable("emissions_sources", {
  id: serial("id").primaryKey(),
  sourceId: text("source_id").notNull(), // Climate TRACE asset ID
  name: text("name").notNull(),
  country: text("country").notNull(), // ISO3 country code
  sector: text("sector").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  emissions: doublePrecision("emissions"), // CO2e tonnes/year
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertEmissionsSourceSchema = createInsertSchema(emissionsSources).omit({ id: true, lastUpdated: true });

export type EmissionsSource = typeof emissionsSources.$inferSelect;
export type InsertEmissionsSource = z.infer<typeof insertEmissionsSourceSchema>;

// Score detail schema for expandable rating information
export const scoreDetailSchema = z.object({
  value: z.number(),
  factors: z.array(z.string()),
  tips: z.array(z.string()).optional(),
});

export const analysisResponseSchema = z.object({
  location: z.string(),
  summary: z.string(),
  scores: z.object({
    airQuality: z.number(),
    waterQuality: z.number(),
    walkability: z.number(),
    greenSpace: z.number(),
    pollution: z.number(),
  }),
  scoreDetails: z.object({
    airQuality: scoreDetailSchema,
    waterQuality: scoreDetailSchema,
    walkability: scoreDetailSchema,
    greenSpace: scoreDetailSchema,
    pollution: scoreDetailSchema,
  }).optional(),
  epaContext: z.object({
    totalFacilities: z.number(),
    majorEmitters: z.number(),
    facilitiesWithViolations: z.number(),
    topIndustries: z.array(z.string()),
  }).nullable().optional(),
  aqiContext: z.object({
    aqi: z.number(),
    category: z.string(),
    station: z.string().nullable(),
    dominantPollutant: z.string().nullable(),
    lastUpdated: z.string().nullable(),
  }).nullable().optional(),
  climateTraceContext: z.object({
    sourcesCount: z.number(),
    totalEmissions: z.number(),
    totalEmissionsFormatted: z.string(),
    topSources: z.array(z.object({
      name: z.string(),
      sector: z.string(),
      emissions: z.number().nullable(),
      emissionsFormatted: z.string().nullable(),
    })),
    sectorBreakdown: z.array(z.object({
      sector: z.string(),
      count: z.number(),
      emissions: z.number(),
      emissionsFormatted: z.string(),
    })),
  }).nullable().optional(),
  landCoverContext: z.object({
    classes: z.array(z.object({
      classId: z.number(),
      name: z.string(),
      color: z.string(),
      count: z.number(),
      percentage: z.number(),
    })),
    dominantClass: z.string(),
    treePercentage: z.number(),
    builtPercentage: z.number(),
    waterPercentage: z.number(),
    cropPercentage: z.number(),
    vegetationPercentage: z.number(),
  }).nullable().optional(),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
