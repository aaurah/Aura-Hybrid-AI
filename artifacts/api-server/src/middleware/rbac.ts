import type { Request, Response, NextFunction } from "express";
import { hasRole, type Role } from "../lib/jwt";

export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!hasRole(auth.role, minRole)) {
      res.status(403).json({
        error: `Insufficient permissions. Required: ${minRole}, got: ${auth.role}`,
      });
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireDev = requireRole("dev");
export const requireUser = requireRole("user");
export const requireViewer = requireRole("viewer");
