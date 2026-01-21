import { db } from "./db";
import { pins, type InsertPin, type Pin } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getPins(): Promise<Pin[]>;
  createPin(pin: InsertPin): Promise<Pin>;
}

export class DatabaseStorage implements IStorage {
  async getPins(): Promise<Pin[]> {
    return await db.select().from(pins);
  }

  async createPin(insertPin: InsertPin): Promise<Pin> {
    const [pin] = await db.insert(pins).values(insertPin).returning();
    return pin;
  }
}

export const storage = new DatabaseStorage();
