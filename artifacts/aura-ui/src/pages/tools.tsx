import { useState } from "react";
import { Wrench, Play, Loader2, CheckCircle2, XCircle, Globe, Terminal, GitBranch } from "lucide-react";
import { useListTools, useRunTool } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  http:  <Globe className="w-4 h-4" />,
  shell: <Terminal className="w-4 h-4" />,
  git:   <GitBranch className="w-4 h-4" />,
  eval:  <Wrench className="w-4 h-4" />,
};
const TYPE_COLORS: Record<string, string> = {
  http:  "border-blue-500/30 text-blue-400 bg-blue-500/10",
  shell: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  git:   "border-purple-500/30 text-purple-400 bg-purple-500/10",
  eval:  "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
};

export function Tools() {
  const { data: tools, isLoading } = useListTools();
  const runTool = useRunTool();

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [inputJson, setInputJson] = useState("{}");
  const [result, setResult] = useState<any>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const selectedToolDef = tools?.find((t) => t.name === selectedTool);

  const handleRun = () => {
    if (!selectedTool) return;
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(inputJson); setJsonError(null); }
    catch { setJsonError("Invalid JSON"); return; }
    runTool.mutate({ data: { tool: selectedTool, input: parsed } }, {
      onSuccess: (data) => setResult(data),
    });
  };

  const handleSelect = (name: string) => {
    setSelectedTool(name);
    setResult(null);
    setInputJson("{}");
    setSheetOpen(true);
  };

  const ExecutePanel = () => (
    <div className="flex flex-col gap-4">
      {selectedToolDef && (
        <div className="p-3 bg-muted/40 rounded-lg">
          <p className="text-xs font-mono text-muted-foreground">{selectedToolDef.description}</p>
          {selectedToolDef.inputSchema && (
            <pre className="text-[10px] font-mono text-muted-foreground/70 mt-2 overflow-auto max-h-24 whitespace-pre-wrap">
              {JSON.stringify(selectedToolDef.inputSchema, null, 2)}
            </pre>
          )}
        </div>
      )}
      <div>
        <label className="text-xs font-mono text-muted-foreground mb-1 block uppercase tracking-wider">JSON Input</label>
        <Textarea
          value={inputJson}
          onChange={(e) => setInputJson(e.target.value)}
          placeholder='{ "url": "https://example.com" }'
          className="font-mono text-xs bg-background border-border resize-none h-28"
          disabled={!selectedTool}
        />
        {jsonError && <p className="text-xs text-destructive mt-1 font-mono">{jsonError}</p>}
      </div>
      <Button onClick={handleRun} disabled={!selectedTool || runTool.isPending} className="w-full gap-2 font-mono">
        {runTool.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {runTool.isPending ? "Running…" : "Run Tool"}
      </Button>
      {result && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className={`flex items-center gap-2 px-3 py-2 text-xs font-mono border-b border-border ${result.success ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
            {result.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {result.success ? "Success" : "Failed"} · {result.durationMs}ms
          </div>
          <div className="p-3 bg-background">
            <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap overflow-auto max-h-40">{result.error ?? result.output ?? "No output"}</pre>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tool Explorer</h1>
        <p className="text-muted-foreground text-sm font-mono mt-0.5">Browse and execute available tools</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tool list */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Tools</h2>
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono p-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {tools?.map((tool) => (
            <button
              key={tool.name}
              onClick={() => handleSelect(tool.name)}
              className={`text-left p-3 sm:p-4 border rounded-lg transition-all ${
                selectedTool === tool.name
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="text-muted-foreground">{TYPE_ICONS[tool.type] ?? <Wrench className="w-4 h-4" />}</div>
                  <span className="font-mono text-sm font-semibold">{tool.name}</span>
                </div>
                <Badge variant="outline" className={`font-mono text-[10px] ${TYPE_COLORS[tool.type] ?? ""}`}>
                  {tool.type}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{tool.description}</p>
            </button>
          ))}
        </div>

        {/* Execute panel — desktop only */}
        <div className="hidden lg:flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Execute Tool</h2>
          <Card className="bg-card border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                {selectedTool ? <>{TYPE_ICONS[selectedToolDef?.type ?? ""] ?? <Wrench className="w-4 h-4" />}{selectedTool}</> : <span className="text-muted-foreground">Select a tool</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ExecutePanel />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile sheet for execute panel */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="lg:hidden h-[85dvh] bg-card border-border rounded-t-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-mono text-sm flex items-center gap-2">
              {selectedTool ? <>{TYPE_ICONS[selectedToolDef?.type ?? ""] ?? <Wrench className="w-4 h-4" />}{selectedTool}</> : "Execute Tool"}
            </SheetTitle>
          </SheetHeader>
          <ExecutePanel />
        </SheetContent>
      </Sheet>
    </div>
  );
}
