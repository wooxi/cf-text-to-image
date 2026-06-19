import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const keywordGroups = sqliteTable("keyword_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const keywords = sqliteTable("keywords", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => keywordGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const config = sqliteTable("config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const imageHistory = sqliteTable("image_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keywordNames: text("keyword_names").notNull(),
  prompt: text("prompt").notNull(),
  imagePath: text("image_path").notNull(),
  type: text("type").notNull().default("image"),
  posterPath: text("poster_path").notNull().default(""),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull().default("pending"),
  type: text("type").notNull().default("image"),
  keywordNames: text("keyword_names").notNull().default(""),
  prompt: text("prompt").notNull().default(""),
  imagePath: text("image_path").notNull().default(""),
  referenceImage: text("reference_image").notNull().default(""),
  videoPath: text("video_path").notNull().default(""),
  videoId: text("video_id").notNull().default(""),
  posterPath: text("poster_path").notNull().default(""),
  progress: integer("progress").notNull().default(0),
  size: text("size").notNull().default("1024x1024"),
  error: text("error").notNull().default(""),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});
