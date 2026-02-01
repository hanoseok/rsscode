import { Router } from "express";
import { db } from "../db/index.js";
import { feeds } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getDiscordCredentials } from "./settings.js";

const router = Router();

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordTokenResponse {
  webhook?: {
    url: string;
    channel_id: string;
    guild_id: string;
    name?: string;
  };
}

interface WebhookInfo {
  name?: string;
  guild?: { name?: string };
  channel?: { name?: string };
}

async function fetchWebhookInfo(webhookUrl: string): Promise<string | null> {
  try {
    const res = await fetch(webhookUrl);
    if (!res.ok) return null;
    const data = await res.json() as WebhookInfo;
    return data.name || null;
  } catch {
    return null;
  }
}

function getRedirectUri(req: { protocol: string; get: (name: string) => string | undefined }) {
  const host = req.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol;
  return `${protocol}://${host}/api/discord/callback`;
}

router.get("/authorize", async (req, res) => {
  const { clientId } = await getDiscordCredentials();
  if (!clientId) {
    res.redirect("/?error=discord_not_configured");
    return;
  }

  const feedId = req.query.feedId as string | undefined;
  const redirectUri = encodeURIComponent(getRedirectUri(req));
  const state = Buffer.from(JSON.stringify({ feedId: feedId || null })).toString("base64url");

  const authUrl =
    `https://discord.com/oauth2/authorize?` +
    `client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=webhook.incoming` +
    `&state=${state}`;

  res.redirect(authUrl);
});

router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(`/?error=${encodeURIComponent(error as string)}`);
    return;
  }

  if (!code || !state) {
    res.redirect("/?error=missing_params");
    return;
  }

  let feedId: string | null;
  try {
    const decoded = JSON.parse(Buffer.from(state as string, "base64url").toString());
    feedId = decoded.feedId;
  } catch {
    res.redirect("/?error=invalid_state");
    return;
  }

  const { clientId, clientSecret } = await getDiscordCredentials();

  if (!clientId || !clientSecret) {
    res.redirect("/?error=discord_not_configured");
    return;
  }

  try {
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: getRedirectUri(req),
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("Token exchange failed:", err);
      res.redirect("/?error=token_exchange");
      return;
    }

    const tokenData = (await tokenResponse.json()) as DiscordTokenResponse;

    if (!tokenData.webhook) {
      res.redirect("/?error=no_webhook");
      return;
    }

    const { url, channel_id, guild_id } = tokenData.webhook;
    const webhookName = tokenData.webhook.name || await fetchWebhookInfo(url);

    if (feedId) {
      await db
        .update(feeds)
        .set({
          webhookUrl: url,
          webhookChannelId: channel_id,
          webhookGuildId: guild_id,
          webhookName: webhookName,
        })
        .where(eq(feeds.id, parseInt(feedId)));

      res.redirect("/?success=discord_connected");
    } else {
      const webhookData = encodeURIComponent(
        JSON.stringify({ url, channelId: channel_id, guildId: guild_id, name: webhookName })
      );
      res.redirect(`/?new_channel=${webhookData}`);
    }
  } catch (err) {
    console.error("Discord callback error:", err);
    res.redirect("/?error=callback_failed");
  }
});

router.get("/channels", async (_req, res) => {
  try {
    const allFeeds = await db.select().from(feeds);
    const channelMap = new Map<string, { webhookUrl: string; channelId: string; guildId: string; feedNames: string[] }>();

    for (const feed of allFeeds) {
      if (feed.webhookUrl && feed.webhookChannelId) {
        const existing = channelMap.get(feed.webhookChannelId);
        if (existing) {
          existing.feedNames.push(feed.name);
        } else {
          channelMap.set(feed.webhookChannelId, {
            webhookUrl: feed.webhookUrl,
            channelId: feed.webhookChannelId,
            guildId: feed.webhookGuildId || "",
            feedNames: [feed.name],
          });
        }
      }
    }

    const channels = Array.from(channelMap.values()).map((ch) => ({
      webhookUrl: ch.webhookUrl,
      channelId: ch.channelId,
      guildId: ch.guildId,
      usedBy: ch.feedNames,
    }));

    res.json(channels);
  } catch {
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

router.delete("/:feedId", async (req, res) => {
  try {
    const feedId = parseInt(req.params.feedId);

    await db
      .update(feeds)
      .set({
        webhookUrl: null,
        webhookChannelId: null,
        webhookGuildId: null,
      })
      .where(eq(feeds.id, feedId));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;
