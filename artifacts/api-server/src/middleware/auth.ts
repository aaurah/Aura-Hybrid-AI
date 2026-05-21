import type { Request, Response, NextFunction } from "express";
import { verifyToken, type AuthPayload } from "../lib/jwt";
import { db } from "@workspace/db";
import { apiKeysTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"];
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;

  if (apiKeyHeader) {
    try {
      const keyRow = await db
        .select()
        .from(apiKeysTable)
        .where(eq(apiKeysTable.key, apiKeyHeader))
        .limit(1);

      if (!keyRow[0] || !keyRow[0].active) {
        res.status(401).json({ error: "Invalid or inactive API key" });
        return;
      }

      const userRows = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, keyRow[0].userId))
        .limit(1);

      if (!userRows[0] || !userRows[0].active) {
        res.status(401).json({ error: "User account inactive" });
        return;
      }

      req.auth = {
        type: "apikey",
        userId: keyRow[0].userId,
        keyId: keyRow[0].id,
        role: keyRow[0].role as AuthPayload["role"],
      };

      await db
        .update(apiKeysTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeysTable.id, keyRow[0].id));

      next();
      return;
    } catch (err) {
      logger.warn({ err }, "API key auth error");
      res.status(401).json({ error: "API key validation failed" });
      return;
    }
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token);
      req.auth = payload;
      next();
      return;
    } catch (err) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
  }

  res.status(401).json({ error: "Authentication required" });
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.auth = verifyToken(authHeader.slice(7));
    } catch {
      // ignore
    }
  }
  next();
}
