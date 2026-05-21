import { useListModels, useGetOllamaStatus } from "@workspace/api-client-react";
import { Cpu, CheckCircle2, XCircle, Terminal, Code, Image as ImageIcon, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  code:   <Code className="w-5 h-5" />,
  vision: <ImageIcon className="w-5 h-5" />,
  embed:  <Hash className="w-5 h-5" />,
  chat:   <Terminal className="w-5 h-5" />,
};

export function Models() {
  const { data: models } = useListModels();
  const { data: ollamaStatus } = useGetOllamaStatus();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Model Registry</h1>
        <p className="text-muted-foreground text-sm font-mono mt-0.5">Available LLMs and vision models for execution</p>
      </div>

      {/* Ollama status bar */}
      <div className="flex items-center gap-3 p-3 sm:p-4 border border-border bg-card rounded-lg flex-wrap">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ollamaStatus?.connected ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-red-500"}`} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Ollama Server</span>
          <span className="text-xs text-muted-foreground font-mono">{ollamaStatus?.baseUrl || "http://localhost:11434"}</span>
        </div>
        <div className="ml-auto text-xs font-mono text-muted-foreground">
          {ollamaStatus?.version ? `v${ollamaStatus.version}` : "Unknown version"}
        </div>
      </div>

      {/* Model grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {models?.map((model) => (
          <Card key={model.id} className="bg-card border-border shadow-none hover:border-primary/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-primary/10 text-primary rounded-md">
                  {TYPE_ICONS[model.type] ?? <Terminal className="w-5 h-5" />}
                </div>
                {model.available ? (
                  <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10 font-mono text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground bg-muted font-mono text-[10px] gap-1">
                    <XCircle className="w-3 h-3" /> Missing
                  </Badge>
                )}
              </div>
              <CardTitle className="text-base sm:text-lg leading-tight">{model.displayName}</CardTitle>
              <CardDescription className="font-mono text-xs text-muted-foreground">{model.id}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{model.description}</p>
              <div className="flex gap-2 font-mono text-[10px] text-muted-foreground flex-wrap">
                <div className="bg-background border border-border px-2 py-1 rounded">temp: {model.defaultTemperature}</div>
                <div className="bg-background border border-border px-2 py-1 rounded">ctx: {model.defaultMaxTokens}</div>
                <div className="bg-background border border-border px-2 py-1 rounded capitalize">{model.type}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
