import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ingestPaper } from '../services/ingestor.js'
import { ingestSchema } from '../schema.js'
import { db } from '../db/index.js'
import { papers } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export const ingestRoute = new Hono()

ingestRoute.post(
  '/',
  zValidator('form', ingestSchema),
  async (c) => {
    try {
      const { file } = c.req.valid('form')

      // Check for duplicate filename
      const existing = await db
        .select()
        .from(papers)
        .where(eq(papers.filename, file.name))

      if (existing.length > 0) {
        return c.json({
          error: `"${file.name}" has already been ingested.`,
          duplicate: true,
          paperId: existing[0].id,
          chunkCount: existing[0].chunkCount,
        }, 409)
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await ingestPaper(buffer, file.name)
      return c.json(result)
    } catch (err) {
      console.error('Ingest error:', err)
      return c.json({ error: String(err) }, 500)
    }
  }
)