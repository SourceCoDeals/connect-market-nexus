import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/lib/flagEmoji";
import { getAvatarColor, getInitials } from "@/lib/anonymousNames";
import type { EnhancedRealTimeData } from "@/hooks/useEnhancedRealTimeAnalytics";

interface LiveActivityFeedProps {
  events: EnhancedRealTimeData['recentEvents'];
  onUserClick?: (sessionId: string) => void;
}

export function LiveActivityFeed({ events, onUserClick }: LiveActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-coral-500"></span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Activity
          </span>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          Waiting for activity...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-coral-500"></span>
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Live Activity
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          Last 5 minutes
        </span>
      </div>

      {/* Events list */}
      <div className="max-h-[280px] overflow-y-auto">
        {events.map((event, i) => (
          <ActivityEventRow 
            key={event.id} 
            event={event} 
            isFirst={i === 0}
            onUserClick={onUserClick}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityEventRow({ 
  event, 
  isFirst,
  onUserClick 
}: { 
  event: EnhancedRealTimeData['recentEvents'][0];
  isFirst: boolean;
  onUserClick?: (sessionId: string) => void;
}) {
  const { user, pagePath, timestamp } = event;
  const flag = countryCodeToFlag(user.countryCode);
  const avatarColor = user.isAnonymous 
    ? getAvatarColor(user.displayName)
    : getBuyerTypeColor(user.buyerType);

  const timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

  // Format page path for display
  const displayPath = formatPagePath(pagePath || '/');

  return (
    <div 
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer",
        isFirst && "bg-coral-500/5"
      )}
      onClick={() => onUserClick?.(user.sessionId)}
    >
      {/* Avatar */}
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 mt-0.5",
        avatarColor
      )}>
        {getInitials(user.displayName)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed">
          <span 
            className="font-medium text-foreground hover:underline"
            style={{ color: getTextColor(user.displayName, user.isAnonymous, user.buyerType) }}
          >
            {user.displayName}
          </span>
          <span className="text-muted-foreground"> from </span>
          <span>{flag}</span>
          <span className="text-muted-foreground"> {user.country || 'Unknown'} </span>
          <span className="text-muted-foreground">visited </span>
          <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-foreground">
            {displayPath}
          </code>
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo}</p>
      </div>
    </div>
  );
}

function formatPagePath(path: string): string {
  if (!path || path === '/') return '/home';
  if (path.length > 25) {
    return path.substring(0, 22) + '...';
  }
  return path;
}

function getBuyerTypeColor(buyerType: string | null): string {
  const colorMap: Record<string, string> = {
    'privateEquity': 'bg-violet-500',
    'familyOffice': 'bg-emerald-500',
    'corporate': 'bg-blue-500',
    'searchFund': 'bg-amber-500',
    'independentSponsor': 'bg-cyan-500',
    'individual': 'bg-rose-500',
  };
  
  return colorMap[buyerType || ''] || 'bg-slate-500';
}

function getTextColor(name: string, isAnonymous: boolean, buyerType: string | null): string {
  if (!isAnonymous) {
    const buyerColors: Record<string, string> = {
      'privateEquity': '#8b5cf6',
      'familyOffice': '#10b981',
      'corporate': '#3b82f6',
      'searchFund': '#f59e0b',
      'independentSponsor': '#06b6d4',
      'individual': '#f43f5e',
    };
    return buyerColors[buyerType || ''] || '#64748b';
  }
  
  const colorMap: Record<string, string> = {
    coral: '#f87171',
    azure: '#3b82f6',
    amber: '#f59e0b',
    jade: '#10b981',
    violet: '#8b5cf6',
    rose: '#f43f5e',
    teal: '#14b8a6',
    gold: '#eab308',
  };
  const colorWord = name.split(' ')[0];
  return colorMap[colorWord] || '#64748b';
}
