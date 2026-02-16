import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Search,
  Link,
  ExternalLink,
  Clock,
  Users,
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
        {
          body: {
            query: trimmedQuery,
            limit: 30,
          },
        }
      );

      if (error) throw error;

      setResults(data.results || []);

      if (data.results.length === 0) {
        toast.info(`No Fireflies calls found for "${trimmedQuery}"`, { id: toastId });
      } else {
        toast.success(
          `Found ${data.results.length} matching call${data.results.length !== 1 ? 's' : ''}`,
          { id: toastId }
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error(
        error instanceof Error
          ? `Search failed: ${error.message}`
          : "Failed to search Fireflies",
        { id: toastId }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (transcript: SearchResult) => {
    setLinking(transcript.id);

    try {
      const { error } = await supabase
        .from('deal_transcripts')
        .insert({
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
        } else {
          throw error;
        }
      } else {
        toast.success("Transcript linked to deal");
        setResults(results.filter(r => r.id !== transcript.id));
        onTranscriptLinked?.();
      }
    } catch (error) {
      console.error("Link error:", error);
      toast.error(
        error instanceof Error
          ? `Failed to link: ${error.message}`
          : "Failed to link transcript"
      );
    } finally {
      setLinking(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Manual Fireflies Search</CardTitle>
        <CardDescription>
          Search your Fireflies call history to manually link transcripts to this deal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <Input
            placeholder="Search by company name, keywords, or participants..."
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

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setResults([])}>
                Clear
              </Button>
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
                          {new Date(result.date).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                        {result.duration_minutes && (
                          <span>{result.duration_minutes} min</span>
                        )}
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(result.meeting_url, '_blank')}
                          title="Open in Fireflies"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleLink(result)}
                        disabled={linking === result.id}
                      >
                        {linking === result.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Link className="h-4 w-4 mr-1" />
                            Link
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {result.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {result.summary}
                    </p>
                  )}

                  {result.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.keywords.slice(0, 4).map((keyword, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && (
          <div className="text-center py-4">
            <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              Search Fireflies to find and link call transcripts to this deal
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
