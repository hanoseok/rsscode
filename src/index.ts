import express from "express";
import cors from "cors";
import session from "express-session";
import { initDatabase } from "./db/index.js";
import feedsRouter from "./api/feeds.js";
import discordRouter from "./api/discord.js";
import settingsRouter from "./api/settings.js";
import authRouter from "./api/auth.js";
import workspacesRouter from "./api/workspaces.js";
import adminRouter from "./api/admin.js";
import { startScheduler } from "./services/scheduler.js";
import { checkAllFeeds } from "./services/rss.js";
import { requireAuth, AuthRequest } from "./middleware/auth.js";
import { getUserWorkspaceIds } from "./lib/workspaces.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.set("trust proxy", 1);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && !sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required in production");
}

app.use(session({
  secret: sessionSecret || "rsscode-dev-secret-do-not-use-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use("/api/auth", authRouter);
app.use("/api/workspaces", workspacesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/feeds", feedsRouter);
app.use("/api/discord", discordRouter);
app.use("/api/settings", settingsRouter);

app.post("/api/check", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userWorkspaceIds = getUserWorkspaceIds(req.userId!);
    if (userWorkspaceIds.length === 0) {
      res.json({ success: true, message: "No workspaces to check" });
      return;
    }
    await checkAllFeeds(userWorkspaceIds);
    res.json({ success: true, message: "Feed check completed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to check feeds" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(express.static(join(__dirname, "../public")));

app.get("*", (_req, res) => {
  res.sendFile(join(__dirname, "../public/index.html"));
});

async function main() {
  await initDatabase();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    startScheduler();
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
