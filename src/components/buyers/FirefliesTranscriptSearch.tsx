import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Search,
  Link,
  ExternalLink,
  Clock,
  Users,
  FileText,
} from "lucide-react";

interface FirefliesTranscriptSearchProps {
  buyerId: string;
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

/**
 * FirefliesTranscriptSearch Component
 *
 * Displays on buyer page to search and link Fireflies transcripts manually.
 *
 * Features:
 * - Search Fireflies by keyword/company name
 * - Display results with metadata
 * - Link transcripts to buyer
 * - Add notes when linking
 * - Prevent duplicate links
 * - Open transcript in Fireflies
 *
 * Usage:
 * <FirefliesTranscriptSearch
 *   buyerId={buyer.id}
 *   companyName={buyer.pe_firm_name}
 *   onTranscriptLinked={() => refetchTranscripts()}
 * />
 */
export const FirefliesTranscriptSearch = ({
  buyerId,
  companyName,
  onTranscriptLinked,
}: FirefliesTranscriptSearchProps) => {
  const [query, setQuery] = useState(companyName);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [linking, setLinking] = useState<string | null>(null);
  const [linkingNotes, setLinkingNotes] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);

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
            limit: 20
          }
        }
      );

      if (error) {
        console.error("Search error:", error);
        throw error;
      }

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
        .from('buyer_transcripts')
        .insert({
          buyer_id: buyerId,
          fireflies_transcript_id: transcript.id,
          transcript_url: transcript.meeting_url,
          title: transcript.title,
          call_date: transcript.date,
          participants: transcript.participants,
          duration_minutes: transcript.duration_minutes,
          summary: transcript.summary,
          key_points: transcript.keywords,
          notes: linkingNotes[transcript.id] || null,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.info("This transcript is already linked to this buyer");
        } else {
          console.error("Link error:", error);
          throw error;
        }
      } else {
        toast.success("Transcript linked to buyer");

        // Remove from results
        setResults(results.filter(r => r.id !== transcript.id));

        // Clear notes for this transcript
        const newNotes = { ...linkingNotes };
        delete newNotes[transcript.id];
        setLinkingNotes(newNotes);

        // Collapse notes if expanded
        if (expandedNotes === transcript.id) {
          setExpandedNotes(null);
        }

        // Notify parent
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

  const handleNotesChange = (transcriptId: string, notes: string) => {
    setLinkingNotes(prev => ({
      ...prev,
      [transcriptId]: notes,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search by company name, keywords, or participants..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResults([])}
            >
              Clear
            </Button>
          </div>

          {results.map((result) => (
            <Card key={result.id} className="p-4">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm break-words">
                      {result.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(result.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
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

                  <div className="flex items-center gap-2 shrink-0">
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
                  </div>
                </div>

                {/* Summary */}
                {result.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {result.summary}
                  </p>
                )}

                {/* Keywords */}
                {result.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {result.keywords.slice(0, 5).map((keyword, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {result.keywords.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{result.keywords.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Notes (collapsible) */}
                {expandedNotes === result.id && (
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-xs font-medium">
                      Notes (Optional)
                    </label>
                    <Textarea
                      placeholder="Why is this transcript relevant to this buyer?"
                      value={linkingNotes[result.id] || ''}
                      onChange={(e) => handleNotesChange(result.id, e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    onClick={() => handleLink(result)}
                    disabled={linking === result.id}
                    className="flex-1 sm:flex-initial"
                  >
                    {linking === result.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <Link className="h-4 w-4 mr-2" />
                        Link to Buyer
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedNotes(
                      expandedNotes === result.id ? null : result.id
                    )}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {expandedNotes === result.id ? 'Hide' : 'Add'} Notes
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && query.trim() && (
        <Card className="p-8 text-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            Search Fireflies to find relevant call transcripts for this buyer
          </p>
        </Card>
      )}
    </div>
  );
};
