import { useState } from "react";
import { X, MapPin, Monitor, Smartphone, Chrome, Globe, Clock, Eye, Link2, Calendar, ExternalLink, Search, ChevronDown, ChevronRight } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

function formatTimeToConvert(firstSeen: string, converted?: string): string {
  if (!converted) return 'Not converted';
  const start = new Date(firstSeen);
  const end = new Date(converted);
  const days = differenceInDays(end, start);
  if (days > 0) return `${days} days`;
  const hours = differenceInHours(end, start);
  if (hours > 0) return `${hours} hours`;
  const mins = differenceInMinutes(end, start);
  return `${mins} minutes`;
}

function getFavicon(url: string): string {
  try {
    // Handle both full URLs and simple domains (e.g., "chatgpt.com")
    if (!url.includes('://')) {
      // Simple domain - extract it directly
      const domain = url.replace('www.', '').split('/')[0];
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    }
    const domain = new URL(url).hostname.replace('www.', '');
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

// Safely extract hostname from a URL or domain string
function safeGetHostname(urlOrDomain: string): string {
  if (!urlOrDomain) return '';
  try {
    // Handle simple domains like "chatgpt.com" (no protocol)
    if (!urlOrDomain.includes('://')) {
      return urlOrDomain.replace('www.', '').split('/')[0];
    }
    return new URL(urlOrDomain).hostname.replace('www.', '');
  } catch {
    // Fallback: return the original value cleaned up
    return urlOrDomain.replace('www.', '').split('/')[0];
  }
}

// Group events by date
function groupEventsByDate(events: UserEvent[]): Record<string, UserEvent[]> {
  const groups: Record<string, UserEvent[]> = {};
  events.forEach(event => {
    const dateKey = format(new Date(event.timestamp), 'yyyy-MM-dd');
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(event);
  });
  return groups;
}

// Event item with expandable parameters
function EventTimelineItem({ event }: { event: UserEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isPageView = event.type === 'page_view';
  const hasParams = event.metadata && Object.keys(event.metadata).length > 0;
  
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="flex gap-3 py-2 hover:bg-muted/20 rounded-lg px-2 -mx-2 transition-colors">
        <div className="flex-shrink-0 mt-0.5">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center",
            isPageView ? "bg-[hsl(220_70%_92%)]" : "bg-[hsl(12_95%_92%)]"
          )}>
            {isPageView ? (
              <Eye className="w-3.5 h-3.5 text-[hsl(220_70%_50%)]" />
            ) : (
              <Link2 className="w-3.5 h-3.5 text-[hsl(12_95%_55%)]" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <CollapsibleTrigger className="w-full text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{event.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {format(new Date(event.timestamp), 'HH:mm')}
                </span>
                {hasParams && (
                  <ChevronRight className={cn(
                    "w-3 h-3 text-muted-foreground transition-transform",
                    expanded && "rotate-90"
                  )} />
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          {event.path && (
            <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono mt-1 inline-block max-w-full truncate">
              {event.path}
            </code>
          )}
          {event.description && !event.path && (
            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
          )}
          
          {/* Expandable parameters */}
          <CollapsibleContent>
            {hasParams && (
              <div className="mt-2 bg-muted/30 rounded-lg p-2 space-y-1">
                {Object.entries(event.metadata!).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}

// Date header for event groups
function DateHeader({ date }: { date: string }) {
  const d = new Date(date);
  return (
    <div className="sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
      <div className="text-xs font-medium text-muted-foreground flex items-center gap-2">
        <Calendar className="w-3 h-3" />
        {format(d, 'EEEE, MMM d, yyyy')}
      </div>
    </div>
  );
}

export function UserDetailPanel({ userId, open, onClose }: UserDetailPanelProps) {
  const { data, isLoading } = useUserDetail(userId);
  
  // Group events by date
  const groupedEvents = data ? groupEventsByDate(
    data.events.slice().reverse().slice(0, 100)
  ) : {};
  
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] p-0 flex flex-col rounded-t-2xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3 border-b">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20" />
        </div>
        
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(12_95%_60%)]" />
          </div>
        ) : data ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column - Profile & Details */}
            <div className="w-80 border-r bg-muted/10 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {/* Avatar & Name */}
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(12_95%_77%)] to-[hsl(12_95%_60%)] flex items-center justify-center text-white text-2xl font-medium flex-shrink-0">
                      {data.profile.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-medium truncate">
                        {data.profile.name}
                      </h2>
                      {data.profile.isAnonymous && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">Anonymous</Badge>
                      )}
                      {data.profile.company && (
                        <p className="text-sm text-muted-foreground mt-1">{data.profile.company}</p>
                      )}
                      {data.profile.email && (
                        <p className="text-xs text-muted-foreground mt-0.5">{data.profile.email}</p>
                      )}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Location */}
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Location</div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getFlag(data.geo.country)}</span>
                      <div>
                        <div className="text-sm font-medium">{data.geo.country}</div>
                        <div className="text-xs text-muted-foreground">{data.geo.city}</div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Technology */}
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Technology</div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        {data.tech.device === 'Mobile' ? (
                          <Smartphone className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Monitor className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">{data.tech.device}</span>
                        {data.tech.resolution && (
                          <span className="text-xs text-muted-foreground">({data.tech.resolution})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{data.tech.os}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Chrome className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{data.tech.browser}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Acquisition */}
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Acquisition</div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Channel</span>
                        <Badge variant="outline" className="text-[10px]">{data.source.channel}</Badge>
                      </div>
                      
                      {data.source.referrer && (
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">Referrer</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                                  <img 
                                    src={getFavicon(data.source.referrer)} 
                                    alt="" 
                                    className="w-4 h-4 flex-shrink-0"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                  <a 
                                    href={data.source.referrer} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline truncate flex-1"
                                  >
                                    {data.source.referrer}
                                  </a>
                                  <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-md">
                                <p className="break-all text-xs">{data.source.referrer}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                      
                      {data.source.landingPage && (
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">Landing Page</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                            {data.source.landingPage}
                          </code>
                        </div>
                      )}
                      
                      {data.source.utmCampaign && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Campaign</span>
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{data.source.utmCampaign}</span>
                        </div>
                      )}
                      {data.source.utmSource && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Source</span>
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{data.source.utmSource}</span>
                        </div>
                      )}
                      {data.source.utmMedium && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Medium</span>
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{data.source.utmMedium}</span>
                        </div>
                      )}
                      
                      {/* Full Visit History for all sessions */}
                      {data.source.allSessions && data.source.allSessions.length > 0 && (
                        <div className="pt-3 border-t mt-3">
                          <span className="text-xs text-muted-foreground block mb-2">
                            Visit History ({data.source.allSessions.length} {data.source.allSessions.length === 1 ? 'session' : 'sessions'})
                          </span>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {data.source.allSessions.map((session, i) => (
                              <div key={i} className="text-xs bg-muted/30 p-2 rounded space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">
                                    {format(new Date(session.startedAt), 'MMM d, HH:mm')}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{session.channel}</Badge>
                                </div>
                                {session.landingPage && (
                                  <code className="block text-[10px] text-muted-foreground truncate">
                                    → {session.landingPage}
                                  </code>
                                )}
                                {session.referrer && (
                                  <a 
                                    href={session.referrer} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block text-[10px] text-blue-600 hover:underline truncate"
                                  >
                                    via {session.referrer}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Timestamps */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">First seen</span>
                      <span className="font-medium">{format(new Date(data.stats.firstSeen), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last seen</span>
                      <span className="font-medium">{formatDistanceToNow(new Date(data.stats.lastSeen), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
            
            {/* Right Column - Stats & Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Stats Grid */}
              <div className="p-6 border-b">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-muted/30 rounded-xl p-4 text-center">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Pageviews</div>
                    <div className="text-3xl font-light mt-2 tabular-nums">{data.stats.totalPageviews}</div>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 text-center">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Sessions</div>
                    <div className="text-3xl font-light mt-2 tabular-nums">{data.stats.totalSessions}</div>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 text-center">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Time on Site</div>
                    <div className="text-3xl font-light mt-2 tabular-nums">{formatDuration(data.stats.totalTimeOnSite)}</div>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 text-center">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Connections</div>
                    <div className="text-3xl font-light mt-2 tabular-nums text-[hsl(12_95%_60%)]">{data.stats.connections}</div>
                  </div>
                </div>
                
                {/* Time to convert badge */}
                {data.stats.connections > 0 && (
                  <div className="mt-4 flex justify-end">
                    <div className="inline-flex items-center gap-2 bg-[hsl(145_60%_95%)] dark:bg-[hsl(145_60%_10%)] rounded-full px-4 py-2 border border-[hsl(145_60%_80%)] dark:border-[hsl(145_60%_20%)]">
                      <Clock className="w-4 h-4 text-[hsl(145_60%_40%)]" />
                      <span className="text-sm">
                        Time to convert: <span className="font-medium text-[hsl(145_60%_35%)]">
                          {formatTimeToConvert(data.stats.firstSeen, data.stats.convertedAt)}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Activity Heatmap */}
              <div className="p-6 border-b">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4">
                  Activity (Last 6 months)
                </div>
                <ActivityCalendar days={data.activityHeatmap} />
              </div>
              
              {/* Event Timeline */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="px-6 py-4 border-b bg-background">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Event Timeline ({data.events.length} events)
                  </div>
                </div>
                <ScrollArea className="flex-1 px-6">
                  <div className="py-4 space-y-2">
                    {/* Found site via - acquisition event */}
                    {data.source.referrer && (
                      <>
                        <DateHeader date={data.stats.firstSeen} />
                        <div className="flex gap-3 py-2 px-2 -mx-2 bg-[hsl(145_60%_95%)] dark:bg-[hsl(145_60%_10%)] rounded-lg">
                          <div className="flex-shrink-0 mt-0.5">
                            <div className="w-7 h-7 rounded-full bg-[hsl(145_60%_85%)] flex items-center justify-center">
                              <Search className="w-3.5 h-3.5 text-[hsl(145_60%_40%)]" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Found site via</span>
                              <img 
                                src={getFavicon(data.source.referrer)} 
                                alt="" 
                                className="w-4 h-4"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                              <span className="text-sm text-[hsl(145_60%_35%)] font-medium truncate">
                                {safeGetHostname(data.source.referrer)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {data.source.referrer}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {/* Grouped events by date */}
                    {Object.entries(groupedEvents)
                      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                      .map(([date, events]) => (
                        <div key={date}>
                          <DateHeader date={date} />
                          {events.map((event) => (
                            <EventTimelineItem key={event.id} event={event} />
                          ))}
                        </div>
                      ))
                    }
                    
                    {data.events.length === 0 && !data.source.referrer && (
                      <div className="text-sm text-muted-foreground text-center py-12">
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