import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sessions, sessionMessages, sessionState } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'

export const sessionsRoute = new Hono()

// Create a new session
sessionsRoute.post('/', async (c) => {
    const id = crypto.randomUUID()
    const now = Date.now()

    await db.insert(sessions).values({ id, createdAt: now, lastActiveAt: now })
    await db.insert(sessionState).values({
        sessionId: id,
        selectedPaperIds: '[]',
        socraticMode: 0,
    })

    return c.json({ id, createdAt: now, lastActiveAt: now })
})

// Get full session — messages + state
sessionsRoute.get('/:id', async (c) => {
    const id = c.req.param('id')

    const session = await db.select().from(sessions).where(eq(sessions.id, id))
    if (session.length === 0) return c.json({ error: 'Session not found' }, 404)

    const messages = await db
        .select()
        .from(sessionMessages)
        .where(eq(sessionMessages.sessionId, id))
        .orderBy(sessionMessages.createdAt)

    const state = await db
        .select()
        .from(sessionState)
        .where(eq(sessionState.sessionId, id))

    return c.json({
        ...session[0],
        messages: messages.map(m => ({
            ...m,
            chunks: JSON.parse(m.chunks),
        })),
        state: state[0] ? {
            selectedPaperIds: JSON.parse(state[0].selectedPaperIds),
            socraticMode: state[0].socraticMode === 1,
            ingestedPapers: JSON.parse(state[0].ingestedPapers ?? '[]'),
        } : { selectedPaperIds: [], socraticMode: false, ingestedPapers: [] },
    })
})

// Add a message to session
sessionsRoute.post('/:id/messages', zValidator('json', z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    chunks: z.array(z.any()).optional().default([]),
})), async (c) => {
    const sessionId = c.req.param('id')
    const { role, content, chunks } = c.req.valid('json')
    const now = Date.now()

    const msg = {
        id: crypto.randomUUID(),
        sessionId,
        role,
        content,
        chunks: JSON.stringify(chunks),
        createdAt: now,
    }

    await db.insert(sessionMessages).values(msg)
    await db.update(sessions)
        .set({ lastActiveAt: now })
        .where(eq(sessions.id, sessionId))

    return c.json({ id: msg.id, status: 'saved' })
})

// Update session state
sessionsRoute.patch('/:id/state', zValidator('json', z.object({
    selectedPaperIds: z.array(z.string()).optional(),
    socraticMode: z.boolean().optional(),
    ingestedPapers: z.array(z.object({
        paperId: z.string(),
        filename: z.string(),
        chunkCount: z.number(),
    })).optional(),
})), async (c) => {
    const sessionId = c.req.param('id')
    const body = c.req.valid('json')

    const current = await db
        .select()
        .from(sessionState)
        .where(eq(sessionState.sessionId, sessionId))

    if (current.length === 0) return c.json({ error: 'Session not found' }, 404)

    const updates: Partial<typeof sessionState.$inferInsert> = {}
    if (body.selectedPaperIds !== undefined) {
        updates.selectedPaperIds = JSON.stringify(body.selectedPaperIds)
    }
    if (body.socraticMode !== undefined) {
        updates.socraticMode = body.socraticMode ? 1 : 0
    }
    if (body.ingestedPapers !== undefined) {
        updates.ingestedPapers = JSON.stringify(body.ingestedPapers)
    }

    await db.update(sessionState)
        .set(updates)
        .where(eq(sessionState.sessionId, sessionId))

    await db.update(sessions)
        .set({ lastActiveAt: Date.now() })
        .where(eq(sessions.id, sessionId))

    return c.json({ status: 'updated' })
})

// Delete a session and all its messages
sessionsRoute.delete('/:id', async (c) => {
    const id = c.req.param('id')
    await db.delete(sessionMessages).where(eq(sessionMessages.sessionId, id))
    await db.delete(sessionState).where(eq(sessionState.sessionId, id))
    await db.delete(sessions).where(eq(sessions.id, id))
    return c.json({ status: 'deleted' })
})

// List all sessions (for session switcher later)
sessionsRoute.get('/', async (c) => {
    const page = parseInt(c.req.query('page') ?? '1')
    const limit = parseInt(c.req.query('limit') ?? '10')
    const offset = (page - 1) * limit

    const all = await db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.lastActiveAt))
        .limit(limit)
        .offset(offset)

    const withCounts = await Promise.all(all.map(async session => {
        const msgs = await db
            .select()
            .from(sessionMessages)
            .where(eq(sessionMessages.sessionId, session.id))

        const state = await db
            .select()
            .from(sessionState)
            .where(eq(sessionState.sessionId, session.id))

        const papers = state[0] ? JSON.parse(state[0].ingestedPapers ?? '[]') : []
        const firstUserMsg = msgs.find(m => m.role === 'user')

        return {
            ...session,
            messageCount: msgs.length,
            paperCount: papers.length,
            preview: firstUserMsg?.content?.slice(0, 60) ?? 'Empty session',
        }
    }))

    // Get total count
    const total = await db.select().from(sessions)

    return c.json({
        sessions: withCounts,
        pagination: {
            page,
            limit,
            total: total.length,
            hasMore: offset + limit < total.length,
        }
    })
})