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
import { requireAuth } from "./middleware/auth.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.set("trust proxy", true);
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "rsscode-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use("/api/auth", authRouter);
app.use("/api/workspaces", workspacesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/feeds", feedsRouter);
app.use("/api/discord", discordRouter);
app.use("/api/settings", settingsRouter);

app.post("/api/check", requireAuth, async (_req, res) => {
  try {
    await checkAllFeeds();
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

initDatabase();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  startScheduler();
});
