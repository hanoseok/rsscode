import { Router, Response } from "express";
import { db } from "../db/index.js";
import { feeds } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { getDiscordCredentials } from "./settings.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { getUserWorkspaceIds, userCanAccessWorkspace, userCanAccessFeed } from "../lib/workspaces.js";

const router = Router();

router.use(requireAuth);

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
    const res = await fetch(webhookUrl, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const data = await res.json() as WebhookInfo;
    return data.name || null;
  } catch {
    return null;
  }
}

function getRedirectUri(req: { protocol: string; get: (name: string) => string | undefined }) {
  // Support reverse proxy headers
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost:3000";
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
  return `${protocol}://${host}/api/discord/callback`;
}

router.get("/authorize", async (req: AuthRequest, res) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) {
    res.redirect("/?error=workspace_required");
    return;
  }

  const workspaceIdNum = parseInt(workspaceId);
  if (!Number.isFinite(workspaceIdNum) || !userCanAccessWorkspace(req.userId!, workspaceIdNum)) {
    res.redirect("/?error=workspace_forbidden");
    return;
  }

  const feedId = req.query.feedId as string | undefined;
  if (feedId) {
    const feedIdNum = parseInt(feedId);
    if (!Number.isFinite(feedIdNum) || !userCanAccessFeed(req.userId!, feedIdNum)) {
      res.redirect("/?error=feed_forbidden");
      return;
    }
  }

  const { clientId } = await getDiscordCredentials(workspaceIdNum);
  if (!clientId) {
    res.redirect("/?error=discord_not_configured");
    return;
  }
  const redirectUri = encodeURIComponent(getRedirectUri(req));
  const state = Buffer.from(JSON.stringify({ feedId: feedId || null, workspaceId })).toString("base64url");

  const authUrl =
    `https://discord.com/oauth2/authorize?` +
    `client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=webhook.incoming` +
    `&state=${state}`;

  res.redirect(authUrl);
});

router.get("/callback", async (req: AuthRequest, res) => {
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
  let workspaceId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state as string, "base64url").toString());
    feedId = decoded.feedId;
    workspaceId = decoded.workspaceId;
  } catch {
    res.redirect("/?error=invalid_state");
    return;
  }

  if (!workspaceId) {
    res.redirect("/?error=workspace_required");
    return;
  }

  const workspaceIdNum = parseInt(workspaceId);
  if (!Number.isFinite(workspaceIdNum) || !userCanAccessWorkspace(req.userId!, workspaceIdNum)) {
    res.redirect("/?error=workspace_forbidden");
    return;
  }

  if (feedId) {
    const feedIdNum = parseInt(feedId);
    if (!Number.isFinite(feedIdNum) || !userCanAccessFeed(req.userId!, feedIdNum)) {
      res.redirect("/?error=feed_forbidden");
      return;
    }
  }

  const { clientId, clientSecret } = await getDiscordCredentials(workspaceIdNum);

  if (!clientId || !clientSecret) {
    res.redirect("/?error=discord_not_configured");
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);
    console.log("Token exchange redirect_uri:", redirectUri);

    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("Token exchange failed:", err);
      console.error("Used redirect_uri:", redirectUri);
      console.error("Request headers:", JSON.stringify({
        host: req.get("host"),
        protocol: req.protocol,
        "x-forwarded-proto": req.get("x-forwarded-proto"),
        "x-forwarded-host": req.get("x-forwarded-host"),
      }));
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
        .where(and(eq(feeds.id, parseInt(feedId)), eq(feeds.workspaceId, workspaceIdNum)));

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

router.get("/channels", async (req: AuthRequest, res) => {
  try {
    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);
    if (userWorkspaceIds.length === 0) {
      res.json([]);
      return;
    }
    const allFeeds = await db
      .select()
      .from(feeds)
      .where(inArray(feeds.workspaceId, userWorkspaceIds));
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

router.delete("/:feedId", async (req: AuthRequest, res) => {
  try {
    const feedIdParam = req.params.feedId;
    const feedId = parseInt(Array.isArray(feedIdParam) ? feedIdParam[0] : feedIdParam);
    if (!Number.isFinite(feedId)) {
      res.status(400).json({ error: "Invalid feedId" });
      return;
    }
    if (!userCanAccessFeed(req.userId!, feedId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    await db
      .update(feeds)
      .set({
        webhookUrl: null,
        webhookChannelId: null,
        webhookGuildId: null,
        webhookName: null,
      })
      .where(eq(feeds.id, feedId));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;
