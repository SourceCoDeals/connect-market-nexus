import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSessionEvents } from "@/hooks/use-session-events";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import * as LucideIcons from "lucide-react";
import { groupEventsByTime } from "@/lib/session-event-utils";
import { ArrowRight } from "lucide-react";

interface SessionEventsDialogProps {
  sessionId: string | null;
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SessionEventsDialog({
  sessionId,
  userId,
  open,
  onOpenChange,
}: SessionEventsDialogProps) {
  const { data, isLoading } = useSessionEvents(sessionId, userId);

  const truncatedSessionId = sessionId 
    ? `${sessionId.substring(0, 8)}...${sessionId.substring(sessionId.length - 4)}`
    : '';

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || LucideIcons.Circle;
    return Icon;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Events for Session ID #{truncatedSessionId} from User {userId?.substring(0, 8)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed timeline of all user events during this session
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : data ? (
          <div className="flex flex-col gap-5 mt-2">
            {/* Summary Section */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                Session with <span className="font-semibold">{data.totalEvents} events</span>{' '}
                {data.isOngoing ? 'currently ongoing' : 'ended'} for{' '}
                <span className="font-semibold">{data.sessionDuration} minutes</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.isOngoing ? 'now' : format(new Date(data.events[data.events.length - 1]?.timestamp), 'PPpp')}
              </p>
            </div>

            {/* Most Frequent Section */}
            {data.mostFrequent.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Most Frequent
                </h3>
                <div className="flex flex-wrap gap-2">
                  {data.mostFrequent.map((freq, idx) => {
                    const Icon = getIcon(freq.icon);
                    return (
                      <Badge key={idx} variant="secondary" className="px-3 py-1.5 text-xs">
                        <Icon className="w-3 h-3 mr-1.5" />
                        {freq.type} ({freq.count})
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Events Timeline */}
            <div className="flex-1 min-h-0">
              <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                All Events
              </h3>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {groupEventsByTime(data.events).map((eventGroup, groupIdx) => {
                    // Special handling for search event chains - show only the last search
                    const isSearchChain = eventGroup.every(e => e.description.startsWith('Search -'));
                    
                    if (isSearchChain && eventGroup.length > 1) {
                      const lastSearch = eventGroup[eventGroup.length - 1];
                      return (
                        <div key={groupIdx} className="flex items-start gap-3">
                          <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
                            {format(new Date(lastSearch.timestamp), 'h:mm a')}
                          </span>
                          <div className="flex items-start gap-2 flex-1">
                            {(() => {
                              const Icon = getIcon(lastSearch.icon);
                              return <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />;
                            })()}
                            <div className="flex-1">
                              <p className="text-sm font-medium">{lastSearch.description}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                ({eventGroup.length} keystrokes)
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={groupIdx}>
                        {eventGroup.length === 1 ? (
                          // Single event
                          <div className="flex items-start gap-3">
                            <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
                              {format(new Date(eventGroup[0].timestamp), 'h:mm a')}
                            </span>
                            <div className="flex items-start gap-2 flex-1">
                              {(() => {
                                const Icon = getIcon(eventGroup[0].icon);
                                return <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />;
                              })()}
                              <div className="flex-1">
                                <p className="text-sm font-medium">{eventGroup[0].description}</p>
                                {eventGroup[0].metadata?.page_path && !eventGroup[0].description.includes(eventGroup[0].metadata.page_path) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {eventGroup[0].metadata.page_path}
                                  </p>
                                )}
                                {eventGroup[0].metadata?.element_id && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Element: {eventGroup[0].metadata.element_id}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Event chain (non-search)
                          <div className="flex items-start gap-3">
                            <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
                              {format(new Date(eventGroup[0].timestamp), 'h:mm a')}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {eventGroup.map((event, eventIdx) => {
                                  const Icon = getIcon(event.icon);
                                  return (
                                    <div key={event.id} className="flex items-center gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="text-xs font-medium">{event.description}</span>
                                      </div>
                                      {eventIdx < eventGroup.length - 1 && (
                                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No events found for this session
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
