import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useJourneyTimeline } from "@/hooks/useJourneyTimeline";
import { JourneySessionCard } from "./JourneySessionCard";
import { formatDistanceToNow, format } from "date-fns";
import { 
  Globe, 
  Monitor, 
  Smartphone, 
  MapPin, 
  Calendar,
  Clock,
  Layers,
  Target,
  User
} from "lucide-react";

interface JourneyDetailDialogProps {
  visitorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const stageColors: Record<string, string> = {
  anonymous: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  registered: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  engaged: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  qualified: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  converted: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
};

export function JourneyDetailDialog({ visitorId, open, onOpenChange }: JourneyDetailDialogProps) {
  const { data: timeline, isLoading, error } = useJourneyTimeline(visitorId);

  const getSourceLabel = (): string => {
    if (!timeline?.journey) return 'Unknown';
    if (timeline.journey.first_utm_source) return timeline.journey.first_utm_source;
    if (timeline.journey.first_referrer) {
      try {
        return new URL(timeline.journey.first_referrer).hostname;
      } catch {
        return 'Referral';
      }
    }
    return 'Direct';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Journey Timeline</span>
            {timeline?.journey && (
              <Badge 
                variant="outline" 
                className={`${stageColors[timeline.journey.journey_stage] || stageColors.anonymous}`}
              >
                {timeline.journey.journey_stage}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="p-4 text-destructive">
            Error loading journey: {error.message}
          </div>
        ) : !timeline ? (
          <div className="p-4 text-muted-foreground text-center">
            No journey data found
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            {/* Journey Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs">First Seen</span>
                </div>
                <p className="text-sm font-medium">
                  {format(new Date(timeline.journey.first_seen_at), 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(timeline.journey.first_seen_at), { addSuffix: true })}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Layers className="h-3.5 w-3.5" />
                  <span className="text-xs">Total Sessions</span>
                </div>
                <p className="text-sm font-medium">
                  {timeline.journey.total_sessions}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeline.journey.total_page_views} page views
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">Total Time</span>
                </div>
                <p className="text-sm font-medium">
                  {formatDuration(timeline.journey.total_time_seconds)}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="h-3.5 w-3.5" />
                  <span className="text-xs">Milestones</span>
                </div>
                <p className="text-sm font-medium">
                  {timeline.milestones.length}
                </p>
              </div>
            </div>

            {/* First Touch Attribution */}
            <div className="mb-6 p-4 rounded-lg border border-border/50 bg-card/50">
              <h4 className="text-sm font-medium mb-3">First Touch Attribution</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Source</span>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{getSourceLabel()}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Landing Page</span>
                  <span className="truncate block" title={timeline.journey.first_landing_page || '/'}>
                    {timeline.journey.first_landing_page || '/'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Device</span>
                  <div className="flex items-center gap-2">
                    {timeline.journey.first_device_type === 'mobile' ? (
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{timeline.journey.first_browser} / {timeline.journey.first_os}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Location</span>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {timeline.journey.first_city ? `${timeline.journey.first_city}, ` : ''}
                      {timeline.journey.first_country || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* User linked info */}
              {timeline.journey.user_id && (
                <div className="mt-4 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Linked to user:</span>
                    <span className="font-mono text-xs">{timeline.journey.user_id.slice(0, 8)}...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Milestones Summary */}
            {timeline.milestones.length > 0 && (
              <div className="mb-6 p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <h4 className="text-sm font-medium mb-3 text-emerald-700 dark:text-emerald-400">
                  Milestones Achieved
                </h4>
                <div className="space-y-2">
                  {timeline.milestones.map(milestone => (
                    <div key={milestone.key} className="flex items-center justify-between text-sm">
                      <span className="capitalize">
                        {milestone.key.replace(/_/g, ' ').replace(' at', '')}
                      </span>
                      <span className="text-muted-foreground">
                        {format(new Date(milestone.timestamp), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Session Timeline */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Session History</h4>
              {timeline.sessions.length > 0 ? (
                timeline.sessions.map((session, index) => (
                  <JourneySessionCard
                    key={session.session_id}
                    session={session}
                    sessionNumber={index + 1}
                    milestones={timeline.milestones}
                  />
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No detailed session data available
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
