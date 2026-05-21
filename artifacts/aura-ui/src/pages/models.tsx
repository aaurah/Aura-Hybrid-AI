import { useListModels, useGetOllamaStatus } from "@workspace/api-client-react";
import { Cpu, CheckCircle2, XCircle, Terminal, Code, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Models() {
  const { data: models } = useListModels();
  const { data: ollamaStatus } = useGetOllamaStatus();

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Model Registry</h1>
        <p className="text-muted-foreground text-sm font-mono">Available LLMs and vision models for execution</p>
      </div>

      <div className="flex items-center gap-4 p-4 border border-border bg-card rounded-lg">
        <div className={`w-3 h-3 rounded-full ${ollamaStatus?.connected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Ollama Server</span>
          <span className="text-xs text-muted-foreground font-mono">{ollamaStatus?.baseUrl || 'http://localhost:11434'}</span>
        </div>
        <div className="ml-auto text-xs font-mono text-muted-foreground">
          {ollamaStatus?.version ? `v${ollamaStatus.version}` : 'Unknown version'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models?.map((model) => (
          <Card key={model.id} className="bg-card border-border shadow-none hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-primary/10 text-primary rounded-md">
                  {model.type === 'code' ? <Code className="w-5 h-5" /> : model.type === 'vision' ? <ImageIcon className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
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
              <CardTitle className="text-lg">{model.displayName}</CardTitle>
              <CardDescription className="font-mono text-xs text-muted-foreground">{model.id}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4 h-10 overflow-hidden text-ellipsis line-clamp-2">
                {model.description}
              </p>
              <div className="flex gap-2 font-mono text-[10px] text-muted-foreground">
                <div className="bg-background border border-border px-2 py-1 rounded">
                  temp: {model.defaultTemperature}
                </div>
                <div className="bg-background border border-border px-2 py-1 rounded">
                  ctx: {model.defaultMaxTokens}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
