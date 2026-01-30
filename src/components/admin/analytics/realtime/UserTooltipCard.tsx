import { Monitor, Smartphone, Tablet, Globe, Clock, Eye, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/lib/flagEmoji";
import { getAvatarColor, getInitials } from "@/lib/anonymousNames";
import { ConversionLikelihoodBar } from "./ConversionLikelihoodBar";
import type { EnhancedActiveUser } from "@/hooks/useEnhancedRealTimeAnalytics";

interface UserTooltipCardProps {
  user: EnhancedActiveUser;
  position?: { x: number; y: number };
}

export function UserTooltipCard({ user, position }: UserTooltipCardProps) {
  const flag = countryCodeToFlag(user.countryCode);
  const avatarColor = user.isAnonymous 
    ? getAvatarColor(user.displayName)
    : getBuyerTypeColor(user.buyerType);
  
  const location = [user.city, user.country].filter(Boolean).join(', ') || 'Unknown Location';
  
  // Format session duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };
  
  return (
    <div 
      className="w-72 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden"
      style={position ? {
        position: 'fixed',
        left: position.x + 16,
        top: position.y - 100,
        zIndex: 1000,
      } : undefined}
    >
      {/* Header with avatar and identity */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white text-sm flex-shrink-0",
            avatarColor
          )}>
            {getInitials(user.displayName)}
          </div>
          
          {/* Identity */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {user.displayName}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span>{flag}</span>
              <span className="truncate">{location}</span>
            </p>
            
            {/* Device/OS/Browser row */}
            <div className="flex items-center gap-2 mt-1.5">
              <DeviceIcon type={user.deviceType} />
              {user.os && (
                <span className="text-[10px] text-muted-foreground/70">{user.os}</span>
              )}
              {user.browser && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <BrowserIcon name={user.browser} />
                  <span className="text-[10px] text-muted-foreground/70">{user.browser}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Company if logged in */}
        {user.companyName && (
          <div className="mt-2 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
            {user.companyName}
          </div>
        )}
      </div>
      
      {/* Session details */}
      <div className="p-4 border-b border-border/50 space-y-2">
        <InfoRow 
          icon={<Globe className="w-3.5 h-3.5" />}
          label="Referrer"
          value={user.referrer || user.utmSource || 'Direct'}
        />
        <InfoRow 
          icon={<Eye className="w-3.5 h-3.5" />}
          label="Current URL"
          value={user.currentPage || '/'}
          isCode
        />
        <InfoRow 
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Session time"
          value={formatDuration(user.sessionDurationSeconds)}
        />
        <InfoRow 
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Total visits"
          value={user.totalVisits.toString()}
        />
      </div>
      
      {/* Intelligence metrics */}
      <div className="p-4 space-y-4">
        <ConversionLikelihoodBar 
          score={user.conversionLikelihood} 
          vsAvg={user.conversionVsAvg} 
        />
        
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Estimated value
          </span>
          <span className="text-lg font-semibold text-coral-400 tabular-nums">
            ${user.estimatedValue.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ 
  icon, 
  label, 
  value, 
  isCode = false 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  isCode?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={cn(
        "text-xs text-foreground truncate max-w-[140px]",
        isCode && "font-mono bg-muted/50 px-1.5 py-0.5 rounded"
      )}>
        {value}
      </span>
    </div>
  );
}

function DeviceIcon({ type }: { type: string }) {
  switch (type) {
    case 'mobile':
      return <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />;
    case 'tablet':
      return <Tablet className="w-3.5 h-3.5 text-muted-foreground" />;
    default:
      return <Monitor className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function BrowserIcon({ name }: { name: string }) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('chrome')) return <span className="text-[10px]">🔵</span>;
  if (lowerName.includes('safari')) return <span className="text-[10px]">🧭</span>;
  if (lowerName.includes('firefox')) return <span className="text-[10px]">🦊</span>;
  if (lowerName.includes('edge')) return <span className="text-[10px]">🌐</span>;
  return null;
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
