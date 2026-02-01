import { Router } from "express";
import Parser from "rss-parser";
import { db } from "../db/index.js";
import { feeds } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createFeedSchema, updateFeedSchema } from "../types/index.js";
import { sendToDiscord } from "../services/discord.js";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
  },
});

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const allFeeds = await db.select().from(feeds);
    res.json(allFeeds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch feeds" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const feed = await db.select().from(feeds).where(eq(feeds.id, id)).get();
    if (!feed) {
      res.status(404).json({ error: "Feed not found" });
      return;
    }
    res.json(feed);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = createFeedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const result = await db
      .insert(feeds)
      .values({
        name: parsed.data.name,
        url: parsed.data.url,
        profileImage: parsed.data.profileImage,
        webhookUrl: parsed.data.webhookUrl,
        webhookChannelId: parsed.data.webhookChannelId,
        webhookGuildId: parsed.data.webhookGuildId,
      })
      .returning();

    res.status(201).json(result[0]);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      res.status(409).json({ error: "Feed URL already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create feed" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = updateFeedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const result = await db
      .update(feeds)
      .set(parsed.data)
      .where(eq(feeds.id, id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "Feed not found" });
      return;
    }
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update feed" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await db
      .delete(feeds)
      .where(eq(feeds.id, id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "Feed not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete feed" });
  }
});

router.post("/:id/test", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const feed = await db.select().from(feeds).where(eq(feeds.id, id)).get();

    if (!feed) {
      res.status(404).json({ error: "Feed not found" });
      return;
    }

    if (!feed.webhookUrl) {
      res.status(400).json({ error: "Discord not connected for this feed" });
      return;
    }

    let rssFeed;
    try {
      rssFeed = await parser.parseURL(feed.url);
    } catch (rssError) {
      console.error("RSS fetch failed:", rssError);
      res.status(400).json({ error: `Failed to fetch RSS: ${feed.url}` });
      return;
    }

    const latestItem = rssFeed.items[0];

    if (!latestItem || !latestItem.title || !latestItem.link) {
      res.status(400).json({ error: "No valid items found in RSS feed" });
      return;
    }

    const sent = await sendToDiscord({
      webhookUrl: feed.webhookUrl,
      feedName: feed.name,
      profileImage: feed.profileImage,
      title: latestItem.title,
      link: latestItem.link,
      content: latestItem.contentSnippet,
    });

    if (sent) {
      res.json({ message: `Test message sent: "${latestItem.title}"` });
    } else {
      res.status(500).json({ error: "Failed to send to Discord. Check webhook URL." });
    }
  } catch (error) {
    console.error("Test send failed:", error);
    res.status(500).json({ error: "Unexpected error during test" });
  }
});

export default router;
