import cron from "node-cron";
import { checkAllFeeds } from "./rss.js";
import { db } from "../db/index.js";
import { settings } from "../db/schema.js";
import { eq } from "drizzle-orm";

let scheduledTask: cron.ScheduledTask | null = null;
let currentInterval: number = 10;

async function getIntervalMinutes(): Promise<number> {
  try {
    const row = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "check_interval_minutes"))
      .get();
    const value = row?.value ? parseInt(row.value, 10) : 10;
    return isNaN(value) || value < 1 ? 10 : value;
  } catch {
    return 10;
  }
}

export async function startScheduler(): Promise<void> {
  const intervalMinutes = await getIntervalMinutes();
  currentInterval = intervalMinutes;
  const schedule = `*/${intervalMinutes} * * * *`;

  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule(schedule, () => {
    checkAllFeeds().catch(console.error);
  });

  console.log(`Scheduler started: every ${intervalMinutes} minutes`);
}

export async function restartScheduler(): Promise<void> {
  console.log("Restarting scheduler with new interval...");
  await startScheduler();
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

export function getCurrentInterval(): number {
  return currentInterval;
}
