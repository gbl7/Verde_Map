import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Subscription fields
  subscriptionTier: varchar("subscription_tier").default("free"), // 'free' or 'pro'
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status").default("active"), // 'active', 'cancelled', 'past_due'
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  
  // Usage tracking (resets daily)
  dailyAnalysisCount: integer("daily_analysis_count").default(0),
  lastAnalysisDate: timestamp("last_analysis_date"),
  
  // Gamification data (migrated from localStorage)
  totalPoints: integer("total_points").default(0),
  pinsDropped: integer("pins_dropped").default(0),
  locationsExplored: integer("locations_explored").default(0),
  currentStreak: integer("current_streak").default(0),
  lastActivityDate: timestamp("last_activity_date"),
  badges: jsonb("badges").default([]),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
