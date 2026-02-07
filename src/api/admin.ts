import { Router, Response } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin, AuthRequest } from "../middleware/auth.js";
import { hashPassword } from "../utils/auth.js";

const router = Router();

router.use(requireAdmin);

const updatePasswordSchema = z.object({
  password: z.string().min(4),
});

const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
});

router.get("/users", async (_req: AuthRequest, res: Response) => {
  const allUsers = db.select({
    id: users.id,
    username: users.username,
    isAdmin: users.isAdmin,
    createdAt: users.createdAt,
  }).from(users).all();

  res.json(allUsers);
});

router.delete("/users/:id", async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const userId = parseInt(Array.isArray(id) ? id[0] : id);

  if (userId === req.userId) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  db.delete(users).where(eq(users.id, userId)).run();
  res.status(204).send();
});

router.put("/users/:id/password", async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const userId = parseInt(Array.isArray(id) ? id[0] : id);

  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors });
    return;
  }

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId))
    .run();

  res.json({ success: true });
});

router.put("/users/:id", async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const userId = parseInt(Array.isArray(id) ? id[0] : id);

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors });
    return;
  }

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (parsed.data.isAdmin !== undefined) {
    db.update(users)
      .set({ isAdmin: parsed.data.isAdmin })
      .where(eq(users.id, userId))
      .run();
  }

  const updated = db.select({
    id: users.id,
    username: users.username,
    isAdmin: users.isAdmin,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId)).get();

  res.json(updated);
});

export default router;
