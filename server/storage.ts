import { db } from "./db";
import { pins, emailSubscribers, users, type InsertPin, type Pin, type InsertEmailSubscriber, type EmailSubscriber, type User } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getPins(): Promise<Pin[]>;
  createPin(pin: InsertPin): Promise<Pin>;
  createEmailSubscriber(subscriber: InsertEmailSubscriber): Promise<EmailSubscriber>;
  getEmailSubscriberByEmail(email: string): Promise<EmailSubscriber | null>;
  getUserById(id: string): Promise<User | null>;
  resetDailyAnalysisCount(userId: string): Promise<void>;
  incrementAnalysisCount(userId: string): Promise<void>;
  updateUserGamification(userId: string, updates: Partial<User>): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getPins(): Promise<Pin[]> {
    return await db.select().from(pins);
  }

  async createPin(insertPin: InsertPin): Promise<Pin> {
    const [pin] = await db.insert(pins).values(insertPin).returning();
    return pin;
  }

  async createEmailSubscriber(subscriber: InsertEmailSubscriber): Promise<EmailSubscriber> {
    const [sub] = await db.insert(emailSubscribers).values(subscriber).returning();
    return sub;
  }

  async getEmailSubscriberByEmail(email: string): Promise<EmailSubscriber | null> {
    const results = await db.select().from(emailSubscribers).where(eq(emailSubscribers.email, email));
    return results[0] || null;
  }

  async getUserById(id: string): Promise<User | null> {
    const results = await db.select().from(users).where(eq(users.id, id));
    return results[0] || null;
  }

  async resetDailyAnalysisCount(userId: string): Promise<void> {
    await db.update(users)
      .set({ dailyAnalysisCount: 0, lastAnalysisDate: new Date() })
      .where(eq(users.id, userId));
  }

  async incrementAnalysisCount(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (user) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastAnalysis = user.lastAnalysisDate ? new Date(user.lastAnalysisDate) : null;
      
      let newCount = 1;
      if (lastAnalysis && lastAnalysis >= today) {
        newCount = (user.dailyAnalysisCount || 0) + 1;
      }
      
      await db.update(users)
        .set({ dailyAnalysisCount: newCount, lastAnalysisDate: new Date() })
        .where(eq(users.id, userId));
    }
  }

  async updateUserGamification(userId: string, updates: Partial<User>): Promise<void> {
    await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

}

export const storage = new DatabaseStorage();
