import './polyfill.js'
import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { ingestRoute } from './routes/ingest.js'
import { queryRoute } from './routes/query.js'
import { papersRoute } from './routes/papers.js'
import { searchRoute } from './routes/search.js'
import { fetchPaperRoute } from './routes/fetch-paper.js'
import { notesRoute } from './routes/notes.js'
import { sessionsRoute } from './routes/sessions.js'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))
app.route('/ingest', ingestRoute)
app.route('/query', queryRoute)
app.route('/papers', papersRoute)
app.route('/search', searchRoute)
app.route('/fetch-paper', fetchPaperRoute)
app.route('/notes', notesRoute)
app.route('/sessions', sessionsRoute)

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('API running on http://localhost:3001')
})