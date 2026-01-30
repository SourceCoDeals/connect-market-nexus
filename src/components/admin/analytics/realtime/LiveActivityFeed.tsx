import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/lib/flagEmoji";
import { getAvatarColor, getInitials } from "@/lib/anonymousNames";
import type { EnhancedRealTimeData } from "@/hooks/useEnhancedRealTimeAnalytics";

interface LiveActivityFeedProps {
  events: EnhancedRealTimeData['recentEvents'];
  onUserClick?: (sessionId: string) => void;
}

function SessionStatusIndicator({ status }: { status: 'active' | 'idle' | 'ended' }) {
  if (status === 'active') {
    return (
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
      </span>
    );
  }
  
  if (status === 'idle') {
    return <span className="inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>;
  }
  
  return <span className="inline-flex rounded-full h-1.5 w-1.5 bg-slate-500"></span>;
}

function getStatusLabel(status: 'active' | 'idle' | 'ended'): string {
  if (status === 'active') return 'Active';
  if (status === 'idle') return 'Idle';
  return 'Session ended';
}

export function LiveActivityFeed({ events, onUserClick }: LiveActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-coral-500"></span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
            Live Activity
          </span>
        </div>
        <p className="text-sm text-white/50 text-center py-4">
          Waiting for activity...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-coral-500"></span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
          Live Activity
        </span>
        <span className="ml-auto text-[10px] text-white/40">
          Last 1 hour
        </span>
      </div>

      {/* Events list */}
      <div className="max-h-[220px] overflow-y-auto">
        {events.slice(0, 15).map((event, i) => (
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
  const sessionStatus = user.sessionStatus || 'ended';

  // Format page path for display
  const displayPath = formatPagePath(pagePath || '/');

  return (
    <div 
      className={cn(
        "flex items-start gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors cursor-pointer group",
        isFirst && "bg-coral-500/10",
        sessionStatus === 'ended' && "opacity-70"
      )}
      onClick={() => onUserClick?.(user.sessionId)}
      title="Click to focus on map"
    >
      {/* Avatar */}
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 mt-0.5 group-hover:ring-2 group-hover:ring-white/30 transition-all",
        avatarColor
      )}>
        {getInitials(user.displayName)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-relaxed text-white/90">
          <span 
            className="font-medium"
            style={{ color: getTextColor(user.displayName, user.isAnonymous, user.buyerType) }}
          >
            {user.displayName}
          </span>
          <span className="text-white/50"> from </span>
          <span>{flag}</span>
          <span className="text-white/50"> {user.country || 'Unknown'} </span>
          <span className="text-white/50">visited </span>
          <code className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/80">
            {displayPath}
          </code>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-white/40">{timeAgo}</p>
          <span className="text-white/20">•</span>
          <div className="flex items-center gap-1">
            <SessionStatusIndicator status={sessionStatus} />
            <span className={cn(
              "text-[10px]",
              sessionStatus === 'active' && "text-emerald-400",
              sessionStatus === 'idle' && "text-amber-400",
              sessionStatus === 'ended' && "text-slate-400"
            )}>
              {getStatusLabel(sessionStatus)}
            </span>
          </div>
        </div>
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
      'privateEquity': '#a78bfa',
      'familyOffice': '#34d399',
      'corporate': '#60a5fa',
      'searchFund': '#fbbf24',
      'independentSponsor': '#22d3ee',
      'individual': '#fb7185',
    };
    return buyerColors[buyerType || ''] || '#94a3b8';
  }
  
  const colorMap: Record<string, string> = {
    coral: '#fca5a5',
    azure: '#93c5fd',
    amber: '#fcd34d',
    jade: '#6ee7b7',
    violet: '#c4b5fd',
    rose: '#fda4af',
    teal: '#5eead4',
    gold: '#fde047',
  };
  const colorWord = name.split(' ')[0];
  return colorMap[colorWord] || '#94a3b8';
}
