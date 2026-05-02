import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema.js'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'

const dbUrl = process.env.DATABASE_URL ?? './rag.db'
const dbPath = dbUrl.startsWith('file:') ? dbUrl.slice(5) : dbUrl

// Ensure data directory exists
if (dbPath !== ':memory:') {
  await mkdir(dirname(dbPath), { recursive: true }).catch(() => { })
}

const client = createClient({
  url: `file:${dbPath}`,
})

export const db = drizzle(client, { schema })
