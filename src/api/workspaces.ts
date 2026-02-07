import { Router, Response } from "express";
import { db } from "../db/index.js";
import { workspaces, workspaceMembers, workspaceSettings } from "../db/schema.js";
import { eq, or, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { restartWorkspaceScheduler, stopWorkspaceScheduler } from "../services/scheduler.js";

const router = Router();

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(50),
});

router.use(requireAuth);

router.get("/", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const ownedWorkspaces = db.select().from(workspaces).where(eq(workspaces.ownerId, userId)).all();

  const memberWorkspaceIds = db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .all()
    .map((m) => m.workspaceId);

  const memberWorkspaces = memberWorkspaceIds.length > 0
    ? db.select().from(workspaces).where(
        or(...memberWorkspaceIds.map((id) => eq(workspaces.id, id)))
      ).all()
    : [];

  const allWorkspaces = [...ownedWorkspaces];
  for (const ws of memberWorkspaces) {
    if (!allWorkspaces.find((w) => w.id === ws.id)) {
      allWorkspaces.push(ws);
    }
  }

  res.json(allWorkspaces);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors });
    return;
  }

  const userId = req.userId!;
  const { name } = parsed.data;

  try {
    const workspace = db.insert(workspaces).values({
      name,
      ownerId: userId,
    }).returning().get();

    db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: "owner",
    }).run();

    db.insert(workspaceSettings).values({
      workspaceId: workspace.id,
      checkIntervalMinutes: 10,
    }).run();

    restartWorkspaceScheduler(workspace.id).catch(console.error);

    res.status(201).json(workspace);
  } catch (error) {
    console.error("Create workspace error:", error);
    res.status(500).json({ error: "Failed to create workspace" });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const workspaceId = parseInt(Array.isArray(id) ? id[0] : id);

  const workspace = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const isMember = db
    .select()
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ))
    .get();

  if (workspace.ownerId !== userId && !isMember) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(workspace);
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const workspaceId = parseInt(Array.isArray(id) ? id[0] : id);

  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors });
    return;
  }

  const workspace = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  if (workspace.ownerId !== userId && !req.isAdmin) {
    res.status(403).json({ error: "Only owner can update workspace" });
    return;
  }

  const updated = db.update(workspaces)
    .set({ name: parsed.data.name })
    .where(eq(workspaces.id, workspaceId))
    .returning()
    .get();

  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const workspaceId = parseInt(Array.isArray(id) ? id[0] : id);

  const workspace = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  if (workspace.ownerId !== userId && !req.isAdmin) {
    res.status(403).json({ error: "Only owner can delete workspace" });
    return;
  }

  stopWorkspaceScheduler(workspaceId);
  db.delete(workspaces).where(eq(workspaces.id, workspaceId)).run();
  res.status(204).send();
});

export default router;
