import { useGetAdminStats, useGetAdminLogs, useGetOllamaStatus } from "@workspace/api-client-react";
import { Activity, MessageSquare, Database, Wrench, Zap, Server, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: React.ReactNode; sub?: string }) {
  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
        <div className="text-primary/60">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {sub && <p className="text-xs text-muted-foreground font-mono mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const LOG_TYPE_COLORS: Record<string, string> = {
  chat: "border-primary/30 text-primary bg-primary/10",
  tool: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  rag: "border-purple-500/30 text-purple-400 bg-purple-500/10",
  error: "border-destructive/30 text-destructive bg-destructive/10",
};

export function Admin() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: logs, isLoading: logsLoading } = useGetAdminLogs();
  const { data: ollamaStatus } = useGetOllamaStatus();

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm font-mono">Platform statistics, observability, and Ollama server status</p>
      </div>

      {/* Ollama Server Status */}
      <div className="flex items-center gap-4 p-4 border border-border bg-card rounded-lg">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${ollamaStatus?.connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"}`} />
          <Server className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Ollama Server</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{ollamaStatus?.baseUrl ?? "http://localhost:11434"}</span>
        {ollamaStatus?.version && (
          <span className="font-mono text-xs text-muted-foreground">v{ollamaStatus.version}</span>
        )}
        <div className="ml-auto flex gap-2 flex-wrap">
          {ollamaStatus?.availableModels?.slice(0, 6).map((m) => (
            <Badge key={m} variant="outline" className="font-mono text-[10px] border-border text-muted-foreground">
              {m}
            </Badge>
          ))}
          {(ollamaStatus?.availableModels?.length ?? 0) > 6 && (
            <Badge variant="outline" className="font-mono text-[10px] border-border text-muted-foreground">
              +{(ollamaStatus?.availableModels?.length ?? 0) - 6} more
            </Badge>
          )}
          {ollamaStatus && !ollamaStatus.connected && (
            <span className="text-xs text-destructive font-mono">{ollamaStatus.error ?? "Not connected"}</span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading stats...
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Sessions" value={stats?.totalSessions ?? 0} icon={<MessageSquare className="w-4 h-4" />} />
          <StatCard label="Messages" value={stats?.totalMessages ?? 0} icon={<Activity className="w-4 h-4" />} />
          <StatCard label="Documents" value={stats?.totalDocuments ?? 0} icon={<Database className="w-4 h-4" />} />
          <StatCard label="Tool Runs" value={stats?.totalToolRuns ?? 0} icon={<Wrench className="w-4 h-4" />} />
          <StatCard label="Avg Response" value={`${stats?.avgResponseMs ?? 0}ms`} icon={<Zap className="w-4 h-4" />} sub="average latency" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Model Usage */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model Usage</h2>
          <Card className="bg-card border-border shadow-none">
            <CardContent className="pt-4">
              {stats?.modelUsage?.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono py-4 text-center">No model usage yet</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stats?.modelUsage?.map((m) => (
                    <div key={m.model} className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm">{m.model}</span>
                        <div className="text-[10px] font-mono text-muted-foreground">{m.tokens.toLocaleString()} tokens</div>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs border-border">
                        {m.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
          <Card className="bg-card border-border shadow-none">
            <CardContent className="pt-4">
              {stats?.recentActivity?.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono py-4 text-center">No recent activity</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {stats?.recentActivity?.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0">
                      <span className="text-sm text-foreground">{item.description}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-4">
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

      {/* Logs Table */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Logs</h2>
        {logsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading logs...
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium w-20">Type</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Summary</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium w-24">Model</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium w-20">Latency</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium w-16">Status</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium w-28">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No logs yet</td>
                  </tr>
                )}
                {logs?.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-[10px] ${LOG_TYPE_COLORS[log.type] ?? "border-border"}`}>
                        {log.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-foreground max-w-xs truncate">{log.summary}</td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate">{log.model ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{log.latencyMs != null ? `${log.latencyMs}ms` : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {log.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-destructive ml-auto" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">
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
