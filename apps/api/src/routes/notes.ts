import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { notes } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'
import { generateExport } from '../services/exporter.js'

export const notesRoute = new Hono()

const saveNoteSchema = z.object({
    sessionId: z.string().min(1),
    question: z.string().min(1),
    answer: z.string().min(1),
    chunks: z.array(z.object({
        id: z.string(),
        text: z.string(),
        filename: z.string(),
        section: z.string(),
        pageEstimate: z.number(),
        score: z.number(),
    })),
    paperIds: z.array(z.string()),
})

notesRoute.post('/', zValidator('json', saveNoteSchema), async (c) => {
    const body = c.req.valid('json')
    const note = {
        id: crypto.randomUUID(),
        sessionId: body.sessionId,
        question: body.question,
        answer: body.answer,
        chunks: JSON.stringify(body.chunks),
        paperIds: JSON.stringify(body.paperIds),
        createdAt: Date.now(),
    }
    await db.insert(notes).values(note)
    return c.json({ id: note.id, status: 'saved' })
})

// Get notes by session
notesRoute.get('/', async (c) => {
    const sessionId = c.req.query('sessionId')
    const page = parseInt(c.req.query('page') ?? '1')
    const limit = parseInt(c.req.query('limit') ?? '10')
    const offset = (page - 1) * limit

    const baseQuery = sessionId
        ? db.select().from(notes).where(eq(notes.sessionId, sessionId))
        : db.select().from(notes)

    const rows = await db
        .select()
        .from(notes)
        .where(sessionId ? eq(notes.sessionId, sessionId) : undefined)
        .orderBy(desc(notes.createdAt))
        .limit(limit)
        .offset(offset)

    const allRows = await db
        .select()
        .from(notes)
        .where(sessionId ? eq(notes.sessionId, sessionId) : undefined)

    return c.json({
        notes: rows.map(r => ({
            ...r,
            chunks: JSON.parse(r.chunks),
            paperIds: JSON.parse(r.paperIds),
        })),
        pagination: {
            page,
            limit,
            total: allRows.length,
            hasMore: offset + limit < allRows.length,
        }
    })
})

notesRoute.delete('/:id', async (c) => {
    const id = c.req.param('id')
    await db.delete(notes).where(eq(notes.id, id))
    return c.json({ status: 'deleted' })
})

notesRoute.post('/export', async (c) => {
    const sessionId = c.req.query('sessionId')

    const query = sessionId
        ? db.select().from(notes).where(eq(notes.sessionId, sessionId)).orderBy(desc(notes.createdAt))
        : db.select().from(notes).orderBy(desc(notes.createdAt))

    const rows = await query
    const parsed = rows.map(r => ({
        ...r,
        chunks: JSON.parse(r.chunks),
        paperIds: JSON.parse(r.paperIds),
    }))
    const uint8 = await generateExport(parsed)

    return new Response(uint8.buffer as ArrayBuffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': 'attachment; filename="research-notes.docx"',
        },
    })
})