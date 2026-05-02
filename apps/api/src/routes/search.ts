import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { searchPapers } from '../services/search.js'

export const searchRoute = new Hono()

const searchSchema = z.object({
    query: z.string().min(1).max(200),
    limit: z.number().min(1).max(20).optional().default(10),
})

searchRoute.post('/', zValidator('json', searchSchema), async (c) => {
    const { query, limit } = c.req.valid('json')
    const results = await searchPapers(query, limit)
    return c.json(results)
})