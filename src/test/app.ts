import express from "express";
import cors from "cors";
import { Router } from "express";
import { testDb } from "./setup.js";
import { feeds, settings } from "../db/schema.js";
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

settingsRouter.get("/", async (_req, res) => {
  const rows = await testDb.select().from(settings);
  const result: Record<string, string | null> = {};
  
  for (const row of rows) {
    if (row.key === "discord_client_secret" && row.value) {
      result[row.key] = "••••••••";
    } else {
      result[row.key] = row.value;
    }
  }
  
  res.json(result);
});

settingsRouter.put("/", async (req, res) => {
  const { discord_client_id, discord_client_secret } = req.body;

  if (discord_client_id !== undefined) {
    await testDb
      .insert(settings)
      .values({ key: "discord_client_id", value: discord_client_id })
      .onConflictDoUpdate({ target: settings.key, set: { value: discord_client_id } });
  }

  if (discord_client_secret !== undefined && discord_client_secret !== "••••••••") {
    await testDb
      .insert(settings)
      .values({ key: "discord_client_secret", value: discord_client_secret })
      .onConflictDoUpdate({ target: settings.key, set: { value: discord_client_secret } });
  }

  res.json({ success: true });
});

app.use("/api/feeds", feedsRouter);
app.use("/api/settings", settingsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export { app };
