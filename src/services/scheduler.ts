import cron from "node-cron";
import { checkAllFeeds } from "./rss.js";

let scheduledTask: cron.ScheduledTask | null = null;

export function startScheduler(): void {
  const schedule = process.env.CRON_SCHEDULE || "*/10 * * * *";

  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule(schedule, () => {
    checkAllFeeds().catch(console.error);
  });

  console.log(`Scheduler started with schedule: ${schedule}`);
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
