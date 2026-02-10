// Database Schema - Drizzle ORM
// PostgreSQL schema for MEP Take-Off Analyzer

import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('passwordHash', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  firm: varchar('firm', { length: 255 }),
  role: varchar('role', { length: 20 }).default('user').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Projects table
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Take-offs table
export const takeoffs = pgTable('takeoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('projectId').references(() => projects.id).notNull(),
  version: integer('version').notNull().default(1),
  fileName: varchar('fileName', { length: 500 }).notNull(),
  fileHash: varchar('fileHash', { length: 32 }).notNull(),
  fileSize: integer('fileSize').notNull(),
  pageCount: integer('pageCount').notNull(),
  extractedData: jsonb('extractedData').notNull(), // Stores equipment array
  metadata: jsonb('metadata').notNull(), // { confidence, processingTime, etc }
  createdBy: uuid('createdBy').references(() => users.id).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Equipment table (normalized)
export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  takeoffId: uuid('takeoffId').references(() => takeoffs.id).notNull(),
  tag: varchar('tag', { length: 100 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  sizes: jsonb('sizes').default([]), // Array of size strings
  specsReferences: jsonb('specsReferences').default([]), // Array of spec refs
  rawText: text('rawText'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }).notNull(),
  pageNumber: integer('pageNumber').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Revisions/Deltas table
export const revisions = pgTable('revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('projectId').references(() => projects.id).notNull(),
  fromTakeoffId: uuid('fromTakeoffId').references(() => takeoffs.id),
  toTakeoffId: uuid('toTakeoffId').references(() => takeoffs.id),
  deltaData: jsonb('deltaData').notNull(), // Added/removed/changed equipment
  summary: jsonb('summary').notNull(), // Counts by category
  createdBy: uuid('createdBy').references(() => users.id).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// API Keys table (for integrations)
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId').references(() => users.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  keyHash: varchar('keyHash', { length: 64 }).notNull(),
  lastUsed: timestamp('lastUsed'),
  expiresAt: timestamp('expiresAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  takeoffs: many(takeoffs),
  apiKeys: many(apiKeys),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  takeoffs: many(takeoffs),
  revisions: many(revisions),
}));

export const takeoffsRelations = relations(takeoffs, ({ one, many }) => ({
  project: one(projects, {
    fields: [takeoffs.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [takeoffs.createdBy],
    references: [users.id],
  }),
  equipment: many(equipment),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  takeoff: one(takeoffs, {
    fields: [equipment.takeoffId],
    references: [takeoffs.id],
  }),
}));

export const revisionsRelations = relations(revisions, ({ one }) => ({
  project: one(projects, {
    fields: [revisions.projectId],
    references: [projects.id],
  }),
  fromTakeoff: one(takeoffs, {
    fields: [revisions.fromTakeoffId],
    references: [takeoffs.id],
  }),
  toTakeoff: one(takeoffs, {
    fields: [revisions.toTakeoffId],
    references: [takeoffs.id],
  }),
}));

// Indexes for performance
// create index idx_projects_user on projects(userId);
// create index idx_takeoffs_project on takeoffs(projectId);
// create index idx_equipment_takeoff on equipment(takeoffId);
// create index idx_equipment_tag on equipment(tag);
// create index idx_files_hash on takeoffs(fileHash);
