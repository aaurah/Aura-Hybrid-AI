import { useListModels, useGetOllamaStatus } from "@workspace/api-client-react";
import {
  Brain, Code2, Eye, ImageIcon, Zap, Hash,
  CheckCircle2, XCircle, ArrowRight, Cpu,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// ── Category metadata ──────────────────────────────────────────────────────
const CATEGORIES: {
  type: string;
  label: string;
  tagline: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  route?: { task: string; model: string; why: string }[];
}[] = [
  {
    type: "reasoning",
    label: "Reasoning",
    tagline: "Deep thinking · Planning · Agent loops",
    icon: <Brain className="w-5 h-5" />,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    route: [
      { task: "General chat",   model: "LLaMA 3.1 70B",  why: "Balanced intelligence" },
      { task: "Deep reasoning", model: "DeepSeek R1",    why: "Best chain-of-thought" },
      { task: "Multilingual",   model: "Qwen 2.5 72B",  why: "Best global language support" },
    ],
  },
  {
    type: "code",
    label: "Coding",
    tagline: "Code gen · Debug · Refactor · DevOps",
    icon: <Code2 className="w-5 h-5" />,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    route: [
      { task: "Code generation", model: "DeepSeek Coder V3", why: "Strongest open-source coder" },
      { task: "Enterprise code", model: "Code LLaMA 70B",    why: "Stable and predictable" },
      { task: "Multi-language",  model: "StarCoder2",        why: "Large repo understanding" },
    ],
  },
  {
    type: "vision",
    label: "Vision",
    tagline: "Image read · OCR · UI analysis",
    icon: <Eye className="w-5 h-5" />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    route: [
      { task: "Vision read", model: "LLaVA 1.6",  why: "Best image understanding" },
      { task: "OCR",         model: "Qwen-VL",    why: "Strong text extraction" },
      { task: "Edge vision", model: "Moondream 2", why: "Extremely fast" },
    ],
  },
  {
    type: "image-gen",
    label: "Image Generation",
    tagline: "Generate · Upscale · Inpaint · Variations",
    icon: <ImageIcon className="w-5 h-5" />,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    route: [
      { task: "Image generation", model: "Flux 1.1",           why: "Best open-source generator" },
      { task: "Customizable",     model: "SDXL 1.0",           why: "Stable and flexible" },
      { task: "Photorealism",     model: "Stable Diffusion 3", why: "Best realism" },
    ],
  },
  {
    type: "fast",
    label: "Fast / Edge",
    tagline: "Low latency · Mobile · Offline · Fallback",
    icon: <Zap className="w-5 h-5" />,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    route: [
      { task: "Fast responses", model: "Phi-3 Mini",  why: "Tiny + fast" },
      { task: "High quality",   model: "Gemma 2 9B",  why: "Best small model" },
      { task: "Reliable",       model: "Mistral 7B",  why: "Fast and dependable" },
    ],
  },
  {
    type: "embed",
    label: "Embeddings",
    tagline: "RAG · Semantic search · Memory",
    icon: <Hash className="w-5 h-5" />,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
];

// ── Hybrid routing table ───────────────────────────────────────────────────
const ROUTING_TABLE = [
  { task: "General chat",    model: "LLaMA 3.1 70B",    why: "Balanced intelligence",        signal: "default" },
  { task: "Deep reasoning",  model: "DeepSeek R1",      why: "Best chain-of-thought",         signal: "explain / analyze / why" },
  { task: "Coding",          model: "DeepSeek Coder V3", why: "Strongest coder",              signal: "code / debug / function" },
  { task: "Vision read",     model: "LLaVA 1.6",        why: "Best image understanding",      signal: "image attached" },
  { task: "OCR",             model: "Qwen-VL",          why: "Strong text extraction",        signal: "ocr / extract text" },
  { task: "Image gen",       model: "Flux 1.1",         why: "Best open-source generator",    signal: "generate image / draw" },
  { task: "Fast responses",  model: "Phi-3 Mini",       why: "Tiny + fast",                   signal: "short / trivial message" },
  { task: "Multilingual",    model: "Qwen 2.5 72B",     why: "Best global language support",  signal: "translate / non-English" },
];

export function Models() {
  const { data: models } = useListModels();
  const { data: ollamaStatus } = useGetOllamaStatus();

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    models: (models ?? []).filter((m) => m.type === cat.type),
  }));

  const totalAvailable = (models ?? []).filter((m) => m.available).length;
  const totalModels    = (models ?? []).length;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto flex flex-col gap-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Hybrid Model Stack</h1>
        <p className="text-muted-foreground text-sm font-mono mt-0.5">
          AuraAI routes each request to the right specialist automatically
        </p>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 p-3 sm:p-4 border border-border bg-card rounded-lg flex-wrap gap-y-2">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ollamaStatus?.connected ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-red-500"}`} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Ollama Server</span>
          <span className="text-xs text-muted-foreground font-mono">{ollamaStatus?.baseUrl || "http://localhost:11434"}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {ollamaStatus?.version && (
            <span className="text-xs font-mono text-muted-foreground">v{ollamaStatus.version}</span>
          )}
          <Badge variant="outline" className="font-mono text-xs">
            {totalAvailable}/{totalModels} ready
          </Badge>
        </div>
      </div>

      {/* Hybrid routing table */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          Hybrid Routing Table
        </h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="hidden sm:grid grid-cols-4 gap-0 bg-muted/40 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <div className="px-4 py-2.5">Task</div>
            <div className="px-4 py-2.5">Model</div>
            <div className="px-4 py-2.5">Why</div>
            <div className="px-4 py-2.5">Auto-detect signal</div>
          </div>
          {ROUTING_TABLE.map((row, i) => (
            <div
              key={row.task}
              className={`grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-0 px-4 py-3 sm:py-2.5 text-sm ${i % 2 === 0 ? "bg-card" : "bg-muted/20"} border-t border-border first:border-t-0`}
            >
              <div className="font-semibold sm:font-normal text-foreground">{row.task}</div>
              <div className="font-mono text-xs text-primary">{row.model}</div>
              <div className="text-muted-foreground text-xs hidden sm:block">{row.why}</div>
              <div className="text-muted-foreground text-xs font-mono sm:block">
                <span className="sm:hidden text-muted-foreground/50">signal: </span>{row.signal}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category sections */}
      {grouped.map((cat) => (
        <div key={cat.type}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`p-1.5 rounded-md ${cat.bg} ${cat.color}`}>{cat.icon}</div>
            <div>
              <h2 className="text-base font-semibold leading-tight">{cat.label}</h2>
              <p className="text-xs text-muted-foreground">{cat.tagline}</p>
            </div>
            {cat.route && (
              <div className="ml-auto hidden sm:flex items-center gap-1 text-xs text-muted-foreground font-mono">
                {cat.route.slice(0, 1).map((r) => (
                  <span key={r.task} className="flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />
                    <span className={cat.color}>{r.model}</span>
                    <span>for {r.task.toLowerCase()}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {cat.models.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono pl-1">No models registered for this category yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {cat.models.map((model) => (
                <Card
                  key={model.id}
                  className={`bg-card shadow-none hover:${cat.border} transition-colors border-border`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start mb-1.5">
                      <div className={`p-1.5 rounded-md ${cat.bg} ${cat.color}`}>
                        {cat.icon}
                      </div>
                      {model.available ? (
                        <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10 font-mono text-[10px] gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground bg-muted font-mono text-[10px] gap-1">
                          <XCircle className="w-3 h-3" /> Not pulled
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-sm font-semibold leading-tight">{model.displayName}</CardTitle>
                    <CardDescription className="font-mono text-[10px] text-muted-foreground">{model.id}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{model.description}</p>
                    {(model.defaultTemperature > 0 || model.defaultMaxTokens > 0) && (
                      <div className="flex gap-1.5 font-mono text-[10px] text-muted-foreground flex-wrap">
                        {model.defaultTemperature > 0 && (
                          <div className="bg-background border border-border px-1.5 py-0.5 rounded">
                            temp {model.defaultTemperature}
                          </div>
                        )}
                        {model.defaultMaxTokens > 0 && (
                          <div className="bg-background border border-border px-1.5 py-0.5 rounded">
                            {model.defaultMaxTokens.toLocaleString()} ctx
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
