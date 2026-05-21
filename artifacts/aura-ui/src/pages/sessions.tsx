import { useListSessions, useDeleteSession, getListSessionsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Box, Trash2, Search, Plus, Terminal, Code, Image as ImageIcon, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";

const MODE_ICON: Record<string, React.ReactNode> = {
  code:   <Code className="w-3.5 h-3.5" />,
  vision: <ImageIcon className="w-3.5 h-3.5" />,
  chat:   <Terminal className="w-3.5 h-3.5" />,
};

export function Sessions() {
  const { data: sessions, isLoading } = useListSessions();
  const deleteSession = useDeleteSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSession.mutate({ sessionId: id } as any, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() }),
    });
  };

  const filtered = sessions?.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.model.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground text-sm font-mono mt-0.5">Manage your AI conversation contexts</p>
        </div>
        <Button onClick={() => setLocation("/chat")} className="gap-2 font-mono shrink-0" size="sm">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Session</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-card border border-border px-3 rounded-lg">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <Input
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 font-mono text-sm h-10"
          placeholder="Filter by title or model…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Session list — card-based (works on all screen sizes) */}
      <div className="flex flex-col gap-2">
        {isLoading && (
          <div className="text-sm text-muted-foreground font-mono py-8 text-center">Loading sessions…</div>
        )}
        {filtered?.length === 0 && !isLoading && (
          <div className="border border-dashed border-border rounded-lg py-12 text-center text-muted-foreground font-mono text-sm">
            No sessions found.
          </div>
        )}
        {filtered?.map((session) => (
          <div
            key={session.id}
            onClick={() => setLocation("/chat")}
            className="flex items-center gap-3 p-3 sm:p-4 border border-border bg-card rounded-lg hover:border-primary/40 hover:bg-muted/30 transition-colors cursor-pointer group"
          >
            {/* Icon */}
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
              {MODE_ICON[session.mode] ?? <Terminal className="w-3.5 h-3.5" />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm truncate">{session.title}</span>
                <Badge variant="outline" className="font-mono text-[10px] bg-background hidden sm:inline-flex shrink-0">
                  {session.model}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {session.messageCount}
                </span>
                <span>{format(new Date(session.updatedAt), "MMM d, HH:mm")}</span>
                <span className="sm:hidden truncate max-w-[80px]">{session.model}</span>
              </div>
            </div>

            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => handleDelete(e, session.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
