import { Router, Response } from "express";
import { db } from "../db/index.js";
import { workspaceSettings, workspaces, workspaceMembers } from "../db/schema.js";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

const updateSettingsSchema = z.object({
  discord_client_id: z.string().optional().nullable(),
  discord_client_secret: z.string().optional().nullable(),
  check_interval_minutes: z.number().min(1).max(1440).optional(),
});

function getUserWorkspaceIds(userId: number): number[] {
  const owned = db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerId, userId)).all();
  const member = db.select({ workspaceId: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).all();
  const ids = new Set([...owned.map(w => w.id), ...member.map(m => m.workspaceId)]);
  return Array.from(ids);
}

export async function getWorkspaceSettings(workspaceId: number) {
  const settings = db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).get();
  return settings || { workspaceId, discordClientId: null, discordClientSecret: null, checkIntervalMinutes: 10 };
}

export async function getDiscordCredentials(workspaceId: number): Promise<{
  clientId: string | null;
  clientSecret: string | null;
}> {
  const settings = await getWorkspaceSettings(workspaceId);
  return {
    clientId: settings.discordClientId,
    clientSecret: settings.discordClientSecret,
  };
}

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId is required" });
      return;
    }

    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);
    if (!userWorkspaceIds.includes(workspaceId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const settings = await getWorkspaceSettings(workspaceId);

    res.json({
      discord_client_id: settings.discordClientId || "",
      discord_client_secret: settings.discordClientSecret ? "••••••••" : "",
      check_interval_minutes: settings.checkIntervalMinutes || 10,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/", async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : req.body.workspaceId;
    
    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId is required" });
      return;
    }

    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);
    if (!userWorkspaceIds.includes(workspaceId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      return;
    }

    const existingSettings = db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).get();

    const updateData: Record<string, unknown> = {};
    
    if (parsed.data.discord_client_id !== undefined) {
      updateData.discordClientId = parsed.data.discord_client_id || null;
    }
    if (parsed.data.discord_client_secret !== undefined && parsed.data.discord_client_secret !== "••••••••") {
      updateData.discordClientSecret = parsed.data.discord_client_secret || null;
    }
    if (parsed.data.check_interval_minutes !== undefined) {
      updateData.checkIntervalMinutes = parsed.data.check_interval_minutes;
    }

    if (existingSettings) {
      db.update(workspaceSettings)
        .set(updateData)
        .where(eq(workspaceSettings.workspaceId, workspaceId))
        .run();
    } else {
      db.insert(workspaceSettings).values({
        workspaceId,
        discordClientId: parsed.data.discord_client_id || null,
        discordClientSecret: parsed.data.discord_client_secret || null,
        checkIntervalMinutes: parsed.data.check_interval_minutes || 10,
      }).run();
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
