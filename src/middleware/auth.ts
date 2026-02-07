import { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
  isAdmin?: boolean;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.userId = req.session.userId;
  req.username = req.session.username;
  req.isAdmin = req.session.isAdmin;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!req.session.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  req.userId = req.session.userId;
  req.username = req.session.username;
  req.isAdmin = req.session.isAdmin;
  next();
}
