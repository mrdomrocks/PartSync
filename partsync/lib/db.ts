import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'each',
  quantity REAL NOT NULL DEFAULT 0,
  low_stock_at REAL,
  supplier TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  alert_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_unit TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('out', 'in', 'set')),
  amount REAL NOT NULL,
  previous_quantity REAL NOT NULL,
  new_quantity REAL NOT NULL,
  person TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('item', 'digest', 'test')),
  item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('held', 'sent', 'failed', 'cancelled')),
  detail TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS items_name ON items (name);
CREATE INDEX IF NOT EXISTS movements_created_at ON movements (created_at DESC);
CREATE INDEX IF NOT EXISTS movements_item_id ON movements (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_status ON messages (status, created_at DESC);
`;

export function openDatabase(filename: string): Database.Database {
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}

const globalForDb = globalThis as unknown as { partSyncDb?: Database.Database };

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "partsync.db");
}

export function getDb(): Database.Database {
  if (!globalForDb.partSyncDb) {
    const file = databasePath();
    if (file !== ":memory:") {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    globalForDb.partSyncDb = openDatabase(file);
  }
  return globalForDb.partSyncDb;
}
