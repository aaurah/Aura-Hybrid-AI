import { useState } from "react";
import { Database, Plus, Search, FileText, Trash2, Loader2 } from "lucide-react";
import { useListDocuments, useIngestDocument, useDeleteDocument, useRagQuery, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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

  const handleIngest = () => {
    if (!title || !content) return;
    ingestDoc.mutate({
      data: { title, content }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        setOpen(false);
        setTitle("");
        setContent("");
      }
    });
  };

  const handleSearch = () => {
    if (!searchQuery) return;
    queryRag.mutate({
      data: { query: searchQuery }
    }, {
      onSuccess: (data) => setSearchResults(data)
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Knowledge Base</h1>
          <p className="text-muted-foreground text-sm font-mono">Manage RAG documents and test vector search</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-mono">
              <Plus className="w-4 h-4" /> Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] border-border bg-card">
            <DialogHeader>
              <DialogTitle className="font-mono">Ingest New Document</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input 
                placeholder="Document Title" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="font-mono bg-background border-border"
              />
              <Textarea 
                placeholder="Paste content here to be embedded and chunked..." 
                value={content}
                onChange={e => setContent(e.target.value)}
                className="h-[300px] font-mono bg-background border-border resize-none"
              />
              <Button onClick={handleIngest} disabled={ingestDoc.isPending} className="w-full">
                {ingestDoc.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
                Embed & Store
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ingested Documents</h2>
          <div className="grid gap-3">
            {documents?.map(doc => (
              <div key={doc.id} className="flex items-start justify-between p-4 border border-border bg-card rounded-lg hover:border-primary/50 transition-colors">
                <div className="flex gap-3">
                  <div className="mt-1">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{doc.title}</h3>
                    <div className="flex gap-4 mt-1 text-[10px] font-mono text-muted-foreground">
                      <span>Chunks: {doc.chunkCount}</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => {
                    deleteDoc.mutate({ documentId: doc.id } as any, {
                      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() })
                    });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {documents?.length === 0 && (
              <div className="p-8 border border-dashed border-border rounded-lg text-center text-muted-foreground font-mono text-sm">
                No documents ingested yet.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1">
          <Card className="bg-card border-border sticky top-8">
            <CardHeader>
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Search className="w-4 h-4" /> Test Query
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Ask a question..." 
                  className="font-mono text-xs bg-background border-border"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <Button size="icon" onClick={handleSearch} disabled={queryRag.isPending} className="shrink-0">
                  {queryRag.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              
              {searchResults && (
                <div className="space-y-3 mt-4 border-t border-border pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground">Results ({searchResults.chunks?.length || 0})</h4>
                  <div className="space-y-3 max-h-[400px] overflow-auto pr-2">
                    {searchResults.chunks?.map((chunk: any, i: number) => (
                      <div key={i} className="bg-background border border-border rounded p-3 text-xs font-mono">
                        <div className="text-primary mb-1 flex justify-between">
                          <span>{chunk.documentTitle}</span>
                          <span>{(chunk.score * 100).toFixed(1)}%</span>
                        </div>
                        <p className="text-muted-foreground line-clamp-4">{chunk.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
