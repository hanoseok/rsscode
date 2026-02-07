import { beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";

const testDbPath = ":memory:";
const sqlite = new Database(testDbPath);

export const testDb = drizzle(sqlite, { schema });

beforeAll(() => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      UNIQUE(workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      profile_image TEXT,
      webhook_url TEXT,
      webhook_channel_id TEXT,
      webhook_guild_id TEXT,
      webhook_name TEXT,
      message_template TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_checked_at INTEGER,
      last_checked_title TEXT,
      last_sent_at INTEGER,
      last_sent_title TEXT
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

    CREATE TABLE IF NOT EXISTS workspace_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      discord_client_id TEXT,
      discord_client_secret TEXT,
      check_interval_minutes INTEGER NOT NULL DEFAULT 10
    );
  `);
});

beforeEach(() => {
  sqlite.exec("DELETE FROM posts");
  sqlite.exec("DELETE FROM feeds");
  sqlite.exec("DELETE FROM workspace_settings");
  sqlite.exec("DELETE FROM workspace_members");
  sqlite.exec("DELETE FROM workspaces");
  sqlite.exec("DELETE FROM users");
});

afterAll(() => {
  sqlite.close();
});
