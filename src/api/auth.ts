import { Router } from "express";
import { db } from "../db/index.js";
import { users, workspaces, workspaceMembers } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../utils/auth.js";
import { z } from "zod";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(4),
  passwordConfirm: z.string().min(4),
});

declare module "express-session" {
  interface SessionData {
    userId?: number;
    username?: string;
    isAdmin?: boolean;
  }
}

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { username, password } = parsed.data;

  const user = db.select().from(users).where(eq(users.username, username)).get();
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.isAdmin = user.isAdmin;

  res.json({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
  });
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    res.status(400).json({ error: firstError?.message || "Invalid input" });
    return;
  }

  const { username, password, passwordConfirm } = parsed.data;

  if (password !== passwordConfirm) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  try {
    const passwordHash = await hashPassword(password);
    const newUser = db.insert(users).values({
      username,
      passwordHash,
      isAdmin: false,
    }).returning().get();

    const workspace = db.insert(workspaces).values({
      name: "my workspace",
      ownerId: newUser.id,
    }).returning().get();

    db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: newUser.id,
      role: "owner",
    }).run();

    req.session.userId = newUser.id;
    req.session.username = newUser.username;
    req.session.isAdmin = newUser.isAdmin;

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      isAdmin: newUser.isAdmin,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err: Error | null) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

router.get("/me", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    id: req.session.userId,
    username: req.session.username,
    isAdmin: req.session.isAdmin,
  });
});

export default router;
