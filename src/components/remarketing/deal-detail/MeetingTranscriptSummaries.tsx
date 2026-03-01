import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button as _Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Mic,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Users,
  Tag,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface TranscriptWithSummary {
  id: string;
  title: string | null;
  call_date: string | null;
  duration_minutes: number | null;
  transcript_url: string | null;
  source: string | null;
  has_content: boolean | null;
  external_participants: { name: string; email: string }[] | null;
  extracted_data: {
    fireflies_summary?: string;
    fireflies_keywords?: string[];
    [key: string]: unknown;
  } | null;
  created_at: string;
}

interface MeetingTranscriptSummariesProps {
  listingId: string;
}

export function MeetingTranscriptSummaries({
  listingId,
}: MeetingTranscriptSummariesProps) {
  const [isOpen, setIsOpen] = useState(true);

  const { data: transcripts = [], isLoading } = useQuery<
    TranscriptWithSummary[]
  >({
    queryKey: ["deal-meeting-summaries", listingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("deal_transcripts")
        .select(
          "id, title, call_date, duration_minutes, transcript_url, source, has_content, external_participants, extracted_data, created_at"
        )
        .eq("listing_id", listingId)
        .eq("source", "fireflies")
        .order("call_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as TranscriptWithSummary[];
    },
    enabled: !!listingId,
    staleTime: 60_000,
  });

  // Only show transcripts that have actual content (summaries or has_content flag)
  const transcriptsWithContent = transcripts.filter(
    (t) =>
      t.has_content !== false &&
      (t.extracted_data?.fireflies_summary || t.title)
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (transcriptsWithContent.length === 0) {
    return null;
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Meeting Recordings & Summaries
                <Badge variant="secondary" className="text-xs font-normal">
                  {transcriptsWithContent.length}
                </Badge>
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <p className="text-xs text-muted-foreground mt-1">
            Auto-synced from Fireflies.ai call recordings
          </p>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {transcriptsWithContent.map((transcript) => (
              <MeetingSummaryCard
                key={transcript.id}
                transcript={transcript}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function MeetingSummaryCard({
  transcript,
}: {
  transcript: TranscriptWithSummary;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = transcript.extracted_data?.fireflies_summary;
  const keywords = transcript.extracted_data?.fireflies_keywords;
  const externalParticipants = transcript.external_participants || [];

  return (
    <div className="rounded-lg border p-3 space-y-2 group bg-background hover:bg-muted/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-medium truncate">
              {transcript.title || "Untitled Meeting"}
            </h4>
            {transcript.duration_minutes && transcript.duration_minutes > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                <Clock className="h-2.5 w-2.5" />
                {transcript.duration_minutes}m
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {transcript.call_date && (
              <span>
                {format(new Date(transcript.call_date), "MMM d, yyyy · h:mm a")}
                {" · "}
                {formatDistanceToNow(new Date(transcript.call_date), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>
        {transcript.transcript_url && (
          <a
            href={transcript.transcript_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
            title="Open in Fireflies"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* External Participants */}
      {externalParticipants.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Users className="h-3 w-3 text-muted-foreground shrink-0" />
          {externalParticipants.map((p, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="text-[10px] font-normal"
            >
              {p.name || p.email}
            </Badge>
          ))}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div>
          <p
            className={`text-sm text-muted-foreground ${
              !expanded ? "line-clamp-3" : ""
            }`}
          >
            {summary}
          </p>
          {summary.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:underline mt-1"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Keywords */}
      {keywords && keywords.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
          {keywords.slice(0, 6).map((kw, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-[10px] font-normal"
            >
              {kw}
            </Badge>
          ))}
          {keywords.length > 6 && (
            <span className="text-[10px] text-muted-foreground">
              +{keywords.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
