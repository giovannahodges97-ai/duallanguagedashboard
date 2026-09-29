import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scheduleItems = pgTable("schedule_items", {
  id: text("id").primaryKey(),
  time: text("time").notNull(),
  spanish: text("spanish").notNull(),
  english: text("english").notNull(),
  position: integer("position").notNull().default(0),
});

export const videos = pgTable("videos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  position: integer("position").notNull().default(0),
});
