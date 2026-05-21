import { useState, useRef, useEffect } from "react";
import {
  Send, Terminal, Image as ImageIcon, Code, Sparkles, Loader2, Plus,
  Bot, Wrench, Database, ChevronDown, User, Cpu, SlidersHorizontal, X,
  Brain, Zap, Eye, Hash, GitBranch, Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  useChat, useListSessions, useGetSession, useListModels,
  useCreateSession, getListSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type ChatMode = "chat" | "code" | "agent";

const MODE_ICONS: Record<ChatMode, React.ReactNode> = {
  chat:  <Terminal className="w-3.5 h-3.5" />,
  code:  <Code className="w-3.5 h-3.5" />,
  agent: <Bot className="w-3.5 h-3.5" />,
};
const MODE_LABEL: Record<ChatMode, string> = { chat: "Chat", code: "Code", agent: "Agent" };

interface AgentStep {
  type: "thinking" | "tool_call" | "tool_result" | "final";
  content: string;
  toolName?: string;
  success?: boolean;
}

interface RoutingInfo {
  model: string;
  modelName: string;
  category: string;
  confidence: number;
  reason: string;
  pipeline: string[];
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  tokensUsed?: number;
  latencyMs?: number;
  agentSteps?: AgentStep[];
  model?: string;
  routing?: RoutingInfo;
  imageUrl?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  reasoning:    <Brain className="w-3 h-3" />,
  code:         <Code className="w-3 h-3" />,
  vision:       <Eye className="w-3 h-3" />,
  ocr:          <Eye className="w-3 h-3" />,
  "image-gen":  <ImageIcon className="w-3 h-3" />,
  fast:         <Zap className="w-3 h-3" />,
  multilingual: <Hash className="w-3 h-3" />,
  chat:         <Terminal className="w-3 h-3" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  reasoning:    "text-violet-400 border-violet-500/30 bg-violet-500/10",
  code:         "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  vision:       "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  ocr:          "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "image-gen":  "text-pink-400 border-pink-500/30 bg-pink-500/10",
  fast:         "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  multilingual: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  chat:         "text-primary border-primary/30 bg-primary/10",
};

const API_BASE = "/api";

async function runAgent(params: { message: string; model?: string }) {
  const res = await fetch(`${API_BASE}/internal/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": "aura-internal-dev-secret" },
    body: JSON.stringify({ ...params, mode: "chat" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ finalAnswer: string; steps: AgentStep[]; model: string }>;
}

function SettingsPanel({
  session, models, onClose,
}: {
  session: { model: string; ragEnabled: boolean; toolsEnabled: boolean; mode: string; messageCount: number; createdAt: string } | undefined;
  models: Array<{ id: string }> | undefined;
  onClose?: () => void;
}) {
  if (!session) return <p className="text-sm text-muted-foreground font-mono p-4">No session selected</p>;
  return (
    <div className="flex flex-col gap-6 p-4">
      {onClose && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Session Settings</span>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      )}
      <div>
        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Model</h3>
        <Select defaultValue={session.model || ""}>
          <SelectTrigger className="w-full h-9 text-xs font-mono">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {models?.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs font-mono">{m.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Capabilities</h3>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono flex items-center gap-1.5"><Database className="w-3 h-3" />RAG</span>
          <Switch checked={session.ragEnabled} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono flex items-center gap-1.5"><Wrench className="w-3 h-3" />Tools</span>
          <Switch checked={session.toolsEnabled} />
        </div>
      </div>
      <div>
        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Stats</h3>
        <div className="text-xs text-muted-foreground font-mono space-y-1">
          <p>Messages: {session.messageCount}</p>
          <p>Mode: {session.mode}</p>
          <p>Created: {new Date(session.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

export function Chat() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("chat");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [creatingSession, setCreatingSession] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingMessageRef = useRef<string | null>(null);

  const queryClient = useQueryClient();
  const { data: sessions, isLoading: sessionsLoading } = useListSessions();
  const { data: models } = useListModels();
  const { data: sessionDetail, isLoading: isLoadingSession } = useGetSession(
    activeSessionId || "",
    { query: { enabled: !!activeSessionId, queryKey: ["session", activeSessionId] } }
  );
  const createSession = useCreateSession();
  const chatMutation = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pick first existing session, or auto-create one when list loads empty
  useEffect(() => {
    if (sessionsLoading) return;
    if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0]!.id);
    } else if (sessions && sessions.length === 0 && !activeSessionId && !creatingSession) {
      setCreatingSession(true);
      createSession.mutate(
        { data: { title: "New Chat", mode: "chat" } },
        {
          onSuccess: (s) => {
            queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
            setActiveSessionId(s.id);
            setCreatingSession(false);
          },
          onError: () => setCreatingSession(false),
        }
      );
    }
  }, [sessions, sessionsLoading, activeSessionId, creatingSession]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [sessionDetail?.messages, localMessages, agentRunning]);

  useEffect(() => { setLocalMessages([]); }, [activeSessionId]);

  const allMessages: LocalMessage[] = [
    ...(sessionDetail?.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      tokensUsed: m.tokensUsed ?? undefined,
      latencyMs: m.latencyMs ?? undefined,
      model: m.model ?? undefined,
    })),
    ...localMessages,
  ];

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      // Strip the data:image/...;base64, prefix — send raw base64
      setImageBase64(dataUrl.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
    // Reset so same file can be picked again
    e.target.value = "";
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
  };

  const sendToSession = (sessionId: string, message: string, imgBase64?: string | null) => {
    chatMutation.mutate(
      {
        data: {
          sessionId,
          message,
          // Let the hybrid router decide — don't force a model
          mode: imgBase64 ? "vision" : mode === "code" ? "code" : "chat",
          ragEnabled: sessionDetail?.session?.ragEnabled ?? false,
          toolsEnabled: sessionDetail?.session?.toolsEnabled ?? false,
          ...(imgBase64 ? { imageBase64: imgBase64 } : {}),
        } as any,
      },
      {
        onSuccess: (data: any) => {
          // Capture routing decision from response and show inline
          if (data?.routing) {
            setLocalMessages((p) => [
              ...p,
              {
                id: data.message?.id ?? `r-${Date.now()}`,
                role: "assistant" as const,
                content: data.message?.content ?? "",
                model: data.routing.model,
                tokensUsed: data.message?.tokensUsed ?? undefined,
                latencyMs: data.message?.latencyMs ?? undefined,
                routing: data.routing as RoutingInfo,
              },
            ]);
          }
          queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
        },
        onError: (err: any) => {
          const raw = err?.response?.data?.error ?? err?.message ?? "Request failed";
          const isOllama =
            raw.includes("ECONNREFUSED") ||
            raw.includes("11434") ||
            raw.includes("fetch failed") ||
            raw.includes("Internal Server Error") ||
            raw.includes("500");
          setLocalMessages((p) => [
            ...p,
            {
              id: `err-${Date.now()}`,
              role: "assistant" as const,
              content: isOllama
                ? "⚠️ Ollama is not reachable or returned an error. Make sure the Ollama Server workflow is running, then try again."
                : `⚠️ ${raw}`,
            },
          ]);
        },
      }
    );
  };

  const handleSend = async () => {
    const message = input.trim();
    const img = imageBase64;
    const imgPreview = imagePreview;
    if (!message && !img) return;

    setInput("");
    clearImage();

    // Build the user message bubble (with optional image)
    const userMsg: LocalMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: message || "(image)",
      imageUrl: imgPreview ?? undefined,
    };

    if (mode === "agent") {
      setLocalMessages((p) => [...p, userMsg]);
      setAgentRunning(true);
      try {
        const result = await runAgent({ message, model: sessionDetail?.session?.model ?? undefined });
        setLocalMessages((p) => [...p, {
          id: `a-${Date.now()}`, role: "agent", content: result.finalAnswer,
          model: result.model, agentSteps: result.steps.filter((s) => s.type !== "final"),
        }]);
      } catch (err: any) {
        setLocalMessages((p) => [...p, { id: `e-${Date.now()}`, role: "assistant", content: `Agent error: ${err.message}` }]);
      } finally {
        setAgentRunning(false);
      }
      return;
    }

    // If a session is ready, send immediately
    if (activeSessionId && sessionDetail?.session) {
      sendToSession(activeSessionId, message || "Describe this image.", img);
      return;
    }

    // No session yet — auto-create one, then send
    setLocalMessages((p) => [...p, userMsg]);
    createSession.mutate(
      { data: { title: (message || "Image").slice(0, 40), mode: img ? "vision" : "chat" } },
      {
        onSuccess: (s) => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setActiveSessionId(s.id);
          setLocalMessages([]);
          sendToSession(s.id, message || "Describe this image.", img);
        },
        onError: () => {
          setLocalMessages((p) => [...p, { id: `e-${Date.now()}`, role: "assistant", content: "Failed to create session. Please try again." }]);
        },
      }
    );
  };

  const handleNewSession = () => {
    createSession.mutate(
      { data: { title: "New Session", mode: "chat" } },
      { onSuccess: (s) => { queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() }); setActiveSessionId(s.id); setLocalMessages([]); } }
    );
  };

  const toggleSteps = (id: string) => setExpandedSteps((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const isLoading = chatMutation.isPending || agentRunning;

  return (
    <div className="flex flex-col h-full">
      {/* Session tabs */}
      <div className="flex border-b border-border bg-card/50 px-2 py-1.5 gap-1.5 overflow-x-auto items-center shrink-0">
        <div className="flex gap-1.5 flex-1 overflow-x-auto min-w-0">
          {sessions?.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap border shrink-0 transition-colors ${
                activeSessionId === s.id
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.mode === "code" ? <Code className="w-3 h-3" /> : <Terminal className="w-3 h-3" />}
              <span className="max-w-[80px] truncate">{s.title}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 h-7 w-7 p-0" onClick={handleNewSession}>
          <Plus className="w-3.5 h-3.5" />
        </Button>

        {/* Mode switcher */}
        <div className="flex gap-0.5 bg-muted rounded-md p-0.5 shrink-0">
          {(["chat", "code", "agent"] as ChatMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {MODE_ICONS[m]}
              <span className="hidden sm:inline">{MODE_LABEL[m]}</span>
            </button>
          ))}
        </div>

        {/* Settings trigger (mobile) */}
        {mode !== "agent" && sessionDetail?.session && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden shrink-0 h-7 w-7 p-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-card border-border p-0">
              <SheetHeader className="px-4 pt-4 pb-2">
                <SheetTitle className="text-sm font-mono">Session Settings</SheetTitle>
              </SheetHeader>
              <SettingsPanel session={sessionDetail.session as any} models={models} />
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Messages + desktop settings panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col relative min-w-0">
          <div className="absolute inset-0 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3" ref={scrollRef}>
            {isLoadingSession && allMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : allMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 px-4 text-center">
                <Sparkles className="w-10 h-10 opacity-20" />
                <p className="font-mono text-sm">
                  {mode === "agent" ? "Agent mode — multi-step AI with tools" : "Start typing to chat with the AI"}
                </p>
                {mode === "agent" && (
                  <div className="flex gap-3 text-xs font-mono text-muted-foreground/60">
                    <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />tools</span>
                    <span className="flex items-center gap-1"><Database className="w-3 h-3" />memory</span>
                    <span className="flex items-center gap-1"><Bot className="w-3 h-3" />multi-step</span>
                  </div>
                )}
              </div>
            ) : (
              allMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role !== "user" && (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${msg.role === "agent" ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {msg.role === "agent" ? <Bot className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                    </div>
                  )}
                  <div className="flex flex-col gap-1 min-w-0 max-w-[85%] sm:max-w-[78%]">
                    {msg.role === "agent" && msg.agentSteps && msg.agentSteps.length > 0 && (
                      <div>
                        <button onClick={() => toggleSteps(msg.id)} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground">
                          <ChevronDown className={`w-3 h-3 transition-transform ${expandedSteps.has(msg.id) ? "rotate-180" : ""}`} />
                          {msg.agentSteps.length} step{msg.agentSteps.length !== 1 ? "s" : ""}
                        </button>
                        {expandedSteps.has(msg.id) && (
                          <div className="mt-1 flex flex-col gap-1">
                            {msg.agentSteps.map((step, i) => (
                              <div key={i} className={`text-[10px] font-mono px-2.5 py-1.5 rounded border ${
                                step.type === "tool_call" ? "bg-amber-500/5 border-amber-500/20 text-amber-400"
                                : step.type === "tool_result" ? (step.success === false ? "bg-destructive/5 border-destructive/20 text-destructive" : "bg-green-500/5 border-green-500/20 text-green-400")
                                : "bg-muted/50 border-border text-muted-foreground"
                              }`}>
                                <span className="opacity-50 mr-1">
                                  {step.type === "tool_call" ? "▶" : step.type === "tool_result" ? "◀" : "·"}
                                </span>
                                {step.toolName && <span className="text-amber-300 mr-1">[{step.toolName}]</span>}
                                {step.content.slice(0, 150)}{step.content.length > 150 ? "…" : ""}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Routing badge — shows which specialist was activated */}
                    {msg.routing && (
                      <div className={`self-start flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono ${CATEGORY_COLORS[msg.routing.category] ?? CATEGORY_COLORS["chat"]}`}>
                        {CATEGORY_ICONS[msg.routing.category] ?? <Terminal className="w-3 h-3" />}
                        <span>{msg.routing.modelName}</span>
                        {msg.routing.pipeline.length > 1 && (
                          <span className="flex items-center gap-0.5 opacity-60">
                            <GitBranch className="w-2.5 h-2.5" />
                            {msg.routing.pipeline.length}
                          </span>
                        )}
                        <span className="opacity-40">·</span>
                        <span className="opacity-60 capitalize">{msg.routing.category}</span>
                      </div>
                    )}
                    {/* Image attachment preview in bubble */}
                    {msg.imageUrl && (
                      <div className={`rounded-xl overflow-hidden max-w-[220px] ${msg.role === "user" ? "self-end" : "self-start"}`}>
                        <img src={msg.imageUrl} alt="attached" className="w-full object-cover rounded-xl" />
                      </div>
                    )}
                    {/* Only show text bubble if there's actual text content */}
                    {(msg.content && msg.content !== "(image)") && (
                      <div className={`rounded-xl px-3 py-2.5 ${
                        msg.role === "user" ? "bg-primary text-primary-foreground"
                        : msg.role === "agent" ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-muted border border-border"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed break-words">{msg.content}</p>
                        {msg.role !== "user" && (msg.tokensUsed || msg.latencyMs) && (
                          <div className="text-[10px] text-muted-foreground mt-1.5 flex gap-2 opacity-60">
                            {msg.latencyMs && <span>{msg.latencyMs}ms</span>}
                            {msg.tokensUsed && <span>{msg.tokensUsed} tok</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3 h-3" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${mode === "agent" ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                  {mode === "agent" ? <Bot className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                </div>
                <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2 ${mode === "agent" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-muted border border-border"}`}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-sm text-muted-foreground font-mono">
                    {mode === "agent" ? "Agent reasoning…" : "Routing to best model…"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop settings panel */}
        {mode !== "agent" && sessionDetail?.session && (
          <div className="hidden md:block w-56 border-l border-border bg-card/30 overflow-y-auto">
            <SettingsPanel session={sessionDetail.session as any} models={models} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 sm:px-4 border-t border-border bg-background shrink-0">
        <div className="flex flex-col gap-2 max-w-3xl mx-auto">

          {/* Image preview strip */}
          {imagePreview && (
            <div className="relative self-start">
              <img
                src={imagePreview}
                alt="attached"
                className="h-20 w-20 object-cover rounded-lg border border-border"
              />
              <button
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow-md"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagePick}
            />

            {/* Image upload button */}
            {mode !== "agent" && (
              <Button
                variant="outline"
                size="sm"
                className="h-12 w-12 shrink-0 p-0 border-border"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || creatingSession}
                title="Attach image"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            )}

            {mode === "agent" ? (
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Give the agent a task…"
                className="flex-1 font-mono text-sm bg-card border-border min-h-[48px] max-h-28 resize-none"
                disabled={isLoading}
                rows={1}
              />
            ) : (
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={
                  creatingSession ? "Setting up session…"
                  : imagePreview ? "Ask about this image… (or send as-is)"
                  : "Send a message…"
                }
                className="flex-1 font-mono text-sm bg-card border-border h-12"
                disabled={isLoading || creatingSession}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            )}

            <Button
              className={`h-12 w-12 shrink-0 ${mode === "agent" ? "bg-emerald-500 hover:bg-emerald-500/90 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"}`}
              onClick={handleSend}
              disabled={(!input.trim() && !imageBase64) || isLoading || creatingSession}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
