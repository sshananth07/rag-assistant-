import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const papers = sqliteTable('papers', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  title: text('title'),
  chunkCount: integer('chunk_count').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().default(''),
  answer: text('answer').notNull(),
  chunks: text('chunks').notNull(),
  paperIds: text('paper_ids').notNull(),
  question: text('question').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  name: text('name'),
  createdAt: integer('created_at').notNull(),
  lastActiveAt: integer('last_active_at').notNull(),
})

export const sessionMessages = sqliteTable('session_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  chunks: text('chunks').notNull().default('[]'),
  createdAt: integer('created_at').notNull(),
})

export const sessionState = sqliteTable('session_state', {
  sessionId: text('session_id').primaryKey(),
  selectedPaperIds: text('selected_paper_ids').notNull().default('[]'),
  socraticMode: integer('socratic_mode').notNull().default(0),
  ingestedPapers: text('ingested_papers').notNull().default('[]'),
}) 