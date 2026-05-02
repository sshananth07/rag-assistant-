import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { streamText } from 'hono/streaming'
import { retrieveChunks } from '../services/retriever.js'
import { askGemini } from '../services/llm.js'
import { querySchema } from '../schema.js'

export const queryRoute = new Hono()

queryRoute.post(
  '/',
  zValidator('json', querySchema),
  async (c) => {
    const { question, paperIds, socratic } = c.req.valid('json')
    const chunks = await retrieveChunks(question, paperIds)

    const encoded = Buffer.from(JSON.stringify(chunks)).toString('base64')
    c.header('x-chunks', encoded)
    c.header('Access-Control-Expose-Headers', 'x-chunks')

    return streamText(c, async (stream) => {
      for await (const token of askGemini(question, chunks, socratic)) {
        await stream.write(token)
      }
    })
  }
)