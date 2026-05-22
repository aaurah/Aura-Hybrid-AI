import { Router } from "express";
import { db } from "@workspace/db";
import { userIntegrationsTable, githubImportsTable, documentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { GitHubClient, isTextFile, shouldSkipPath } from "../lib/github";
import { ollamaEmbedding } from "../lib/ollama";
import { nanoid } from "../lib/nanoid";
import { logger } from "../lib/logger";

const router = Router();
const EMBED_MODEL = "nomic-embed-text";

// ── helpers ──────────────────────────────────────────────────────────────────
async function getClient(userId: string): Promise<GitHubClient> {
  const rows = await db
    .select()
    .from(userIntegrationsTable)
    .where(and(eq(userIntegrationsTable.userId, userId), eq(userIntegrationsTable.provider, "github")))
    .limit(1);
  if (!rows[0]) throw new Error("GitHub not connected");
  return new GitHubClient(rows[0].token);
}

// ── GET /api/v1/github/status ─────────────────────────────────────────────
router.get("/v1/github/status", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const rows = await db
      .select()
      .from(userIntegrationsTable)
      .where(and(eq(userIntegrationsTable.userId, userId), eq(userIntegrationsTable.provider, "github")))
      .limit(1);

    if (!rows[0]) {
      res.json({ connected: false });
      return;
    }

    const client = new GitHubClient(rows[0].token);
    const user = await client.getUser();
    res.json({
      connected: true,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      publicRepos: user.public_repos,
      profileUrl: user.html_url,
      connectedAt: rows[0].createdAt,
    });
  } catch (err) {
    res.json({ connected: false, error: String(err) });
  }
});

// ── POST /api/v1/github/connect ───────────────────────────────────────────
router.post("/v1/github/connect", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const { token } = req.body as { token: string };
    if (!token) { res.status(400).json({ error: "token required" }); return; }

    const client = new GitHubClient(token);
    const user = await client.getUser();

    await db
      .insert(userIntegrationsTable)
      .values({
        id: nanoid(),
        userId,
        provider: "github",
        token,
        displayName: user.name ?? user.login,
        avatarUrl: user.avatar_url,
        metadata: JSON.stringify({ login: user.login }),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userIntegrationsTable.userId, userIntegrationsTable.provider],
        set: { token, displayName: user.name ?? user.login, avatarUrl: user.avatar_url, updatedAt: new Date() },
      });

    res.json({ connected: true, login: user.login, name: user.name, avatarUrl: user.avatar_url });
  } catch (err) {
    logger.error({ err }, "GitHub connect failed");
    res.status(400).json({ error: String(err) });
  }
});

// ── DELETE /api/v1/github/disconnect ─────────────────────────────────────
router.delete("/v1/github/disconnect", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  await db
    .delete(userIntegrationsTable)
    .where(and(eq(userIntegrationsTable.userId, userId), eq(userIntegrationsTable.provider, "github")));
  res.json({ disconnected: true });
});

// ── GET /api/v1/github/repos ──────────────────────────────────────────────
router.get("/v1/github/repos", requireAuth, async (req, res) => {
  try {
    const client = await getClient(req.auth!.userId);
    const page = Number(req.query["page"] ?? 1);
    const repos = await client.listRepos(page);
    res.json({ repos });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── GET /api/v1/github/repos/search ──────────────────────────────────────
router.get("/v1/github/repos/search", requireAuth, async (req, res) => {
  try {
    const client = await getClient(req.auth!.userId);
    const q = String(req.query["q"] ?? "");
    if (!q) { res.json({ repos: [], total: 0 }); return; }
    const result = await client.searchRepos(q);
    res.json({ repos: result.items, total: result.total_count });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── GET /api/v1/github/repos/:owner/:repo ────────────────────────────────
router.get("/v1/github/repos/:owner/:repo", requireAuth, async (req, res) => {
  try {
    const client = await getClient(req.auth!.userId);
    const { owner, repo } = req.params as { owner: string; repo: string };
    const data = await client.getRepo(owner, repo);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── GET /api/v1/github/repos/:owner/:repo/branches ───────────────────────
router.get("/v1/github/repos/:owner/:repo/branches", requireAuth, async (req, res) => {
  try {
    const client = await getClient(req.auth!.userId);
    const { owner, repo } = req.params as { owner: string; repo: string };
    const branches = await client.listBranches(owner, repo);
    res.json({ branches });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── GET /api/v1/github/repos/:owner/:repo/tree ───────────────────────────
router.get("/v1/github/repos/:owner/:repo/tree", requireAuth, async (req, res) => {
  try {
    const client = await getClient(req.auth!.userId);
    const { owner, repo } = req.params as { owner: string; repo: string };
    const branch = String(req.query["branch"] ?? "HEAD");
    const tree = await client.getTree(owner, repo, branch);
    const filtered = tree.filter((f) => f.type === "blob" && !shouldSkipPath(f.path));
    res.json({ tree: filtered, total: filtered.length });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── GET /api/v1/github/repos/:owner/:repo/content ────────────────────────
router.get("/v1/github/repos/:owner/:repo/content", requireAuth, async (req, res) => {
  try {
    const client = await getClient(req.auth!.userId);
    const { owner, repo } = req.params as { owner: string; repo: string };
    const path = String(req.query["path"] ?? "");
    if (!path) { res.status(400).json({ error: "path required" }); return; }
    const content = await client.getFileContent(owner, repo, path);
    res.json({ path, content });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── GET /api/v1/github/repos/:owner/:repo/commits ────────────────────────
router.get("/v1/github/repos/:owner/:repo/commits", requireAuth, async (req, res) => {
  try {
    const client = await getClient(req.auth!.userId);
    const { owner, repo } = req.params as { owner: string; repo: string };
    const branch = req.query["branch"] as string | undefined;
    const commits = await client.listCommits(owner, repo, branch);
    res.json({ commits });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── GET /api/v1/github/repos/:owner/:repo/pulls ──────────────────────────
router.get("/v1/github/repos/:owner/:repo/pulls", requireAuth, async (req, res) => {
  try {
    const client = await getClient(req.auth!.userId);
    const { owner, repo } = req.params as { owner: string; repo: string };
    const state = (req.query["state"] as "open" | "closed" | "all") ?? "open";
    const prs = await client.listPullRequests(owner, repo, state);
    res.json({ prs });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── GET /api/v1/github/repos/:owner/:repo/issues ─────────────────────────
router.get("/v1/github/repos/:owner/:repo/issues", requireAuth, async (req, res) => {
  try {
    const client = await getClient(req.auth!.userId);
    const { owner, repo } = req.params as { owner: string; repo: string };
    const state = (req.query["state"] as "open" | "closed" | "all") ?? "open";
    const issues = await client.listIssues(owner, repo, state);
    res.json({ issues });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── POST /api/v1/github/repos/:owner/:repo/import ────────────────────────
router.post("/v1/github/repos/:owner/:repo/import", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { owner, repo } = req.params as { owner: string; repo: string };

  try {
    const client = await getClient(userId);
    const repoInfo = await client.getRepo(owner, repo);
    const branch = (req.body.branch as string | undefined) ?? repoInfo.default_branch;

    // Upsert import record
    const importId = nanoid();
    await db
      .insert(githubImportsTable)
      .values({ id: importId, userId, owner, repo, branch, status: "importing", filesImported: "0" })
      .onConflictDoUpdate({
        target: [githubImportsTable.userId, githubImportsTable.owner, githubImportsTable.repo],
        set: { status: "importing", filesImported: "0", updatedAt: new Date() },
      });

    // Get file tree
    const tree = await client.getTree(owner, repo, branch);
    const textFiles = tree.filter((f) => f.type === "blob" && isTextFile(f.path) && (f.size ?? 0) < 500_000);
    const MAX_FILES = 100;
    const toImport = textFiles.slice(0, MAX_FILES);

    logger.info({ owner, repo, total: tree.length, importing: toImport.length }, "Starting GitHub import");

    let imported = 0;
    for (const file of toImport) {
      try {
        const content = await client.getFileContent(owner, repo, file.path);
        if (!content.trim()) continue;

        const chunkSize = 800;
        const chunks = [];
        for (let i = 0; i < content.length; i += chunkSize) {
          chunks.push(content.slice(i, i + chunkSize));
        }

        for (let ci = 0; ci < chunks.length; ci++) {
          const chunk = chunks[ci]!;
          let embedding: number[] | null = null;
          try {
            const embResp = await ollamaEmbedding({ model: EMBED_MODEL, prompt: chunk });
            embedding = embResp.embedding;
          } catch {
            // embed unavailable — store without vector
          }

          const source = `github:${owner}/${repo}/${file.path}`;
          const existing = await db
            .select({ id: documentsTable.id })
            .from(documentsTable)
            .where(and(eq(documentsTable.source, source), eq(documentsTable.chunkIndex, ci)))
            .limit(1);

          if (existing[0]) {
            await db.update(documentsTable).set({
              content: chunk,
              embedding: embedding ? JSON.stringify(embedding) : null,
              updatedAt: new Date(),
            }).where(eq(documentsTable.id, existing[0].id));
          } else {
            await db.insert(documentsTable).values({
              id: nanoid(),
              title: `${owner}/${repo}: ${file.path}`,
              content: chunk,
              source,
              chunkIndex: ci,
              embedding: embedding ? JSON.stringify(embedding) : null,
            });
          }
        }
        imported++;
      } catch (fileErr) {
        logger.warn({ file: file.path, err: fileErr }, "Failed to import file");
      }
    }

    await db
      .update(githubImportsTable)
      .set({ status: "done", filesImported: String(imported), lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(githubImportsTable.userId, userId), eq(githubImportsTable.owner, owner), eq(githubImportsTable.repo, repo)));

    res.json({ success: true, owner, repo, branch, filesImported: imported, totalFiles: toImport.length });
  } catch (err) {
    logger.error({ err }, "GitHub import failed");
    await db
      .update(githubImportsTable)
      .set({ status: "error", updatedAt: new Date() })
      .where(and(eq(githubImportsTable.userId, userId), eq(githubImportsTable.owner, owner), eq(githubImportsTable.repo, repo)));
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /api/v1/github/imports ────────────────────────────────────────────
router.get("/v1/github/imports", requireAuth, async (req, res) => {
  try {
    const imports = await db
      .select()
      .from(githubImportsTable)
      .where(eq(githubImportsTable.userId, req.auth!.userId))
      .orderBy(githubImportsTable.updatedAt);
    res.json({ imports });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── DELETE /api/v1/github/imports/:owner/:repo ────────────────────────────
router.delete("/v1/github/imports/:owner/:repo", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { owner, repo } = req.params as { owner: string; repo: string };
  const source = `github:${owner}/${repo}/`;
  // Delete all documents from this repo
  await db.delete(documentsTable).where(eq(documentsTable.source, source));
  await db
    .delete(githubImportsTable)
    .where(and(eq(githubImportsTable.userId, userId), eq(githubImportsTable.owner, owner), eq(githubImportsTable.repo, repo)));
  res.json({ deleted: true });
});

export default router;
