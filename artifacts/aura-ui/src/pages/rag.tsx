import { useState } from "react";
import { Database, Plus, Search, FileText, Trash2, Loader2, ChevronDown } from "lucide-react";
import { useListDocuments, useIngestDocument, useDeleteDocument, useRagQuery, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Rag() {
  const { data: documents, isLoading } = useListDocuments();
  const ingestDoc = useIngestDocument();
  const deleteDoc = useDeleteDocument();
  const queryRag = useRagQuery();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleIngest = () => {
    if (!title || !content) return;
    ingestDoc.mutate({ data: { title, content } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        setOpen(false);
        setTitle("");
        setContent("");
      },
    });
  };

  const handleSearch = () => {
    if (!searchQuery) return;
    queryRag.mutate({ data: { query: searchQuery } }, {
      onSuccess: (data) => { setSearchResults(data); setSearchOpen(true); },
    });
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm font-mono mt-0.5">RAG document store with vector search</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-mono shrink-0" size="sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Document</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[600px] border-border bg-card">
            <DialogHeader>
              <DialogTitle className="font-mono">Ingest New Document</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input
                placeholder="Document Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-mono bg-background border-border"
              />
              <Textarea
                placeholder="Paste content to embed and chunk…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-48 sm:h-64 font-mono bg-background border-border resize-none"
              />
              <Button onClick={handleIngest} disabled={ingestDoc.isPending} className="w-full">
                {ingestDoc.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
                Embed & Store
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex items-center gap-2 flex-1 bg-card border border-border px-3 rounded-lg">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 font-mono text-sm h-10"
            placeholder="Search the knowledge base…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={queryRag.isPending} className="shrink-0 h-10 px-4">
          {queryRag.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {/* Search results (collapsible) */}
      {searchResults && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-card text-sm font-mono hover:bg-muted/50 transition-colors"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <span className="text-primary">Search Results ({searchResults.chunks?.length ?? 0})</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${searchOpen ? "rotate-180" : ""}`} />
          </button>
          {searchOpen && (
            <div className="p-3 flex flex-col gap-2 bg-background">
              {searchResults.chunks?.map((chunk: any, i: number) => (
                <div key={i} className="bg-card border border-border rounded p-3 text-xs font-mono">
                  <div className="text-primary mb-1 flex justify-between">
                    <span className="truncate">{chunk.documentTitle}</span>
                    <span className="shrink-0 ml-2">{(chunk.score * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-muted-foreground line-clamp-3">{chunk.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document list */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Ingested Documents ({documents?.length ?? 0})
        </h2>
        <div className="flex flex-col gap-2">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {documents?.length === 0 && !isLoading && (
            <div className="p-8 border border-dashed border-border rounded-lg text-center text-muted-foreground font-mono text-sm">
              No documents ingested yet.
            </div>
          )}
          {documents?.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start justify-between p-3 sm:p-4 border border-border bg-card rounded-lg hover:border-primary/40 transition-colors group"
            >
              <div className="flex gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm truncate">{doc.title}</h3>
                  <div className="flex gap-3 mt-0.5 text-[10px] font-mono text-muted-foreground">
                    <span>{doc.chunkCount} chunk{doc.chunkCount !== 1 ? "s" : ""}</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  deleteDoc.mutate({ documentId: doc.id } as any, {
                    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }),
                  });
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
