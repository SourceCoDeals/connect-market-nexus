import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TimelineSession } from "@/hooks/useJourneyTimeline";
import { formatDistanceToNow, format } from "date-fns";
import { 
  ChevronDown, 
  ChevronRight, 
  Monitor, 
  Smartphone, 
  Globe, 
  Clock,
  FileText,
  MousePointerClick,
  ArrowRight
} from "lucide-react";

interface JourneySessionCardProps {
  session: TimelineSession;
  sessionNumber: number;
  milestones: { key: string; timestamp: string }[];
}

const getMilestoneLabel = (key: string): string => {
  const labels: Record<string, string> = {
    signup_at: '🎉 Signed Up',
    nda_signed_at: '📝 NDA Signed',
    fee_agreement_at: '✅ Fee Agreement',
    first_connection_at: '🤝 First Connection',
    first_listing_view: '👀 First Listing View',
    first_save: '💾 First Save',
  };
  return labels[key] || key;
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
};

export function JourneySessionCard({ session, sessionNumber, milestones }: JourneySessionCardProps) {
  const [isOpen, setIsOpen] = useState(sessionNumber === 1);

  const sessionStart = new Date(session.started_at);
  const sessionEnd = session.ended_at ? new Date(session.ended_at) : null;

  // Find milestones that occurred during this session
  const sessionMilestones = milestones.filter(m => {
    const milestoneTime = new Date(m.timestamp).getTime();
    const startTime = sessionStart.getTime();
    const endTime = sessionEnd?.getTime() || Date.now();
    return milestoneTime >= startTime && milestoneTime <= endTime;
  });

  // Combine page views and events into a timeline
  const timelineItems = [
    ...session.page_views.map(pv => ({
      type: 'pageview' as const,
      timestamp: pv.viewed_at,
      data: pv,
    })),
    ...session.events.map(e => ({
      type: 'event' as const,
      timestamp: e.created_at,
      data: e,
    })),
    ...sessionMilestones.map(m => ({
      type: 'milestone' as const,
      timestamp: m.timestamp,
      data: m,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          {/* Session number */}
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium shrink-0">
            {sessionNumber}
          </div>

          {/* Session info */}
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {format(sessionStart, 'MMM d, yyyy')}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(sessionStart, 'h:mm a')}
              </span>
              {sessionMilestones.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {sessionMilestones.length} milestone{sessionMilestones.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {session.device_type && (
                <span className="flex items-center gap-1">
                  {session.device_type === 'mobile' ? (
                    <Smartphone className="h-3 w-3" />
                  ) : (
                    <Monitor className="h-3 w-3" />
                  )}
                  {session.device_type}
                </span>
              )}
              {session.country && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {session.city ? `${session.city}, ` : ''}{session.country}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(session.duration_seconds)}
              </span>
            </div>
          </div>

          {/* Page count and expand icon */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs">
              {session.page_views.length} page{session.page_views.length !== 1 ? 's' : ''}
            </span>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-4 border-l-2 border-border/50 pl-4 py-2 space-y-2">
          {/* Referrer */}
          {session.referrer && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <ArrowRight className="h-3 w-3" />
              <span>Arrived from: {(() => {
                try {
                  return new URL(session.referrer).hostname;
                } catch {
                  return session.referrer;
                }
              })()}</span>
            </div>
          )}

          {/* Timeline items */}
          {timelineItems.map((item, index) => (
            <div key={`${item.type}-${index}`} className="relative">
              {item.type === 'pageview' && (
                <div className="flex items-start gap-3 py-1.5 group">
                  <div className="mt-0.5 p-1 rounded bg-muted">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate" title={item.data.page_path}>
                        {item.data.page_title || item.data.page_path}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{format(new Date(item.timestamp), 'h:mm:ss a')}</span>
                      {item.data.time_on_page && (
                        <span>{item.data.time_on_page}s on page</span>
                      )}
                      {item.data.scroll_depth && (
                        <span>{item.data.scroll_depth}% scrolled</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {item.type === 'event' && (
                <div className="flex items-start gap-3 py-1.5">
                  <div className="mt-0.5 p-1 rounded bg-blue-500/10">
                    <MousePointerClick className="h-3 w-3 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        {item.data.event_action}
                      </span>
                      {item.data.event_label && (
                        <span className="text-xs text-muted-foreground">
                          ({item.data.event_label})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.timestamp), 'h:mm:ss a')}
                    </span>
                  </div>
                </div>
              )}

              {item.type === 'milestone' && (
                <div className="flex items-start gap-3 py-2 px-2 -mx-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="mt-0.5 text-lg">
                    {item.data.key === 'signup_at' && '🎉'}
                    {item.data.key === 'nda_signed_at' && '📝'}
                    {item.data.key === 'fee_agreement_at' && '✅'}
                    {item.data.key === 'first_connection_at' && '🤝'}
                    {!['signup_at', 'nda_signed_at', 'fee_agreement_at', 'first_connection_at'].includes(item.data.key) && '⭐'}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {getMilestoneLabel(item.data.key)}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(item.timestamp), 'h:mm:ss a')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {timelineItems.length === 0 && (
            <div className="text-xs text-muted-foreground py-2">
              No detailed activity recorded for this session
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
