import cron from "node-cron";
import { checkAllFeeds } from "./rss.js";
import { db } from "../db/index.js";
import { workspaceSettings, feeds, workspaces } from "../db/schema.js";
import { eq } from "drizzle-orm";

interface WorkspaceScheduler {
  workspaceId: number;
  task: cron.ScheduledTask;
  intervalMinutes: number;
}

const schedulers: Map<number, WorkspaceScheduler> = new Map();
let globalScheduler: cron.ScheduledTask | null = null;

async function getWorkspaceInterval(workspaceId: number): Promise<number> {
  const settings = db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).get();
  return settings?.checkIntervalMinutes || 10;
}

async function checkWorkspaceFeeds(workspaceId: number): Promise<void> {
  console.log(`[${new Date().toISOString()}] Checking feeds for workspace ${workspaceId}...`);
  const workspaceFeeds = db.select().from(feeds).where(eq(feeds.workspaceId, workspaceId)).all();
  const enabledFeeds = workspaceFeeds.filter((f) => f.enabled && f.webhookUrl);

  let totalNew = 0;
  for (const feed of enabledFeeds) {
    try {
      const { checkFeed } = await import("./rss.js");
      const newCount = await checkFeed(feed);
      totalNew += newCount;
      if (newCount > 0) {
        console.log(`  ${feed.name}: ${newCount} new posts`);
      }
    } catch (error) {
      console.error(`Error checking feed ${feed.name}:`, error);
    }
  }

  console.log(
    `  Workspace ${workspaceId}: ${totalNew} new posts from ${enabledFeeds.length} enabled feeds`
  );
}

export async function startWorkspaceScheduler(workspaceId: number): Promise<void> {
  const existing = schedulers.get(workspaceId);
  if (existing) {
    existing.task.stop();
  }

  const intervalMinutes = await getWorkspaceInterval(workspaceId);
  const schedule = `*/${intervalMinutes} * * * *`;

  const task = cron.schedule(schedule, () => {
    checkWorkspaceFeeds(workspaceId).catch(console.error);
  });

  schedulers.set(workspaceId, {
    workspaceId,
    task,
    intervalMinutes,
  });

  console.log(`Scheduler for workspace ${workspaceId} started: every ${intervalMinutes} minutes`);
}

export async function startScheduler(): Promise<void> {
  const allWorkspaces = db.select().from(workspaces).all();

  for (const workspace of allWorkspaces) {
    await startWorkspaceScheduler(workspace.id);
  }

  console.log(`Started schedulers for ${allWorkspaces.length} workspaces`);
}

export async function restartScheduler(): Promise<void> {
  console.log("Restarting all schedulers...");
  await startScheduler();
}

export async function restartWorkspaceScheduler(workspaceId: number): Promise<void> {
  console.log(`Restarting scheduler for workspace ${workspaceId}...`);
  await startWorkspaceScheduler(workspaceId);
}

export function stopScheduler(): void {
  for (const [workspaceId, scheduler] of schedulers) {
    scheduler.task.stop();
    console.log(`Stopped scheduler for workspace ${workspaceId}`);
  }
  schedulers.clear();

  if (globalScheduler) {
    globalScheduler.stop();
    globalScheduler = null;
  }
}

export function stopWorkspaceScheduler(workspaceId: number): void {
  const scheduler = schedulers.get(workspaceId);
  if (scheduler) {
    scheduler.task.stop();
    schedulers.delete(workspaceId);
    console.log(`Stopped scheduler for workspace ${workspaceId}`);
  }
}

export function getCurrentInterval(workspaceId?: number): number {
  if (workspaceId) {
    const scheduler = schedulers.get(workspaceId);
    return scheduler?.intervalMinutes || 10;
  }
  let minInterval = 10;
  for (const scheduler of schedulers.values()) {
    if (scheduler.intervalMinutes < minInterval) {
      minInterval = scheduler.intervalMinutes;
    }
  }
  return minInterval;
}
