import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Search,
  Link,
  ExternalLink,
  Clock,
  Users,
  Upload,
  Link2,
} from "lucide-react";

interface FirefliesManualLinkProps {
  listingId: string;
  companyName: string;
  onTranscriptLinked?: () => void;
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
}

export const FirefliesManualLink = ({
  listingId,
  companyName,
  onTranscriptLinked,
}: FirefliesManualLinkProps) => {
  const [query, setQuery] = useState(companyName);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  // Link by URL state
  const [firefliesUrl, setFirefliesUrl] = useState("");
  const [linkingUrl, setLinkingUrl] = useState(false);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      toast.error("Please enter a search query");
      return;
    }

    setLoading(true);
    const toastId = toast.loading(`Searching Fireflies for "${trimmedQuery}"...`);

    try {
      const { data, error } = await supabase.functions.invoke(
        'search-fireflies-for-buyer',
        { body: { query: trimmedQuery, limit: 30 } }
      );
      if (error) throw error;

      setResults(data.results || []);
      if (data.results.length === 0) {
        toast.info(`No Fireflies calls found for "${trimmedQuery}"`, { id: toastId });
      } else {
        toast.success(`Found ${data.results.length} matching call${data.results.length !== 1 ? 's' : ''}`, { id: toastId });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error(error instanceof Error ? `Search failed: ${error.message}` : "Failed to search Fireflies", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkResult = async (transcript: SearchResult) => {
    setLinking(transcript.id);
    try {
      const { error } = await supabase.from('deal_transcripts').insert({
        listing_id: listingId,
        fireflies_transcript_id: transcript.id,
        fireflies_meeting_id: transcript.id,
        transcript_url: transcript.meeting_url,
        title: transcript.title,
        call_date: transcript.date,
        participants: transcript.participants,
        duration_minutes: transcript.duration_minutes,
        transcript_text: transcript.summary || 'Fireflies transcript',
        source: 'fireflies',
        auto_linked: false,
      });

      if (error) {
        if (error.code === '23505') {
          toast.info("This transcript is already linked to this deal");
        } else throw error;
      } else {
        toast.success("Transcript linked to deal");
        setResults(results.filter(r => r.id !== transcript.id));
        onTranscriptLinked?.();
      }
    } catch (error) {
      console.error("Link error:", error);
      toast.error(error instanceof Error ? `Failed to link: ${error.message}` : "Failed to link transcript");
    } finally {
      setLinking(null);
    }
  };

  const handleLinkByUrl = async () => {
    const url = firefliesUrl.trim();
    if (!url) {
      toast.error("Please enter a Fireflies URL");
      return;
    }

    setLinkingUrl(true);
    const toastId = toast.loading("Linking Fireflies transcript...");

    try {
      // Extract transcript ID from URL if possible
      const match = url.match(/fireflies\.ai\/view\/([^/?#]+)/);
      const transcriptId = match ? match[1] : `url-${Date.now()}`;

      const { error } = await supabase.from('deal_transcripts').insert({
        listing_id: listingId,
        fireflies_transcript_id: transcriptId,
        transcript_url: url,
        title: match ? `Fireflies: ${transcriptId}` : 'Fireflies Transcript',
        transcript_text: 'Linked via URL - pending fetch',
        source: 'fireflies',
        auto_linked: false,
      });

      if (error) {
        if (error.code === '23505') {
          toast.info("This transcript is already linked", { id: toastId });
        } else throw error;
      } else {
        toast.success("Fireflies transcript linked", { id: toastId });
        setFirefliesUrl("");
        onTranscriptLinked?.();
      }
    } catch (error) {
      console.error("Link error:", error);
      toast.error(error instanceof Error ? `Failed: ${error.message}` : "Failed to link transcript", { id: toastId });
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
      const toastId = toast.loading(`Uploading ${file.name}...`);

      try {
        // Read file as text for supported formats
        const textTypes = ['.txt', '.vtt', '.srt', '.md'];
        const isTextFile = textTypes.some(ext => file.name.toLowerCase().endsWith(ext));

        let transcriptText = '';

        if (isTextFile) {
          transcriptText = await file.text();
        } else {
          // For PDF/DOC, use parse function or store as-is
          transcriptText = `Uploaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        }

        // If it's a parseable document, invoke the parser
        const docTypes = ['.pdf', '.doc', '.docx'];
        const isDocFile = docTypes.some(ext => file.name.toLowerCase().endsWith(ext));

        if (isDocFile) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('listingId', listingId);

            const { data, error } = await supabase.functions.invoke('parse-transcript-file', {
              body: formData,
            });

            if (!error && data?.text) {
              transcriptText = data.text;
            }
          } catch {
            // Fallback: use placeholder text
          }
        }

        const { error } = await supabase.from('deal_transcripts').insert({
          listing_id: listingId,
          fireflies_transcript_id: `upload-${Date.now()}-${file.name}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          transcript_text: transcriptText || `Uploaded: ${file.name}`,
          source: 'upload',
          auto_linked: false,
        });

        if (error) {
          if (error.code === '23505') {
            toast.info(`${file.name} already linked`, { id: toastId });
          } else throw error;
        } else {
          toast.success(`${file.name} uploaded`, { id: toastId });
          successCount++;
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(`Failed to upload ${file.name}`, { id: toastId });
      }
    }

    if (successCount > 0) onTranscriptLinked?.();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Link Transcripts</CardTitle>
        <CardDescription>
          Search Fireflies, paste a link, or upload a transcript file
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="link" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link" className="text-xs">
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Paste Link
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-xs">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="search" className="text-xs">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Search
            </TabsTrigger>
          </TabsList>

          {/* Paste Link Tab */}
          <TabsContent value="link" className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="https://app.fireflies.ai/view/..."
                value={firefliesUrl}
                onChange={(e) => setFirefliesUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !linkingUrl && handleLinkByUrl()}
                className="flex-1"
              />
              <Button
                onClick={handleLinkByUrl}
                disabled={linkingUrl || !firefliesUrl.trim()}
                size="sm"
              >
                {linkingUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-1.5" />
                    Link
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a Fireflies transcript URL to link it to this deal
            </p>
          </TabsContent>

          {/* Upload File Tab */}
          <TabsContent value="upload" className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.vtt,.srt,.md"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload transcript files
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PDF, DOC, DOCX, TXT, VTT, SRT
                  </span>
                </div>
              )}
            </Button>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by company name, keywords..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                size="sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {results.length} result{results.length !== 1 ? 's' : ''}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setResults([])}>Clear</Button>
                </div>

                {results.map((result) => (
                  <Card key={result.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{result.title}</h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(result.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {result.duration_minutes && <span>{result.duration_minutes} min</span>}
                            {result.participants.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {result.participants.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {result.meeting_url && (
                            <Button size="sm" variant="ghost" onClick={() => window.open(result.meeting_url, '_blank')} title="Open in Fireflies">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" onClick={() => handleLinkResult(result)} disabled={linking === result.id}>
                            {linking === result.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link className="h-4 w-4 mr-1" />Link</>}
                          </Button>
                        </div>
                      </div>
                      {result.summary && <p className="text-xs text-muted-foreground line-clamp-2">{result.summary}</p>}
                      {result.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {result.keywords.slice(0, 4).map((keyword, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{keyword}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {!loading && results.length === 0 && (
              <div className="text-center py-4">
                <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Search Fireflies to find and link call transcripts</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
