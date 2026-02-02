import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserJourney } from "@/hooks/useUserJourneys";
import { formatDistanceToNow } from "date-fns";
import { JourneyDetailDialog } from "./JourneyDetailDialog";

interface JourneyLiveFeedProps {
  journeys: UserJourney[];
  isLoading: boolean;
}

const stageColors: Record<string, string> = {
  anonymous: 'bg-muted text-muted-foreground border-muted',
  registered: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  engaged: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  qualified: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  converted: 'bg-coral-500/10 text-coral-500 border-coral-500/20',
};

export function JourneyLiveFeed({ journeys, isLoading }: JourneyLiveFeedProps) {
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);

  const getSourceLabel = (journey: UserJourney): string => {
    if (journey.first_utm_source) return journey.first_utm_source;
    if (journey.first_referrer) {
      try {
        return new URL(journey.first_referrer).hostname;
      } catch {
        return 'Referral';
      }
    }
    return 'Direct';
  };

  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-coral-500"></span>
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Recent Journeys
          </p>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Click any journey to view complete timeline
        </p>
      </div>

      <ScrollArea className="h-[320px]">
        {isLoading ? (
          <div className="space-y-0 divide-y divide-border/30">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-14 w-full" />
              </div>
            ))}
          </div>
        ) : journeys.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            No journeys recorded yet
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {journeys.map((journey) => (
              <div 
                key={journey.id} 
                className="px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setSelectedVisitorId(journey.visitor_id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Visitor ID and Stage */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-medium font-mono">
                        {journey.visitor_id.slice(0, 8)}...
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-[9px] px-1.5 py-0 uppercase tracking-wider font-semibold ${stageColors[journey.journey_stage] || stageColors.anonymous}`}
                      >
                        {journey.journey_stage}
                      </Badge>
                    </div>

                    {/* Entry info */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="capitalize">{getSourceLabel(journey)}</span>
                      {journey.first_device_type && (
                        <>
                          <span className="text-muted-foreground/30">•</span>
                          <span className="capitalize">{journey.first_device_type}</span>
                        </>
                      )}
                      {journey.first_country && (
                        <>
                          <span className="text-muted-foreground/30">•</span>
                          <span>
                            {journey.first_city ? `${journey.first_city}, ` : ''}{journey.first_country}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Landing page */}
                    {journey.first_landing_page && (
                      <div className="mt-1.5">
                        <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          {journey.first_landing_page}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Stats and time */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {journey.total_sessions} session{journey.total_sessions !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(journey.last_seen_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Journey Detail Dialog */}
      <JourneyDetailDialog
        visitorId={selectedVisitorId}
        open={!!selectedVisitorId}
        onOpenChange={(open) => !open && setSelectedVisitorId(null)}
      />
    </div>
  );
}
