import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nanoid } from "../lib/nanoid";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { getSecurityConfig } from "../lib/config";
import { logger } from "../lib/logger";

const router = Router();

router.post("/v1/users/register", async (req, res) => {
  try {
    const { email, username, password, role = "user" } = req.body as {
      email: string;
      username: string;
      password: string;
      role?: string;
    };

    if (!email || !username || !password) {
      res.status(400).json({ error: "email, username, and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existing[0]) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = nanoid();
    const safeRole = ["user", "dev", "admin", "viewer"].includes(role) ? role : "user";

    await db.insert(usersTable).values({
      id: userId,
      email,
      username,
      passwordHash,
      role: safeRole,
    });

    const token = signToken({ userId, email, role: safeRole as any });

    res.status(201).json({
      token,
      user: { id: userId, email, username, role: safeRole },
    });
  } catch (err) {
    logger.error({ err }, "Register error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/v1/users/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    const user = users[0];
    if (!user || !user.active) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/v1/users/me", requireAuth, async (req, res) => {
  try {
    const auth = req.auth!;
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, auth.userId))
      .limit(1);

    const user = users[0];
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const keys = await db
      .select({ id: apiKeysTable.id, name: apiKeysTable.name, active: apiKeysTable.active, createdAt: apiKeysTable.createdAt })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, user.id));

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt.toISOString(),
      apiKeys: keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() })),
    });
  } catch (err) {
    logger.error({ err }, "Get me error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/v1/users/api-keys", requireAuth, async (req, res) => {
  try {
    const auth = req.auth!;
    const { name } = req.body as { name: string };
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const { apiKeyPrefix } = getSecurityConfig();
    const key = `${apiKeyPrefix}${nanoid(32)}`;
    const keyId = nanoid();

    await db.insert(apiKeysTable).values({
      id: keyId,
      userId: auth.userId,
      key,
      name,
      role: auth.role,
    });

    res.status(201).json({ id: keyId, name, key, role: auth.role });
  } catch (err) {
    logger.error({ err }, "Create API key error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
