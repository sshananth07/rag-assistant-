import { Hono } from 'hono'
import { db } from '../db/index.js'
import { papers } from '../db/schema.js'
import { desc, eq } from 'drizzle-orm'
import { QdrantClient } from '@qdrant/js-client-rest'

const qdrant = new QdrantClient({ url: process.env.QDRANT_URL ?? 'http://localhost:6333' })

export const papersRoute = new Hono()

papersRoute.get('/', async (c) => {
  const rows = await db.select().from(papers).orderBy(desc(papers.createdAt))
  return c.json(rows)
})

papersRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')

  // Delete all chunks from Qdrant
  await qdrant.delete('papers', {
    filter: {
      must: [{ key: 'paperId', match: { value: id } }],
    },
  })

  // Delete from SQLite
  await db.delete(papers).where(eq(papers.id, id))

  return c.json({ status: 'deleted' })
})
