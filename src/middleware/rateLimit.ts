import { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
}

export function rateLimit(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const keyFn = opts.keyFn || ((req) => req.ip || "unknown");

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    if (bucket.count >= opts.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: "Too many requests, try again later" });
      return;
    }

    bucket.count++;
    next();

    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }
  };
}
