import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

function getDbPath(): string {
  const url = process.env.DATABASE_URL || 'file:./data/campaign-manager.db'
  // Strip "file:" prefix
  const filePath = url.replace(/^file:/, '')
  // Resolve relative to cwd
  return path.resolve(process.cwd(), filePath)
}

function initDb() {
  const dbPath = getDbPath()
  // Ensure directory exists
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const sqlite = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL')

  // Self-initializing schema — no drizzle migrations needed at runtime
  sqlite.exec(`
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

  return drizzle(sqlite, { schema })
}

// Singleton for module-level caching
let _db: ReturnType<typeof initDb> | null = null

export function getDb() {
  if (!_db) {
    _db = initDb()
  }
  return _db
}

export const db = getDb()
