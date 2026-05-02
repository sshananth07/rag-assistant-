import { migrate } from 'drizzle-orm/libsql/migrator'
import { db } from './index.js'

async function main() {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations done')
}

main().catch(console.error) 
