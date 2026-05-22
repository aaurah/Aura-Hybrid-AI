import { useState, useEffect, useCallback } from "react";
import {
  Github, Link2, Link2Off, Search, RefreshCw, Download, Trash2,
  Star, GitFork, AlertCircle, CheckCircle2, Loader2, ExternalLink,
  FileCode, GitBranch, GitPullRequest, BookOpen, Lock, Globe,
  ChevronRight, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth";

const API = "/api";

type GHStatus = {
  connected: boolean;
  login?: string;
  name?: string | null;
  avatarUrl?: string;
  publicRepos?: number;
  profileUrl?: string;
};

type GHRepo = {
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
  pushed_at: string;
  size: number;
};

type GHImport = {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  filesImported: string;
  status: string;
  lastSyncedAt: string | null;
};

function useGitHub(token: string | null) {
  const headers = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token]
  );

  const get = useCallback(
    async (path: string) => {
      const r = await fetch(`${API}${path}`, { headers: headers() });
      if (!r.ok) throw new Error((await r.json()).error ?? "Request failed");
      return r.json();
    },
    [headers]
  );

  const post = useCallback(
    async (path: string, body?: object) => {
      const r = await fetch(`${API}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body ?? {}) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Request failed");
      return r.json();
    },
    [headers]
  );

  const del = useCallback(
    async (path: string) => {
      const r = await fetch(`${API}${path}`, { method: "DELETE", headers: headers() });
      if (!r.ok) throw new Error((await r.json()).error ?? "Request failed");
      return r.json();
    },
    [headers]
  );

  return { get, post, del };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtSize(kb: number) {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function GitHub() {
  const { token } = useAuth();
  const { get, post, del } = useGitHub(token);

  const [status, setStatus] = useState<GHStatus | null>(null);
  const [pat, setPat] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState("");

  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const [imports, setImports] = useState<GHImport[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<"repos" | "imported">("repos");
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const s = await get("/v1/github/status");
      setStatus(s);
    } catch {
      setStatus({ connected: false });
    }
  }, [get]);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const d = await get("/v1/github/repos");
      setRepos(d.repos ?? []);
    } catch {
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }, [get]);

  const loadImports = useCallback(async () => {
    try {
      const d = await get("/v1/github/imports");
      setImports(d.imports ?? []);
    } catch { /* ignore */ }
  }, [get]);

  useEffect(() => {
    loadStatus();
    loadImports();
  }, [loadStatus, loadImports]);

  useEffect(() => {
    if (status?.connected) {
      loadRepos();
      loadImports();
    }
  }, [status?.connected, loadRepos, loadImports]);

  const handleConnect = async () => {
    if (!pat.trim()) return;
    setConnecting(true);
    setConnectErr("");
    try {
      await post("/v1/github/connect", { token: pat.trim() });
      setPat("");
      await loadStatus();
    } catch (err: any) {
      setConnectErr(err.message ?? "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await del("/v1/github/disconnect");
      setStatus({ connected: false });
      setRepos([]);
      setImports([]);
    } catch { /* ignore */ }
  };

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) { loadRepos(); return; }
    setSearching(true);
    try {
      const d = await get(`/v1/github/repos/search?q=${encodeURIComponent(q)}`);
      setRepos(d.repos ?? []);
    } catch {
      setRepos([]);
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (owner: string, repo: string) => {
    const key = `${owner}/${repo}`;
    setImportingId(key);
    setImportErr((p) => ({ ...p, [key]: "" }));
    try {
      await post(`/v1/github/repos/${owner}/${repo}/import`);
      await loadImports();
    } catch (err: any) {
      setImportErr((p) => ({ ...p, [key]: err.message ?? "Import failed" }));
    } finally {
      setImportingId(null);
    }
  };

  const handleDeleteImport = async (owner: string, repo: string) => {
    try {
      await del(`/v1/github/imports/${owner}/${repo}`);
      await loadImports();
    } catch { /* ignore */ }
  };

  const importedSet = new Set(imports.map((i) => `${i.owner}/${i.repo}`));

  if (!status) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      {/* Header */}
      <div className="px-4 sm:px-6 py-5 border-b border-border bg-card/40 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-foreground/10 flex items-center justify-center">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold">GitHub Integration</h1>
              <p className="text-xs text-muted-foreground">Connect repos, browse code, import to knowledge base</p>
            </div>
          </div>
          {status.connected && (
            <div className="flex items-center gap-2">
              {status.avatarUrl && (
                <img src={status.avatarUrl} alt={status.login} className="w-7 h-7 rounded-full border border-border" />
              )}
              <div className="text-xs">
                <p className="font-medium">{status.name ?? status.login}</p>
                <p className="text-muted-foreground">@{status.login}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleDisconnect}
              >
                <Link2Off className="w-3.5 h-3.5 mr-1" />
                Disconnect
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 py-5 space-y-5 max-w-4xl">

        {/* ── Connect panel ─────────────────────────────────── */}
        {!status.connected && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="w-4 h-4 text-primary" />
              Connect your GitHub account
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter a GitHub Personal Access Token (PAT) with <code className="bg-muted px-1 rounded">repo</code> scope.
              {" "}<a href="https://github.com/settings/tokens/new?scopes=repo,read:user" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">Generate one here →</a>
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                className="h-9 text-sm font-mono flex-1"
              />
              <Button size="sm" onClick={handleConnect} disabled={connecting || !pat.trim()} className="h-9 shrink-0">
                {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5 mr-1" />}
                {connecting ? "Connecting…" : "Connect"}
              </Button>
            </div>
            {connectErr && <p className="text-xs text-destructive">{connectErr}</p>}
          </div>
        )}

        {/* ── Connected ─────────────────────────────────────── */}
        {status.connected && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
              {(["repos", "imported"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                    activeTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "imported" ? `Imported (${imports.length})` : "Repositories"}
                </button>
              ))}
            </div>

            {/* ── Repos tab ─────────────────────────────────── */}
            {activeTab === "repos" && (
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search repositories…"
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                  {(reposLoading || searching) && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Repo list */}
                <div className="space-y-2">
                  {repos.length === 0 && !reposLoading && (
                    <p className="text-xs text-muted-foreground py-6 text-center">No repositories found</p>
                  )}
                  {repos.map((r) => {
                    const key = r.full_name;
                    const alreadyImported = importedSet.has(key);
                    const isImporting = importingId === key;
                    const err = importErr[key];
                    const isExpanded = expandedRepo === key;

                    return (
                      <div key={r.id} className="rounded-lg border border-border bg-card overflow-hidden">
                        {/* Repo header */}
                        <div
                          className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedRepo(isExpanded ? null : key)}
                        >
                          <div className="mt-0.5 shrink-0 text-muted-foreground">
                            {r.private ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{r.full_name}</span>
                              {r.language && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  {r.language}
                                </Badge>
                              )}
                              {alreadyImported && (
                                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-400 border-green-500/20">
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />imported
                                </Badge>
                              )}
                            </div>
                            {r.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-0.5"><Star className="w-3 h-3" />{r.stargazers_count}</span>
                              <span className="flex items-center gap-0.5"><GitFork className="w-3 h-3" />{r.forks_count}</span>
                              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{timeAgo(r.pushed_at)}</span>
                              <span>{fmtSize(r.size)}</span>
                            </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </div>

                        {/* Expanded actions */}
                        {isExpanded && (
                          <div className="border-t border-border px-3 py-2.5 bg-muted/20 flex flex-wrap gap-2">
                            <a href={r.html_url} target="_blank" rel="noreferrer">
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                <ExternalLink className="w-3 h-3 mr-1" />View on GitHub
                              </Button>
                            </a>
                            <Button
                              variant={alreadyImported ? "outline" : "default"}
                              size="sm"
                              className="h-7 text-xs"
                              disabled={isImporting}
                              onClick={() => handleImport(r.full_name.split("/")[0]!, r.name)}
                            >
                              {isImporting
                                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Importing…</>
                                : alreadyImported
                                ? <><RefreshCw className="w-3 h-3 mr-1" />Re-sync to KB</>
                                : <><Download className="w-3 h-3 mr-1" />Import to Knowledge Base</>}
                            </Button>
                            {err && <p className="text-[10px] text-destructive w-full mt-1">{err}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Imported tab ──────────────────────────────── */}
            {activeTab === "imported" && (
              <div className="space-y-2">
                {imports.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <BookOpen className="w-8 h-8 opacity-20 mx-auto mb-2" />
                    <p className="text-sm">No repos imported yet</p>
                    <p className="text-xs mt-1">Switch to Repositories tab and import a repo</p>
                  </div>
                ) : imports.map((imp) => (
                  <div key={imp.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{imp.owner}/{imp.repo}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 ${
                            imp.status === "done" ? "text-green-400 border-green-500/20 bg-green-500/10"
                            : imp.status === "error" ? "text-destructive border-destructive/20"
                            : "text-yellow-400 border-yellow-500/20 bg-yellow-500/10"
                          }`}
                        >
                          {imp.status === "done" ? <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> : imp.status === "error" ? <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> : <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" />}
                          {imp.status}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-3">
                        <span className="flex items-center gap-0.5"><GitBranch className="w-3 h-3" />{imp.branch}</span>
                        <span className="flex items-center gap-0.5"><FileCode className="w-3 h-3" />{imp.filesImported} files</span>
                        {imp.lastSyncedAt && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{timeAgo(imp.lastSyncedAt)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={importingId === `${imp.owner}/${imp.repo}`}
                        onClick={() => handleImport(imp.owner, imp.repo)}
                        title="Re-sync"
                      >
                        {importingId === `${imp.owner}/${imp.repo}`
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:text-destructive"
                        onClick={() => handleDeleteImport(imp.owner, imp.repo)}
                        title="Remove import"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
