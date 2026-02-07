import { Router, Response } from "express";
import Parser from "rss-parser";
import { db } from "../db/index.js";
import { feeds, posts, workspaces, workspaceMembers } from "../db/schema.js";
import { eq, and, or, inArray } from "drizzle-orm";
import { createFeedSchema, updateFeedSchema } from "../types/index.js";
import { sendToDiscord, applyTemplate } from "../services/discord.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
  },
});

const router = Router();

router.use(requireAuth);

function getUserWorkspaceIds(userId: number): number[] {
  const owned = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerId, userId)).all();
  const member = db.select({ workspaceId: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).all();
  const ids = new Set([...owned.map(w => w.id), ...member.map(m => m.workspaceId)]);
  return Array.from(ids);
}

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);

    if (workspaceId) {
      if (!userWorkspaceIds.includes(workspaceId)) {
        res.status(403).json({ error: "Access denied to this workspace" });
        return;
      }
      const workspaceFeeds = db.select().from(feeds).where(eq(feeds.workspaceId, workspaceId)).all();
      res.json(workspaceFeeds);
    } else {
      if (userWorkspaceIds.length === 0) {
        res.json([]);
        return;
      }
      const allFeeds = db.select().from(feeds).where(inArray(feeds.workspaceId, userWorkspaceIds)).all();
      res.json(allFeeds);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch feeds" });
  }
});

router.get("/export", async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);

    let feedsToExport: typeof feeds.$inferSelect[] = [];
    if (workspaceId) {
      if (!userWorkspaceIds.includes(workspaceId)) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      feedsToExport = db.select().from(feeds).where(eq(feeds.workspaceId, workspaceId)).all();
    } else {
      if (userWorkspaceIds.length === 0) {
        feedsToExport = [];
      } else {
        feedsToExport = db.select().from(feeds).where(inArray(feeds.workspaceId, userWorkspaceIds)).all();
      }
    }
    const exportData = feedsToExport.map((f) => ({
      name: f.name,
      url: f.url,
      profileImage: f.profileImage,
      webhookUrl: f.webhookUrl,
      webhookChannelId: f.webhookChannelId,
      webhookGuildId: f.webhookGuildId,
      webhookName: f.webhookName,
      messageTemplate: f.messageTemplate,
      enabled: f.enabled,
    }));
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const filename = `rsscode_${yyyy}${mm}${dd}.json`;
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", "application/json");
    res.json(exportData);
  } catch (error) {
    console.error("Export failed:", error);
    res.status(500).json({ error: "Failed to export feeds" });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = parseInt(Array.isArray(idParam) ? idParam[0] : idParam);
    const feed = db.select().from(feeds).where(eq(feeds.id, id)).get();
    if (!feed) {
      res.status(404).json({ error: "Feed not found" });
      return;
    }
    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);
    if (feed.workspaceId && !userWorkspaceIds.includes(feed.workspaceId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    res.json(feed);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createFeedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const workspaceId = req.body.workspaceId;
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId is required" });
      return;
    }

    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);
    if (!userWorkspaceIds.includes(workspaceId)) {
      res.status(403).json({ error: "Access denied to this workspace" });
      return;
    }

    const result = db
      .insert(feeds)
      .values({
        workspaceId,
        name: parsed.data.name,
        url: parsed.data.url,
        profileImage: parsed.data.profileImage,
        webhookUrl: parsed.data.webhookUrl,
        webhookChannelId: parsed.data.webhookChannelId,
        webhookGuildId: parsed.data.webhookGuildId,
        webhookName: parsed.data.webhookName,
        messageTemplate: parsed.data.messageTemplate,
      })
      .returning()
      .get();

    res.status(201).json(result);
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

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = parseInt(Array.isArray(idParam) ? idParam[0] : idParam);
    
    const feed = db.select().from(feeds).where(eq(feeds.id, id)).get();
    if (!feed) {
      res.status(404).json({ error: "Feed not found" });
      return;
    }

    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);
    if (feed.workspaceId && !userWorkspaceIds.includes(feed.workspaceId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const parsed = updateFeedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const result = db
      .update(feeds)
      .set(parsed.data)
      .where(eq(feeds.id, id))
      .returning()
      .get();

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update feed" });
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = parseInt(Array.isArray(idParam) ? idParam[0] : idParam);
    
    const feed = db.select().from(feeds).where(eq(feeds.id, id)).get();
    if (!feed) {
      res.status(404).json({ error: "Feed not found" });
      return;
    }

    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);
    if (feed.workspaceId && !userWorkspaceIds.includes(feed.workspaceId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    db.delete(feeds).where(eq(feeds.id, id)).run();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete feed" });
  }
});

router.post("/import", async (req: AuthRequest, res: Response) => {
  try {
    const { feeds: importData, workspaceId } = req.body;
    if (!Array.isArray(importData)) {
      res.status(400).json({ error: "Invalid format: expected feeds array" });
      return;
    }
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId is required" });
      return;
    }

    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);
    if (!userWorkspaceIds.includes(workspaceId)) {
      res.status(403).json({ error: "Access denied to this workspace" });
      return;
    }

    let imported = 0;
    let skipped = 0;

    for (const item of importData) {
      const parsed = createFeedSchema.safeParse(item);
      if (!parsed.success) {
        skipped++;
        continue;
      }

      try {
        db.insert(feeds).values({
          workspaceId,
          name: parsed.data.name,
          url: parsed.data.url,
          profileImage: parsed.data.profileImage,
          webhookUrl: parsed.data.webhookUrl,
          webhookChannelId: parsed.data.webhookChannelId,
          webhookGuildId: parsed.data.webhookGuildId,
          webhookName: parsed.data.webhookName,
          messageTemplate: parsed.data.messageTemplate,
          enabled: parsed.data.enabled,
        }).run();
        imported++;
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
          skipped++;
        } else {
          skipped++;
        }
      }
    }

    res.json({ imported, skipped, total: importData.length });
  } catch (error) {
    console.error("Import failed:", error);
    res.status(500).json({ error: "Failed to import feeds" });
  }
});

router.post("/preview-rss", async (req: AuthRequest, res: Response) => {
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

router.get("/:id/preview", async (req: AuthRequest, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = parseInt(Array.isArray(idParam) ? idParam[0] : idParam);
    const feed = db.select().from(feeds).where(eq(feeds.id, id)).get();

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

    const defaultTemplate = "[{title}]({link})\n{description}";
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

router.post("/:id/test", async (req: AuthRequest, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = parseInt(Array.isArray(idParam) ? idParam[0] : idParam);
    const feed = db.select().from(feeds).where(eq(feeds.id, id)).get();

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
