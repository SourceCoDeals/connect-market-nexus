import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserJourney } from "@/hooks/useUserJourneys";
import { formatDistanceToNow } from "date-fns";
import { Globe, Monitor, Smartphone, MapPin, ExternalLink } from "lucide-react";
import { JourneyDetailDialog } from "./JourneyDetailDialog";

interface JourneyLiveFeedProps {
  journeys: UserJourney[];
  isLoading: boolean;
}

const stageColors: Record<string, string> = {
  anonymous: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  registered: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  engaged: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  qualified: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  converted: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

export function JourneyLiveFeed({ journeys, isLoading }: JourneyLiveFeedProps) {
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);

  const getDeviceIcon = (deviceType: string | null) => {
    if (deviceType === 'mobile') return <Smartphone className="h-3 w-3" />;
    return <Monitor className="h-3 w-3" />;
  };

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
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Recent Journeys
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Latest visitor journeys across sessions
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
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
                  className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedVisitorId(journey.visitor_id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Visitor ID and Stage */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-medium truncate">
                          {journey.visitor_id.slice(0, 8)}...
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] px-1.5 py-0 ${stageColors[journey.journey_stage] || stageColors.anonymous}`}
                        >
                          {journey.journey_stage}
                        </Badge>
                      </div>

                      {/* Entry info */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {getSourceLabel(journey)}
                        </span>
                        {journey.first_device_type && (
                          <span className="flex items-center gap-1">
                            {getDeviceIcon(journey.first_device_type)}
                            {journey.first_device_type}
                          </span>
                        )}
                        {journey.first_country && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {journey.first_city ? `${journey.first_city}, ` : ''}{journey.first_country}
                          </span>
                        )}
                      </div>

                      {/* Landing page */}
                      {journey.first_landing_page && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate">{journey.first_landing_page}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats and time */}
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">
                        {journey.total_sessions} session{journey.total_sessions !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(journey.last_seen_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Journey Detail Dialog */}
      <JourneyDetailDialog
        visitorId={selectedVisitorId}
        open={!!selectedVisitorId}
        onOpenChange={(open) => !open && setSelectedVisitorId(null)}
      />
    </Card>
  );
}
