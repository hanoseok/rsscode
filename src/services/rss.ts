import Parser from "rss-parser";
import { db } from "../db/index.js";
import { feeds, posts, type Feed } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { sendToDiscord } from "./discord.js";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
  },
});

interface RSSItem {
  guid?: string;
  link?: string;
  title?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
}

export async function checkFeed(feed: Feed): Promise<number> {
  if (!feed.enabled || !feed.webhookUrl) {
    return 0;
  }

  try {
    const rssFeed = await parser.parseURL(feed.url);
    let newPostCount = 0;
    const latestTitle = (rssFeed.items[0] as RSSItem)?.title || null;

    for (const item of rssFeed.items as RSSItem[]) {
      const guid = item.guid || item.link;
      if (!guid || !item.title || !item.link) continue;

      const existingPost = await db
        .select()
        .from(posts)
        .where(and(eq(posts.feedId, feed.id), eq(posts.guid, guid)))
        .get();

      if (existingPost) continue;

      const publishedAt = item.isoDate
        ? new Date(item.isoDate)
        : item.pubDate
          ? new Date(item.pubDate)
          : undefined;

      const sent = await sendToDiscord({
        webhookUrl: feed.webhookUrl,
        feedName: feed.name,
        profileImage: feed.profileImage,
        title: item.title,
        link: item.link,
        content: item.contentSnippet,
      });

      if (sent) {
        await db.insert(posts).values({
          feedId: feed.id,
          guid,
          title: item.title,
          link: item.link,
          publishedAt,
        });

        newPostCount++;
      }
    }

    await db
      .update(feeds)
      .set({ lastCheckedAt: new Date(), lastCheckedTitle: latestTitle })
      .where(eq(feeds.id, feed.id));

    return newPostCount;
  } catch (error) {
    console.error(`Failed to check feed ${feed.name}:`, error);
    return 0;
  }
}

export async function checkAllFeeds(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Checking all feeds...`);
  const allFeeds = await db.select().from(feeds);
  const enabledFeeds = allFeeds.filter((f) => f.enabled);

  let totalNew = 0;
  for (const feed of enabledFeeds) {
    const newCount = await checkFeed(feed);
    totalNew += newCount;
    if (newCount > 0) {
      console.log(`  ${feed.name}: ${newCount} new posts`);
    }
  }

  console.log(
    `  Total: ${totalNew} new posts from ${enabledFeeds.length} enabled feeds (${allFeeds.length - enabledFeeds.length} disabled)`
  );
}
