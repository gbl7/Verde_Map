import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export chat models from integration if needed, but for now we focus on pins
// export * from "./models/chat"; 

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

export const analysisResponseSchema = z.object({
  location: z.string(),
  summary: z.string(),
  scores: z.object({
    airQuality: z.number(),
    waterQuality: z.number(),
    walkability: z.number(),
    greenSpace: z.number(),
    pollution: z.number(), // This might be "negative factors" score, let's say 0-100 where 100 is bad or good? Let's say 0-100 where 100 is CLEAN (low pollution). Or 100 is HIGH pollution?
    // Let's make all scores "Quality" scores (0-100, 100 is best).
    // So "Pollution" -> "Cleanliness"? Or just "Pollution" where 0 is good? 
    // The prompt says "negative factors like pollution sources". 
    // Let's stick to "environmental vibe". 
    // Scores: 0-100. 
    // Air Quality: 100 = Excellent.
    // Water Quality: 100 = Excellent.
    // Walkability: 100 = Walker's Paradise.
    // Green Space: 100 = Very Green.
    // Overall Vibe: 100 = Perfect.
  }),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
