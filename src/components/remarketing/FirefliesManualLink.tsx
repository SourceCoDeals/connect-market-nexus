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
  AlertTriangle,
  FileText,
  Info,
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
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL validation
  const isValidFirefliesUrl = firefliesUrl.trim() && /fireflies\.ai\/view\/[^/?#]+/.test(firefliesUrl.trim());
  const hasUrlInput = firefliesUrl.trim().length > 0;
  const showUrlWarning = hasUrlInput && !isValidFirefliesUrl && firefliesUrl.trim().length > 10;

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
      toast.error(error instanceof Error ? `Failed to link: ${error.message}` : "Failed to link transcript");
    } finally {
      setLinking(null);
    }
  };

  const handleLinkByUrl = async () => {
    const url = firefliesUrl.trim();
    if (!url) return;

    // Validate URL
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('fireflies.ai')) {
        toast.error('Please enter a valid Fireflies URL (app.fireflies.ai/view/...)');
        return;
      }
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    const match = url.match(/fireflies\.ai\/view\/([^/?#]+)/);
    if (!match || !match[1]) {
      toast.error('URL should contain a transcript ID (app.fireflies.ai/view/your-transcript-id)');
      return;
    }

    setLinkingUrl(true);
    const toastId = toast.loading("Linking Fireflies transcript...");

    try {
      const transcriptId = match[1];

      const { error } = await supabase.from('deal_transcripts').insert({
        listing_id: listingId,
        fireflies_transcript_id: transcriptId,
        transcript_url: url,
        title: `Fireflies: ${transcriptId}`,
        transcript_text: 'Linked via URL - content will be fetched automatically',
        source: 'fireflies',
        auto_linked: false,
      });

      if (error) {
        if (error.code === '23505') {
          toast.info("This transcript is already linked", { id: toastId });
        } else throw error;
      } else {
        toast.success("Transcript linked — content will be fetched when you open it", { id: toastId });
        setFirefliesUrl("");
        onTranscriptLinked?.();
      }
    } catch (error) {
      toast.error(error instanceof Error ? `Failed: ${error.message}` : "Failed to link transcript", { id: toastId });
    } finally {
      setLinkingUrl(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadedFileNames(Array.from(files).map(f => f.name));
    let successCount = 0;

    for (const file of Array.from(files)) {
      const toastId = toast.loading(`Uploading ${file.name}...`);

      try {
        const textTypes = ['.txt', '.vtt', '.srt', '.md'];
        const isTextFile = textTypes.some(ext => file.name.toLowerCase().endsWith(ext));

        let transcriptText = '';

        if (isTextFile) {
          transcriptText = await file.text();
        } else {
          transcriptText = `Uploaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        }

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
        toast.error(`Failed to upload ${file.name}`, { id: toastId });
      }
    }

    if (successCount > 0) onTranscriptLinked?.();
    setUploading(false);
    setUploadedFileNames([]);
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
        <Tabs defaultValue="search" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search" className="text-xs">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Search Fireflies
            </TabsTrigger>
            <TabsTrigger value="link" className="text-xs">
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Paste Link
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-xs">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload File
            </TabsTrigger>
          </TabsList>

          {/* Search Tab — Now default */}
          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by company name, person, or keywords..."
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
                    {results.length} result{results.length !== 1 ? 's' : ''} — click title to view in Fireflies
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setResults([])}>Clear</Button>
                </div>

                {results.map((result) => (
                  <Card key={result.id} className="p-3 hover:bg-muted/30 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {result.meeting_url ? (
                            <a
                              href={result.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-sm text-primary hover:underline flex items-center gap-1.5 truncate"
                            >
                              {result.title}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <h4 className="font-medium text-sm truncate">{result.title}</h4>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(result.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {result.duration_minutes && <span>{result.duration_minutes} min</span>}
                            {result.participants.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {result.participants.length} participant{result.participants.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleLinkResult(result)} disabled={linking === result.id}>
                          {linking === result.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link className="h-4 w-4 mr-1" />Link</>}
                        </Button>
                      </div>
                      {result.summary && <p className="text-xs text-muted-foreground line-clamp-2 italic">{result.summary}</p>}
                      {result.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {result.keywords.slice(0, 4).map((keyword) => (
                            <Badge key={keyword} variant="outline" className="text-xs">{keyword}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {!loading && results.length === 0 && (
              <div className="text-center py-4 bg-muted/30 rounded-lg">
                <Search className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Search Fireflies to find and link call transcripts</p>
              </div>
            )}
          </TabsContent>

          {/* Paste Link Tab */}
          <TabsContent value="link" className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="https://app.fireflies.ai/view/your-transcript"
                value={firefliesUrl}
                onChange={(e) => setFirefliesUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !linkingUrl && handleLinkByUrl()}
                className={`flex-1 ${showUrlWarning ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`}
              />
              <Button
                onClick={handleLinkByUrl}
                disabled={linkingUrl || !isValidFirefliesUrl}
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
            {showUrlWarning ? (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                URL should be from app.fireflies.ai/view/...
              </p>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Paste a Fireflies transcript URL — the transcript content will be fetched automatically when you open it
              </p>
            )}
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
                  <div className="text-left">
                    <span>Uploading...</span>
                    {uploadedFileNames.length > 0 && (
                      <p className="text-xs text-muted-foreground">{uploadedFileNames[0]}{uploadedFileNames.length > 1 ? ` +${uploadedFileNames.length - 1} more` : ''}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Click to upload transcript files
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PDF, DOC, DOCX, TXT, VTT, SRT
                  </span>
                </div>
              )}
            </Button>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Text will be extracted from uploaded files. AI can then extract deal intelligence.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
