import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Self-initializing schema — runs on first import
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      agent_slug TEXT NOT NULL,
      template_vars TEXT NOT NULL DEFAULT '{}',
      voip_base_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id),
      phone TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      extra_vars TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      call_uuid TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      call_uuid TEXT,
      destination TEXT,
      status TEXT,
      started_at TEXT,
      ended_at TEXT,
      duration_seconds INTEGER,
      turn_count INTEGER,
      end_reason TEXT,
      transcript TEXT,
      raw_cdr TEXT,
      created_at TEXT NOT NULL
    );
  `)
}

// Fire-and-forget on module load; queries will queue behind the pool connection
initSchema().catch(console.error)

export const db = drizzle(pool, { schema })
