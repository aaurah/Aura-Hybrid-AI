import type { Request, Response, NextFunction } from "express";

const INTERNAL_SECRET = process.env["INTERNAL_SECRET"] ?? "aura-internal-dev-secret";

export function requireInternal(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = req.headers["x-internal-secret"] as string | undefined;

  if (!secret || secret !== INTERNAL_SECRET) {
    res.status(403).json({ error: "Internal API access denied" });
    return;
  }

  next();
}
