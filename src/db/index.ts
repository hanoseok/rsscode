import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_URL || "./data/rsscode.db";

const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      profile_image TEXT,
      webhook_url TEXT,
      webhook_channel_id TEXT,
      webhook_guild_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_checked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      guid TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      published_at INTEGER,
      sent_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(feed_id, guid)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_feed_id ON posts(feed_id);
    CREATE INDEX IF NOT EXISTS idx_posts_guid ON posts(guid);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const migrations = [
    "ALTER TABLE feeds ADD COLUMN webhook_url TEXT",
    "ALTER TABLE feeds ADD COLUMN webhook_channel_id TEXT",
    "ALTER TABLE feeds ADD COLUMN webhook_guild_id TEXT",
    "ALTER TABLE feeds ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1",
  ];

  for (const sql of migrations) {
    try {
      sqlite.exec(sql);
    } catch {
    }
  }

  console.log("Database initialized");
}
