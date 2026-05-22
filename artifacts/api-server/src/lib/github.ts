import { logger } from "./logger";

const GITHUB_API = "https://api.github.com";

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  public_repos: number;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  updated_at: string;
  size: number;
}

export interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  user: { login: string; avatar_url: string };
  html_url: string;
  created_at: string;
  updated_at: string;
  body: string | null;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  user: { login: string; avatar_url: string };
  html_url: string;
  created_at: string;
  labels: { name: string; color: string }[];
  body: string | null;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
  html_url: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
  html_url: string;
}

export class GitHubClient {
  constructor(private token: string) {}

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const url = `${GITHUB_API}${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...(opts.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async getUser(): Promise<GitHubUser> {
    return this.req<GitHubUser>("/user");
  }

  async listRepos(page = 1, perPage = 50): Promise<GitHubRepo[]> {
    return this.req<GitHubRepo[]>(
      `/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator`
    );
  }

  async searchRepos(q: string, page = 1): Promise<{ items: GitHubRepo[]; total_count: number }> {
    return this.req<{ items: GitHubRepo[]; total_count: number }>(
      `/search/repositories?q=${encodeURIComponent(q)}&sort=updated&per_page=30&page=${page}`
    );
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.req<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  async listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    return this.req<GitHubBranch[]>(`/repos/${owner}/${repo}/branches?per_page=50`);
  }

  async getTree(owner: string, repo: string, sha: string): Promise<GitHubTreeItem[]> {
    const data = await this.req<{ tree: GitHubTreeItem[]; truncated: boolean }>(
      `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`
    );
    return data.tree ?? [];
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const data = await this.req<GitHubFileContent>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`
    );
    if (data.encoding === "base64") {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    }
    return data.content;
  }

  async getFileInfo(owner: string, repo: string, path: string): Promise<GitHubFileContent> {
    return this.req<GitHubFileContent>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`
    );
  }

  async listPullRequests(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<GitHubPullRequest[]> {
    return this.req<GitHubPullRequest[]>(
      `/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`
    );
  }

  async listIssues(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<GitHubIssue[]> {
    return this.req<GitHubIssue[]>(
      `/repos/${owner}/${repo}/issues?state=${state}&per_page=30`
    );
  }

  async listCommits(owner: string, repo: string, branch?: string): Promise<GitHubCommit[]> {
    const q = branch ? `?sha=${branch}&per_page=20` : "?per_page=20";
    return this.req<GitHubCommit[]>(`/repos/${owner}/${repo}/commits${q}`);
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string,
    existingSha?: string
  ): Promise<void> {
    const encoded = Buffer.from(content, "utf-8").toString("base64");
    await this.req(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: encoded,
        branch,
        sha: existingSha,
      }),
    });
  }

  async downloadArchiveBuffer(owner: string, repo: string, ref = "HEAD"): Promise<Buffer> {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/tarball/${ref}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`GitHub archive download failed: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
}

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".kt", ".scala",
  ".cpp", ".c", ".h", ".hpp", ".cc",
  ".rb", ".php", ".swift", ".cs", ".dart",
  ".sh", ".bash", ".zsh", ".fish",
  ".md", ".mdx", ".txt", ".rst", ".adoc",
  ".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".env",
  ".html", ".htm", ".css", ".scss", ".sass", ".less",
  ".xml", ".sql", ".graphql", ".proto",
  ".dockerfile", ".gitignore", ".editorconfig",
  ".tf", ".hcl", ".bicep",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", "vendor", "dist", "build",
  "__pycache__", ".cache", ".next", ".nuxt", ".vite", "coverage",
  ".turbo", "target", "out", ".expo", "ios", "android",
]);

export function isTextFile(filePath: string): boolean {
  const parts = filePath.split("/");
  for (const part of parts) {
    if (SKIP_DIRS.has(part)) return false;
  }
  const dotIdx = filePath.lastIndexOf(".");
  if (dotIdx === -1) {
    const base = filePath.split("/").pop() ?? "";
    return ["Makefile", "Dockerfile", "Procfile", "Rakefile", "Gemfile", "Pipfile"].includes(base);
  }
  return TEXT_EXTENSIONS.has(filePath.slice(dotIdx).toLowerCase());
}

export function shouldSkipPath(filePath: string): boolean {
  const parts = filePath.split("/");
  for (const part of parts) {
    if (SKIP_DIRS.has(part)) return true;
  }
  return false;
}
