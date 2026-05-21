import { useState, useRef, useEffect } from "react";
import { Send, Terminal, Image as ImageIcon, Code, Sparkles, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChat, useListSessions, useGetSession, useListModels, useCreateSession, getListSessionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function Chat() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  
  const queryClient = useQueryClient();
  const { data: sessions } = useListSessions();
  const { data: models } = useListModels();
  const { data: sessionDetail, isLoading: isLoadingSession } = useGetSession(activeSessionId || "", {
    query: { enabled: !!activeSessionId, queryKey: ["session", activeSessionId] }
  });
  
  const createSession = useCreateSession();
  const chatMutation = useChat();
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessionDetail?.messages]);

  const handleSend = () => {
    if (!input.trim() || !activeSessionId) return;
    
    const session = sessionDetail?.session;
    if (!session) return;

    const message = input;
    setInput("");
    
    chatMutation.mutate({
      data: {
        sessionId: activeSessionId,
        message,
        mode: session.mode,
        ragEnabled: session.ragEnabled,
        toolsEnabled: session.toolsEnabled,
        model: session.model
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["session", activeSessionId] });
      }
    });
  };

  const handleNewSession = () => {
    createSession.mutate({
      data: {
        title: "New Session",
        mode: "chat",
      }
    }, {
      onSuccess: (newSession) => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setActiveSessionId(newSession.id);
      }
    });
  };

  return (
    <div className="flex flex-col h-full relative z-10">
      <div className="flex border-b border-border bg-card/50 px-2 py-2 gap-2 overflow-x-auto">
        {sessions?.map((s) => (
          <div
            key={s.id}
            onClick={() => setActiveSessionId(s.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm whitespace-nowrap border ${activeSessionId === s.id ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
          >
            {s.mode === 'code' ? <Code className="w-3.5 h-3.5" /> : s.mode === 'vision' ? <ImageIcon className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
            {s.title}
          </div>
        ))}
        <Button variant="ghost" size="sm" className="shrink-0 h-8" onClick={handleNewSession}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col relative">
          <div className="absolute inset-0 overflow-y-auto p-4 flex flex-col gap-4" ref={scrollRef}>
            {isLoadingSession ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !sessionDetail?.messages?.length ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                <Sparkles className="w-12 h-12 opacity-20" />
                <p>Start typing to interact with {sessionDetail?.session?.model || 'the AI'}</p>
              </div>
            ) : (
              sessionDetail.messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'}`}>
                    <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{msg.content}</p>
                    {msg.role !== 'user' && msg.tokensUsed && (
                      <div className="text-[10px] text-muted-foreground mt-2 flex gap-2">
                        <span>{msg.latencyMs}ms</span>
                        <span>{msg.tokensUsed} tokens</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-muted border border-border flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Right Settings Panel */}
        {sessionDetail?.session && (
          <div className="w-64 border-l border-border bg-card/30 p-4 flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-3">Model</h3>
              <Select defaultValue={sessionDetail.session.model || ''}>
                <SelectTrigger className="w-full h-8 text-xs font-mono">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models?.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-mono">{m.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Capabilities</h3>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">RAG Base</span>
                <Switch checked={sessionDetail.session.ragEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">Tools</span>
                <Switch checked={sessionDetail.session.toolsEnabled} />
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-2">Stats</h3>
              <div className="text-xs text-muted-foreground font-mono space-y-1">
                <p>Messages: {sessionDetail.session.messageCount}</p>
                <p>Created: {new Date(sessionDetail.session.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Send a message... (Enter to send)" 
            className="flex-1 font-mono text-sm bg-card border-border h-12"
            disabled={!activeSessionId || chatMutation.isPending}
          />
          <Button 
            className="h-12 w-12 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90" 
            onClick={handleSend}
            disabled={!activeSessionId || !input.trim() || chatMutation.isPending}
          >
            {chatMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
