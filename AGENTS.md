# AGENTS.md - Coding Agent Guidelines

## Project Overview

RSScode - RSS to Discord notification service built with TypeScript, Express.js, and SQLite.

### Key Features
- Multi-feed management with per-feed Discord channels
- Customizable message templates with drag-and-drop editor
- Discord OAuth2 integration
- Smart notifications (skip existing posts on first check)

## Tech Stack

- **Runtime**: Node.js 20+ (ESM modules)
- **Language**: TypeScript 5.7+ (strict mode)
- **Framework**: Express.js 4.x
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **Validation**: Zod
- **Testing**: Vitest + Supertest
- **Build**: tsc (TypeScript compiler)

## Commands

### Development

```bash
npm run dev          # Start dev server with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm run start        # Run production build
```

### Testing

```bash
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode

# Run a single test file
npx vitest run src/test/feeds.test.ts

# Run tests matching a pattern
npx vitest run -t "creates a new feed"

# Run tests in a specific describe block
npx vitest run -t "POST /api/feeds"
```

### Database

```bash
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run migrations
```

### Docker

```bash
docker build -t rsscode:latest .
docker-compose up -d
```

## Project Structure

```
src/
├── index.ts              # Express app entry point
├── api/                  # Route handlers
│   ├── feeds.ts          # /api/feeds CRUD
│   ├── discord.ts        # /api/discord OAuth
│   └── settings.ts       # /api/settings
├── db/
│   ├── schema.ts         # Drizzle table definitions
│   └── index.ts          # Database connection + migrations
├── services/
│   ├── discord.ts        # Discord webhook sender
│   ├── rss.ts            # RSS feed parser
│   └── scheduler.ts      # Cron job for RSS checks
├── types/
│   └── index.ts          # Zod schemas for validation
└── test/
    ├── setup.ts          # Test database setup (in-memory SQLite)
    ├── app.ts            # Test Express app instance
    └── *.test.ts         # Test files
public/
└── index.html            # Single-page admin UI
```

## Code Style Guidelines

### Imports

- Use `.js` extension for local imports (ESM requirement)
- Order: external packages → local modules → types

```typescript
import { Router } from "express";
import Parser from "rss-parser";
import { db } from "../db/index.js";
import { feeds } from "../db/schema.js";
import { createFeedSchema } from "../types/index.js";
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables/Functions | camelCase | `checkAllFeeds`, `webhookUrl` |
| Types/Interfaces | PascalCase | `Feed`, `DiscordMessage` |
| Database columns | snake_case | `webhook_url`, `created_at` |
| Constants | camelCase | `parser`, `router` |
| Files | kebab-case or camelCase | `discord.ts`, `index.ts` |

### TypeScript

- Enable strict mode (already configured in tsconfig.json)
- Use explicit return types for exported functions
- Use `unknown` for caught errors, then narrow with `instanceof`
- Prefix unused parameters with underscore: `_req`, `_res`

```typescript
router.get("/", async (_req, res) => {
  // ...
});

} catch (error: unknown) {
  if (error instanceof Error && error.message.includes("UNIQUE")) {
    // handle specific error
  }
}
```

### Error Handling

- Wrap route handlers in try-catch
- Return generic error messages to clients (don't leak internals)
- Log detailed errors to console for debugging
- Use appropriate HTTP status codes

```typescript
try {
  // operation
} catch (error) {
  console.error("Detailed error:", error);
  res.status(500).json({ error: "Generic message for client" });
}
```

### API Response Patterns

| Status | Usage |
|--------|-------|
| 200 | Successful GET, PUT |
| 201 | Successful POST (created) |
| 204 | Successful DELETE (no content) |
| 400 | Validation error, bad request |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 500 | Internal server error |

### Validation with Zod

- Define schemas in `src/types/index.ts`
- Use `safeParse` for validation
- Return 400 with validation errors on failure

```typescript
const parsed = createFeedSchema.safeParse(req.body);
if (!parsed.success) {
  res.status(400).json({ error: parsed.error.errors });
  return;
}
```

### Database (Drizzle ORM)

- Schema definitions in `src/db/schema.ts`
- Use `returning()` for INSERT/UPDATE/DELETE to get affected rows
- Use `.get()` for single row queries

```typescript
const result = await db.insert(feeds).values(data).returning();
const feed = await db.select().from(feeds).where(eq(feeds.id, id)).get();
```

### Testing

- Use `describe` blocks to group related tests
- Test file naming: `*.test.ts`
- Tests use in-memory SQLite (configured in `src/test/setup.ts`)
- Database is cleared between tests in `beforeEach`

```typescript
describe("Feeds API", () => {
  describe("POST /api/feeds", () => {
    it("creates a new feed", async () => {
      const res = await request(app)
        .post("/api/feeds")
        .send({ name: "Test", url: "https://example.com/feed.xml" });
      
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Test");
    });
  });
});
```

## Do NOT

- Use `any` type - use `unknown` and narrow
- Suppress type errors with `@ts-ignore` or `@ts-expect-error`
- Leave empty catch blocks
- Commit `.env` files or secrets
- Add unnecessary comments (code should be self-documenting)
