import { db } from "../db/index.js";
import { workspaces, workspaceMembers, feeds } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export function getUserWorkspaceIds(userId: number): number[] {
  const owned = db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .all();
  const member = db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .all();
  return Array.from(new Set([...owned.map((w) => w.id), ...member.map((m) => m.workspaceId)]));
}

export function userCanAccessWorkspace(userId: number, workspaceId: number): boolean {
  return getUserWorkspaceIds(userId).includes(workspaceId);
}

export function userCanAccessFeed(userId: number, feedId: number): boolean {
  const feed = db
    .select({ workspaceId: feeds.workspaceId })
    .from(feeds)
    .where(eq(feeds.id, feedId))
    .get();
  if (!feed || feed.workspaceId == null) return false;
  return userCanAccessWorkspace(userId, feed.workspaceId);
}
