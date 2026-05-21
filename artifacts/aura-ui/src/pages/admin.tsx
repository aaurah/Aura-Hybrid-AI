import { useState } from "react";
import { useGetAdminStats, useGetAdminLogs, useGetOllamaStatus } from "@workspace/api-client-react";
import {
  Activity, MessageSquare, Database, Wrench, Zap, Server,
  CheckCircle2, XCircle, Loader2, RefreshCw, Bot, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: React.ReactNode; sub?: string }) {
  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
        <div className="text-primary/60">{icon}</div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</div>
        {sub && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const LOG_TYPE_COLORS: Record<string, string> = {
  chat:  "border-primary/30 text-primary bg-primary/10",
  tool:  "border-amber-500/30 text-amber-400 bg-amber-500/10",
  rag:   "border-purple-500/30 text-purple-400 bg-purple-500/10",
  agent: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
  error: "border-destructive/30 text-destructive bg-destructive/10",
};

export function Admin() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useGetAdminLogs();
  const { data: ollamaStatus, refetch: refetchOllama } = useGetOllamaStatus();
  const { toast } = useToast();
  const [reloading, setReloading] = useState(false);

  const handleReloadConfig = async () => {
    setReloading(true);
    try {
      const res = await fetch("/api/v1/admin/reload-config", { method: "POST" });
      const data = await res.json() as { status: string; models?: number; tools?: number };
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Config reloaded", description: `${data.models} models, ${data.tools} tools` });
    } catch {
      toast({ title: "Reload failed", variant: "destructive" });
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground text-sm font-mono mt-0.5">Platform stats, observability, Ollama status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5" onClick={handleReloadConfig} disabled={reloading}>
            {reloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Reload Config</span>
          </Button>
          <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5" onClick={() => refetchLogs()}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh Logs</span>
          </Button>
        </div>
      </div>

      {/* Ollama status */}
      <div className="flex items-center gap-3 p-3 sm:p-4 border border-border bg-card rounded-lg flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${ollamaStatus?.connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"}`} />
          <Server className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Ollama</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground truncate">{ollamaStatus?.baseUrl ?? "http://localhost:11434"}</span>
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {ollamaStatus?.availableModels?.slice(0, 3).map((m) => (
            <Badge key={m} variant="outline" className="font-mono text-[10px] border-border text-muted-foreground hidden sm:inline-flex">{m}</Badge>
          ))}
          {(ollamaStatus?.availableModels?.length ?? 0) > 3 && (
            <Badge variant="outline" className="font-mono text-[10px] border-border text-muted-foreground hidden sm:inline-flex">
              +{(ollamaStatus?.availableModels?.length ?? 0) - 3}
            </Badge>
          )}
          {ollamaStatus && !ollamaStatus.connected && (
            <span className="text-xs text-destructive font-mono">Offline</span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchOllama()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading stats…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Sessions" value={stats?.totalSessions ?? 0} icon={<MessageSquare className="w-4 h-4" />} />
          <StatCard label="Messages" value={stats?.totalMessages ?? 0} icon={<Activity className="w-4 h-4" />} />
          <StatCard label="Documents" value={stats?.totalDocuments ?? 0} icon={<Database className="w-4 h-4" />} />
          <StatCard label="Tool Runs" value={stats?.totalToolRuns ?? 0} icon={<Wrench className="w-4 h-4" />} />
          <StatCard label="Avg Response" value={`${stats?.avgResponseMs ?? 0}ms`} icon={<Zap className="w-4 h-4" />} sub="latency" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model usage + API info */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model Usage</h2>
          <Card className="bg-card border-border shadow-none">
            <CardContent className="pt-4">
              {!stats?.modelUsage?.length ? (
                <p className="text-sm text-muted-foreground font-mono py-3 text-center">No usage yet</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stats.modelUsage.map((m) => (
                    <div key={m.model} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-sm truncate block">{m.model}</span>
                        <div className="text-[10px] font-mono text-muted-foreground">{Number(m.tokens).toLocaleString()} tok</div>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs border-border shrink-0">{m.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* API layers */}
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">API Layers</h2>
          <Card className="bg-card border-border shadow-none">
            <CardContent className="pt-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold font-mono">External /v1/</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">JWT + API key auth · RBAC</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Bot className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold font-mono">Internal /internal/</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Secret header gated</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
          <Card className="bg-card border-border shadow-none">
            <CardContent className="pt-4">
              {!stats?.recentActivity?.length ? (
                <p className="text-sm text-muted-foreground font-mono py-3 text-center">No activity yet</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {stats.recentActivity.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 gap-3 first:pt-0">
                      <span className="text-sm text-foreground truncate">{item.description}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Logs */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Logs</h2>
        {logsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-xs font-mono min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Type</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Summary</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Model</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">ms</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">OK</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {(!logs || (Array.isArray(logs) && logs.length === 0)) && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No logs yet</td></tr>
                )}
                {Array.isArray(logs) && logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[9px] px-1.5 ${LOG_TYPE_COLORS[log.type] ?? "border-border"}`}>{log.type}</Badge>
                    </td>
                    <td className="px-3 py-2 max-w-[160px] truncate text-foreground">{log.summary}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate hidden sm:table-cell">{log.model ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{log.latencyMs != null ? log.latencyMs : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {log.success ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" /> : <XCircle className="w-3.5 h-3.5 text-destructive ml-auto" />}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
