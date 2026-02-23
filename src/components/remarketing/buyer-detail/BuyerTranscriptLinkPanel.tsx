import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Link as LinkIcon,
  Upload,
  Search,
  ExternalLink,
  Clock,
  Link2,
  AlertTriangle,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BuyerTranscriptLinkPanelProps {
  buyerId: string;
  companyName?: string;
  onTranscriptLinked?: () => void;
  onAddTranscript: (text: string, source: string, fileName?: string, fileUrl?: string, triggerExtract?: boolean) => Promise<any> | void;
}

interface SearchResult {
  id: string;
  title: string;
  date: string;
  duration_minutes: number | null;
  participants: any[];
  summary: string;
  meeting_url: string;
  keywords: string[];
  external_participants?: any[];
  has_content?: boolean;
  match_type?: string;
}

export function BuyerTranscriptLinkPanel({
  buyerId,
  companyName,
  onTranscriptLinked,
  onAddTranscript,
}: BuyerTranscriptLinkPanelProps) {
  // Paste link state
  const [firefliesUrl, setFirefliesUrl] = useState("");
  const [linkingUrl, setLinkingUrl] = useState(false);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Search state
  const [query, setQuery] = useState(companyName || "");
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  const handleLinkByUrl = async () => {
    const url = firefliesUrl.trim();
    if (!url) return;

    setLinkingUrl(true);
    try {
      const match = url.match(/fireflies\.ai\/view\/([^/?#]+)/);
      const transcriptId = match ? match[1] : `url-${Date.now()}`;

      const { error } = await supabase.from('buyer_transcripts').insert({
        buyer_id: buyerId,
        fireflies_transcript_id: transcriptId,
        transcript_url: url,
        title: match ? `Fireflies: ${transcriptId}` : 'Fireflies Transcript',
        transcript_text: 'Linked via URL - pending fetch',
        source: 'fireflies',
      });

      if (error) {
        if (error.code === '23505') toast.info("Already linked");
        else throw error;
      } else {
        toast.success("Transcript linked");
        setFirefliesUrl("");
        onTranscriptLinked?.();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to link");
    } finally {
      setLinkingUrl(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(files)) {
      try {
        const textTypes = ['.txt', '.vtt', '.srt', '.md'];
        const isTextFile = textTypes.some(ext => file.name.toLowerCase().endsWith(ext));
        const docTypes = ['.pdf', '.doc', '.docx'];
        const isDocFile = docTypes.some(ext => file.name.toLowerCase().endsWith(ext));

        let transcriptText = '';
        let fileUrl: string | undefined;

        // Upload to storage
        const timestamp = Date.now();
        const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${buyerId}/${timestamp}_${filename}`;
        const { error: uploadError } = await supabase.storage.from('buyer-transcripts').upload(path, file);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('buyer-transcripts').getPublicUrl(path);
          fileUrl = publicUrl;
        }

        if (isTextFile) {
          transcriptText = await file.text();
        } else if (isDocFile) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            const { data, error } = await supabase.functions.invoke('parse-transcript-file', { body: formData });
            if (!error && data?.text) transcriptText = data.text;
          } catch { /* fallback */ }
        }

        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        await onAddTranscript(transcriptText || `Uploaded: ${file.name}`, "call", nameWithoutExt, fileUrl, false);
        successCount++;

        if (successCount > 0 && Array.from(files).indexOf(file) < files.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} transcript${successCount > 1 ? 's' : ''} uploaded`);
      onTranscriptLinked?.();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setSearchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-fireflies-for-buyer', {
        body: { query: trimmedQuery, limit: 30 },
      });
      if (error) throw error;
      setResults(data.results || []);
      if (data.results.length === 0) toast.info(`No calls found for "${trimmedQuery}"`);
    } catch (error) {
      toast.error("Failed to search Fireflies");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleLinkResult = async (transcript: SearchResult) => {
    setLinking(transcript.id);
    try {
      const { error } = await supabase.from('buyer_transcripts').insert({
        buyer_id: buyerId,
        fireflies_transcript_id: transcript.id,
        transcript_url: transcript.meeting_url,
        title: transcript.title,
        call_date: transcript.date,
        participants: transcript.participants,
        duration_minutes: transcript.duration_minutes,
        transcript_text: transcript.summary || 'Fireflies transcript',
        source: 'fireflies',
      });

      if (error) {
        if (error.code === '23505') toast.info("Already linked");
        else throw error;
      } else {
        toast.success("Transcript linked");
        setResults(results.filter(r => r.id !== transcript.id));
        onTranscriptLinked?.();
      }
    } catch (error) {
      toast.error("Failed to link transcript");
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
      {/* Manual link tabs - same 3-tab format as deals */}
      <Tabs defaultValue="link" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="link" className="text-xs"><Link2 className="h-3.5 w-3.5 mr-1" />Paste Link</TabsTrigger>
          <TabsTrigger value="upload" className="text-xs"><Upload className="h-3.5 w-3.5 mr-1" />Upload</TabsTrigger>
          <TabsTrigger value="search" className="text-xs"><Search className="h-3.5 w-3.5 mr-1" />Search</TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="https://app.fireflies.ai/view/..." value={firefliesUrl} onChange={e => setFirefliesUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && !linkingUrl && handleLinkByUrl()} className="flex-1 h-8 text-sm" />
            <Button onClick={handleLinkByUrl} disabled={linkingUrl || !firefliesUrl.trim()} size="sm" className="h-8">
              {linkingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LinkIcon className="h-4 w-4 mr-1" />Link</>}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Paste a Fireflies transcript URL to link it</p>
        </TabsContent>

        <TabsContent value="upload" className="space-y-2">
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.vtt,.srt,.md" multiple onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" className="w-full h-16 border-dashed" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Uploading...</span></div>
            ) : (
              <div className="flex flex-col items-center gap-1"><Upload className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">PDF, DOC, TXT, VTT, SRT</span></div>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="search" className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search by company name, keywords..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && !searchLoading && handleSearch()} className="flex-1 h-8 text-sm" />
            <Button onClick={handleSearch} disabled={searchLoading || !query.trim()} size="sm" className="h-8">
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {results.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-auto">
              {results.map(r => (
                <div key={r.id} className={`border rounded p-2 flex items-center justify-between gap-2 ${r.has_content === false ? 'opacity-60 bg-muted/30' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(r.date).toLocaleDateString()}</span>
                      {r.duration_minutes && <span>{r.duration_minutes}m</span>}
                    </div>
                    {r.external_participants && r.external_participants.length > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Users className="h-3 w-3" />
                        With: {r.external_participants.map((p: any) => p.name).join(', ')}
                      </p>
                    )}
                    {r.has_content === false && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        No transcript captured
                      </p>
                    )}
                    {r.match_type === 'keyword' && (
                      <Badge variant="outline" className="text-[10px] h-4 mt-0.5 text-blue-600 border-blue-300">
                        Company match
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.meeting_url && <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => window.open(r.meeting_url, '_blank')}><ExternalLink className="h-3.5 w-3.5" /></Button>}
                    <Button size="sm" className="h-7" onClick={() => handleLinkResult(r)} disabled={linking === r.id}>
                      {linking === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><LinkIcon className="h-3.5 w-3.5 mr-1" />Link</>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
