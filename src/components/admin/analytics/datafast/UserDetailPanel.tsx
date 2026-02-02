import { useState } from "react";
import { X, MapPin, Monitor, Smartphone, Chrome, Globe, Clock, Eye, Link2, Calendar, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useUserDetail, type UserDetailData, type UserEvent } from "@/hooks/useUserDetail";
import { ActivityCalendar } from "./ActivityDots";
import { format, formatDistanceToNow, differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";

interface UserDetailPanelProps {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}

const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  'Canada': '🇨🇦',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Australia': '🇦🇺',
  'Netherlands': '🇳🇱',
  'The Netherlands': '🇳🇱',
  'Spain': '🇪🇸',
  'Italy': '🇮🇹',
  'Hungary': '🇭🇺',
  'Unknown': '🌍',
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '🌍';
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatTimeToConvert(seconds: number | undefined): string {
  if (!seconds) return 'N/A';
  const days = differenceInDays(new Date(Date.now() + seconds * 1000), new Date());
  if (days > 0) return `${days} days`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours} hours`;
  const mins = Math.floor(seconds / 60);
  return `${mins} minutes`;
}

function EventTimelineItem({ event }: { event: UserEvent }) {
  const isPageView = event.type === 'page_view';
  
  return (
    <div className="flex gap-3 py-2">
      <div className="flex-shrink-0 mt-1">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center",
          isPageView ? "bg-[hsl(220_70%_90%)]" : "bg-[hsl(12_95%_90%)]"
        )}>
          {isPageView ? (
            <Eye className="w-3 h-3 text-[hsl(220_70%_50%)]" />
          ) : (
            <Link2 className="w-3 h-3 text-[hsl(12_95%_55%)]" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{event.title}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {format(new Date(event.timestamp), 'MMM d, HH:mm')}
          </span>
        </div>
        {event.path && (
          <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono mt-1 inline-block">
            {event.path}
          </code>
        )}
        {event.description && !event.path && (
          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
        )}
      </div>
    </div>
  );
}

function UserStats({ data }: { data: UserDetailData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pageviews</div>
          <div className="text-2xl font-light mt-1 tabular-nums">{data.stats.totalPageviews}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessions</div>
          <div className="text-2xl font-light mt-1 tabular-nums">{data.stats.totalSessions}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Time on Site</div>
          <div className="text-2xl font-light mt-1 tabular-nums">{formatDuration(data.stats.totalTimeOnSite)}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Connections</div>
          <div className="text-2xl font-light mt-1 tabular-nums text-[hsl(12_95%_60%)]">{data.stats.connections}</div>
        </div>
      </div>
      
      {data.stats.timeToConvert && (
        <div className="bg-[hsl(12_95%_97%)] dark:bg-[hsl(12_95%_10%)] rounded-lg p-3 border border-[hsl(12_95%_90%)] dark:border-[hsl(12_95%_20%)]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[hsl(12_95%_55%)]" />
            <span className="text-xs text-muted-foreground">Time to convert</span>
          </div>
          <div className="text-lg font-medium text-[hsl(12_95%_55%)] mt-1">
            {formatTimeToConvert(data.stats.timeToConvert)}
          </div>
        </div>
      )}
    </div>
  );
}

export function UserDetailPanel({ userId, open, onClose }: UserDetailPanelProps) {
  const { data, isLoading } = useUserDetail(userId);
  
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            {data && (
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(12_95%_77%)] to-[hsl(12_95%_60%)] flex items-center justify-center text-white text-xl font-medium">
                  {data.profile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <SheetTitle className="text-xl font-medium">
                    {data.profile.name}
                    {data.profile.isAnonymous && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">Anonymous</Badge>
                    )}
                  </SheetTitle>
                  {data.profile.company && (
                    <p className="text-sm text-muted-foreground mt-0.5">{data.profile.company}</p>
                  )}
                  {data.profile.email && (
                    <p className="text-xs text-muted-foreground">{data.profile.email}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </SheetHeader>
        
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(12_95%_60%)]" />
          </div>
        ) : data ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left sidebar - Profile & Tech */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r p-4 space-y-6 bg-muted/20">
              {/* Location */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Location</div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getFlag(data.geo.country)}</span>
                  <div>
                    <div className="text-sm font-medium">{data.geo.city}</div>
                    <div className="text-xs text-muted-foreground">{data.geo.country}</div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Tech Stack */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Technology</div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    {data.tech.device === 'Mobile' ? (
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Monitor className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">{data.tech.device}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{data.tech.os}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Chrome className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{data.tech.browser}</span>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Source */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Acquisition</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Channel</span>
                    <Badge variant="outline" className="text-[10px]">{data.source.channel}</Badge>
                  </div>
                  {data.source.referrer && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Referrer</span>
                      <span className="text-xs truncate max-w-[120px]">
                        {new URL(data.source.referrer).hostname}
                      </span>
                    </div>
                  )}
                  {data.source.utmCampaign && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Campaign</span>
                      <span className="text-xs truncate max-w-[120px]">{data.source.utmCampaign}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <Separator />
              
              {/* Dates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">First seen</span>
                  <span>{format(new Date(data.stats.firstSeen), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Last seen</span>
                  <span>{formatDistanceToNow(new Date(data.stats.lastSeen), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
            
            {/* Center - Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b">
                <UserStats data={data} />
              </div>
              
              {/* Activity Heatmap */}
              <div className="p-4 border-b">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                  Activity (Last 6 months)
                </div>
                <ActivityCalendar days={data.activityHeatmap} />
              </div>
              
              {/* Event Timeline */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="p-4 pb-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Event Timeline ({data.events.length} events)
                  </div>
                </div>
                <ScrollArea className="flex-1 px-4 pb-4">
                  <div className="space-y-1">
                    {data.events.slice().reverse().slice(0, 50).map((event) => (
                      <EventTimelineItem key={event.id} event={event} />
                    ))}
                    {data.events.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        No events recorded
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            User not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
