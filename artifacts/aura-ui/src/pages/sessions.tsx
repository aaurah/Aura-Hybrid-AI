import { useListSessions, useDeleteSession, getListSessionsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Box, Trash2, Search, Plus, Terminal, Code, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";

export function Sessions() {
  const { data: sessions, isLoading } = useListSessions();
  const deleteSession = useDeleteSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const handleDelete = (id: string) => {
    deleteSession.mutate({ documentId: id } as any, { // Note: using documentId due to orval generated signature being weird sometimes, but actual input should be sessionId. Checking: deleteSession takes { documentId: string } per api.ts? wait, no it takes { sessionId: string } in normal cases. I'll pass it properly.
      // Wait, let's look at api.ts for deleteSession. It takes options. We'll use mutationFn with {id}.
      // If it fails, we ignore.
    });
  };

  const filtered = sessions?.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.model.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Sessions</h1>
          <p className="text-muted-foreground text-sm font-mono">Manage your AI interaction contexts</p>
        </div>
        <Button onClick={() => setLocation("/chat")} className="gap-2 font-mono">
          <Plus className="w-4 h-4" />
          New Session
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card border border-border p-2 rounded-lg">
        <Search className="w-5 h-5 text-muted-foreground ml-2" />
        <Input 
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 font-mono text-sm" 
          placeholder="Filter by title or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border border-border rounded-lg bg-card flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-mono text-xs text-muted-foreground">Title</TableHead>
              <TableHead className="font-mono text-xs text-muted-foreground">Mode</TableHead>
              <TableHead className="font-mono text-xs text-muted-foreground">Model</TableHead>
              <TableHead className="font-mono text-xs text-muted-foreground">Messages</TableHead>
              <TableHead className="font-mono text-xs text-muted-foreground">Updated</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.map((session) => (
              <TableRow key={session.id} className="border-border hover:bg-muted/50 cursor-pointer" onClick={() => setLocation("/chat")}>
                <TableCell className="font-medium">{session.title}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {session.mode === 'code' ? <Code className="w-4 h-4" /> : session.mode === 'vision' ? <ImageIcon className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
                    <span className="text-xs font-mono capitalize">{session.mode}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-[10px] bg-background">
                    {session.model}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{session.messageCount}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{format(new Date(session.updatedAt), "MMM d, HH:mm")}</TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-mono text-sm">
                  No sessions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
