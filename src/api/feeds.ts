import { Router } from "express";
import Parser from "rss-parser";
import { db } from "../db/index.js";
import { feeds, posts } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createFeedSchema, updateFeedSchema } from "../types/index.js";
import { sendToDiscord, applyTemplate } from "../services/discord.js";

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
        webhookName: parsed.data.webhookName,
        messageTemplate: parsed.data.messageTemplate,
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

router.post("/preview-rss", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    let rssFeed;
    try {
      rssFeed = await parser.parseURL(url);
    } catch (rssError) {
      console.error("RSS fetch failed:", rssError);
      res.status(400).json({ error: `Failed to fetch RSS: ${url}` });
      return;
    }

    const latestItem = rssFeed.items[0];
    if (!latestItem) {
      res.status(400).json({ error: "No items found in RSS feed" });
      return;
    }

    const sample: Record<string, string> = {};
    const fields: string[] = [];

    if (latestItem.title) {
      fields.push("title");
      sample.title = latestItem.title;
    }
    if (latestItem.link) {
      fields.push("link");
      sample.link = latestItem.link;
    }
    if (latestItem.contentSnippet) {
      fields.push("description");
      sample.description = latestItem.contentSnippet.slice(0, 200);
    }
    if (latestItem.content) {
      fields.push("content");
      sample.content = latestItem.content.slice(0, 500);
    }
    if (latestItem.pubDate) {
      fields.push("pubDate");
      sample.pubDate = latestItem.pubDate;
    }
    if (latestItem.isoDate) {
      fields.push("isoDate");
      sample.isoDate = latestItem.isoDate;
    }
    if (latestItem.creator) {
      fields.push("author");
      sample.author = latestItem.creator;
    }
    if (latestItem.categories && latestItem.categories.length > 0) {
      fields.push("categories");
      sample.categories = latestItem.categories.join(", ");
    }

    res.json({ fields, sample });
  } catch (error) {
    console.error("Preview RSS failed:", error);
    res.status(500).json({ error: "Failed to preview RSS feed" });
  }
});

router.get("/:id/preview", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const feed = await db.select().from(feeds).where(eq(feeds.id, id)).get();

    if (!feed) {
      res.status(404).json({ error: "Feed not found" });
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

    const rssItem = {
      title: latestItem.title,
      link: latestItem.link,
      description: latestItem.contentSnippet,
      content: latestItem.content,
      pubDate: latestItem.pubDate,
      isoDate: latestItem.isoDate,
      author: latestItem.creator,
      categories: latestItem.categories?.join(", "),
    };

    const defaultTemplate = "{title}\n{link}";
    const template = feed.messageTemplate || defaultTemplate;
    const content = applyTemplate(template, rssItem);

    res.json({
      feedName: feed.name,
      profileImage: feed.profileImage,
      webhookName: feed.webhookName,
      content,
      rssItem,
    });
  } catch (error) {
    console.error("Preview failed:", error);
    res.status(500).json({ error: "Failed to generate preview" });
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
      messageTemplate: feed.messageTemplate,
      rssItem: {
        title: latestItem.title,
        link: latestItem.link,
        description: latestItem.contentSnippet,
        content: latestItem.content,
        pubDate: latestItem.pubDate,
        isoDate: latestItem.isoDate,
        author: latestItem.creator,
        categories: latestItem.categories?.join(", "),
      },
    });

    if (sent) {
      const guid = latestItem.guid || latestItem.link;
      const publishedAt = latestItem.isoDate
        ? new Date(latestItem.isoDate)
        : latestItem.pubDate
          ? new Date(latestItem.pubDate)
          : undefined;

      await db
        .insert(posts)
        .values({
          feedId: feed.id,
          guid: guid!,
          title: latestItem.title,
          link: latestItem.link,
          publishedAt,
        })
        .onConflictDoNothing();

      const now = new Date();
      await db
        .update(feeds)
        .set({
          lastCheckedAt: now,
          lastCheckedTitle: latestItem.title,
          lastSentAt: now,
          lastSentTitle: latestItem.title,
        })
        .where(eq(feeds.id, id));

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
