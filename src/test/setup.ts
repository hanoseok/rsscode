import { beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";

const testDbPath = ":memory:";
const sqlite = new Database(testDbPath);

export const testDb = drizzle(sqlite, { schema });

beforeAll(() => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      profile_image TEXT,
      webhook_url TEXT,
      webhook_channel_id TEXT,
      webhook_guild_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_checked_at INTEGER,
      last_checked_title TEXT
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
});

beforeEach(() => {
  sqlite.exec("DELETE FROM posts");
  sqlite.exec("DELETE FROM feeds");
  sqlite.exec("DELETE FROM settings");
});

afterAll(() => {
  sqlite.close();
});
