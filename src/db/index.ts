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

    CREATE TABLE IF NOT EXISTS workspace_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      discord_client_id TEXT,
      discord_client_secret TEXT,
      check_interval_minutes INTEGER NOT NULL DEFAULT 10,
      UNIQUE(workspace_id)
    );
  `);

  const migrations = [
    "ALTER TABLE feeds ADD COLUMN webhook_url TEXT",
    "ALTER TABLE feeds ADD COLUMN webhook_channel_id TEXT",
    "ALTER TABLE feeds ADD COLUMN webhook_guild_id TEXT",
    "ALTER TABLE feeds ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE feeds ADD COLUMN last_checked_title TEXT",
    "ALTER TABLE feeds ADD COLUMN last_sent_at INTEGER",
    "ALTER TABLE feeds ADD COLUMN last_sent_title TEXT",
    "ALTER TABLE feeds ADD COLUMN webhook_name TEXT",
    "ALTER TABLE feeds ADD COLUMN message_template TEXT",
    "ALTER TABLE feeds ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE",
  ];

  for (const sql of migrations) {
    try {
      sqlite.exec(sql);
    } catch {
    }
  }

  initAdminAndMigrate();
  console.log("Database initialized");
}

async function initAdminAndMigrate() {
  const { hashPassword } = await import("../utils/auth.js");
  const { users, workspaces, feeds, workspaceSettings } = await import("./schema.js");
  const { eq, isNull } = await import("drizzle-orm");

  const existingAdmin = db.select().from(users).where(eq(users.username, "admin")).get();
  
  if (!existingAdmin) {
    const passwordHash = await hashPassword("admin");
    const adminResult = db.insert(users).values({
      username: "admin",
      passwordHash,
      isAdmin: true,
    }).returning().get();

    const workspaceResult = db.insert(workspaces).values({
      name: "my workspace",
      ownerId: adminResult.id,
    }).returning().get();

    db.insert(workspaceSettings).values({
      workspaceId: workspaceResult.id,
      checkIntervalMinutes: 10,
    }).run();

    db.update(feeds)
      .set({ workspaceId: workspaceResult.id })
      .where(isNull(feeds.workspaceId))
      .run();

    console.log("Admin user and default workspace created");
  } else {
    const existingWorkspace = db.select().from(workspaces).where(eq(workspaces.ownerId, existingAdmin.id)).get();
    if (existingWorkspace) {
      db.update(feeds)
        .set({ workspaceId: existingWorkspace.id })
        .where(isNull(feeds.workspaceId))
        .run();

      const existingSettings = db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, existingWorkspace.id)).get();
      if (!existingSettings) {
        db.insert(workspaceSettings).values({
          workspaceId: existingWorkspace.id,
          checkIntervalMinutes: 10,
        }).run();
      }
    }
  }
}
