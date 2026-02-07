import express from "express";
import cors from "cors";
import { Router } from "express";
import { testDb } from "./setup.js";
import { feeds, workspaceSettings } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());

const createFeedSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  profileImage: z.string().url().optional(),
});

const feedsRouter = Router();

feedsRouter.get("/", async (_req, res) => {
  const allFeeds = await testDb.select().from(feeds);
  res.json(allFeeds);
});

feedsRouter.post("/", async (req, res) => {
  const parsed = createFeedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors });
    return;
  }

  try {
    const result = await testDb
      .insert(feeds)
      .values({
        name: parsed.data.name,
        url: parsed.data.url,
        profileImage: parsed.data.profileImage,
      })
      .returning();

    res.status(201).json(result[0]);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      res.status(409).json({ error: "Feed URL already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create feed" });
  }
});

feedsRouter.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const result = await testDb.delete(feeds).where(eq(feeds.id, id)).returning();

  if (result.length === 0) {
    res.status(404).json({ error: "Feed not found" });
    return;
  }
  res.status(204).send();
});

const settingsRouter = Router();

settingsRouter.get("/", async (req, res) => {
  const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : 1;
  const settings = await testDb.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).get();
  
  if (!settings) {
    res.json({
      discord_client_id: "",
      discord_client_secret: "",
      check_interval_minutes: 10,
    });
    return;
  }

  res.json({
    discord_client_id: settings.discordClientId || "",
    discord_client_secret: settings.discordClientSecret ? "••••••••" : "",
    check_interval_minutes: settings.checkIntervalMinutes || 10,
  });
});

settingsRouter.put("/", async (req, res) => {
  const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : req.body.workspaceId || 1;
  const { discord_client_id, discord_client_secret, check_interval_minutes } = req.body;

  const existing = await testDb.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).get();

  if (existing) {
    const updateData: Record<string, unknown> = {};
    if (discord_client_id !== undefined) updateData.discordClientId = discord_client_id;
    if (discord_client_secret !== undefined && discord_client_secret !== "••••••••") {
      updateData.discordClientSecret = discord_client_secret;
    }
    if (check_interval_minutes !== undefined) updateData.checkIntervalMinutes = check_interval_minutes;
    
    await testDb.update(workspaceSettings).set(updateData).where(eq(workspaceSettings.workspaceId, workspaceId));
  } else {
    await testDb.insert(workspaceSettings).values({
      workspaceId,
      discordClientId: discord_client_id || null,
      discordClientSecret: discord_client_secret || null,
      checkIntervalMinutes: check_interval_minutes || 10,
    });
  }

  res.json({ success: true });
});

app.use("/api/feeds", feedsRouter);
app.use("/api/settings", settingsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export { app };
