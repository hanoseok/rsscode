import { Router } from "express";
import { db } from "../db/index.js";
import { settings } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { restartScheduler } from "../services/scheduler.js";

const router = Router();

const SETTING_KEYS = [
  "discord_client_id",
  "discord_client_secret",
  "check_interval_minutes",
] as const;

const updateSettingsSchema = z.object({
  discord_client_id: z.string().optional(),
  discord_client_secret: z.string().optional(),
  check_interval_minutes: z.number().min(1).max(1440).optional(),
});

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export async function getDiscordCredentials(): Promise<{
  clientId: string | null;
  clientSecret: string | null;
}> {
  const clientId = process.env.DISCORD_CLIENT_ID || await getSetting("discord_client_id");
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || await getSetting("discord_client_secret");
  return { clientId, clientSecret };
}

export function getCheckIntervalMinutes(): number {
  const envInterval = process.env.CHECK_INTERVAL_MINUTES;
  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 1440) {
      return parsed;
    }
  }
  return 0;
}

router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(settings);
    const result: Record<string, string | null> = {};

    const envClientId = process.env.DISCORD_CLIENT_ID;
    const envClientSecret = process.env.DISCORD_CLIENT_SECRET;
    const envInterval = process.env.CHECK_INTERVAL_MINUTES;

    for (const key of SETTING_KEYS) {
      if (key === "discord_client_id" && envClientId) {
        result[key] = envClientId;
      } else if (key === "discord_client_secret" && envClientSecret) {
        result[key] = "••••••••";
      } else if (key === "check_interval_minutes" && envInterval) {
        result[key] = envInterval;
      } else {
        const row = rows.find((r) => r.key === key);
        if (key === "discord_client_secret" && row?.value) {
          result[key] = "••••••••";
        } else {
          result[key] = row?.value ?? null;
        }
      }
    }

    result["_env_configured"] = (envClientId && envClientSecret) ? "true" : "false";

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    let intervalChanged = false;

    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue;
      if (key === "discord_client_secret" && value === "••••••••") continue;

      const stringValue = String(value);
      await db
        .insert(settings)
        .values({ key, value: stringValue })
        .onConflictDoUpdate({ target: settings.key, set: { value: stringValue } });

      if (key === "check_interval_minutes") {
        intervalChanged = true;
      }
    }

    if (intervalChanged) {
      await restartScheduler();
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
