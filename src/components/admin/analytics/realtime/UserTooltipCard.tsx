import { Monitor, Smartphone, Tablet, Globe, Clock, Eye, Bookmark, Link2, CheckCircle2, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/lib/flagEmoji";
import { getAvatarColor, getInitials } from "@/lib/anonymousNames";
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

  // Format buyer type for display
  const formatBuyerType = (type: string | null): string => {
    if (!type) return 'Unknown';
    const typeMap: Record<string, string> = {
      'privateEquity': 'Private Equity',
      'familyOffice': 'Family Office',
      'corporate': 'Corporate',
      'searchFund': 'Search Fund',
      'independentSponsor': 'Independent Sponsor',
      'individual': 'Individual',
    };
    return typeMap[type] || type;
  };
  
  return (
    <div 
      className="w-80 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden"
      style={position ? {
        position: 'fixed',
        left: Math.min(position.x + 16, window.innerWidth - 340),
        top: Math.max(position.y - 120, 10),
        zIndex: 1000,
      } : undefined}
    >
      {/* Header with avatar and identity */}
      <div className="p-4 border-b border-border/50 bg-muted/30">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-base flex-shrink-0",
            avatarColor
          )}>
            {getInitials(user.displayName)}
          </div>
          
          {/* Identity */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate text-base">
              {user.displayName}
            </p>
            {user.companyName && (
              <p className="text-sm text-muted-foreground truncate">{user.companyName}</p>
            )}
            {user.isAnonymous && (
              <p className="text-xs text-muted-foreground/70 italic">Anonymous visitor</p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <span>{flag}</span>
              <span className="truncate">{location}</span>
            </p>
            
            {/* Device/OS/Browser row */}
            <div className="flex items-center gap-2 mt-2">
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
          label="Current page"
          value={user.currentPage || '/'}
          isCode
        />
        <InfoRow 
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Session time"
          value={formatDuration(user.sessionDurationSeconds)}
        />
        <InfoRow 
          icon={<Link2 className="w-3.5 h-3.5" />}
          label="Total visits"
          value={user.totalVisits.toString()}
        />
      </div>
      
      {/* Real engagement metrics */}
      {!user.isAnonymous && (
        <div className="p-4 border-b border-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Engagement
          </p>
          <div className="grid grid-cols-3 gap-3">
            <EngagementStat 
              label="Viewed" 
              value={user.listingsViewed} 
              suffix="listings"
            />
            <EngagementStat 
              label="Saved" 
              value={user.listingsSaved} 
              suffix="listings"
            />
            <EngagementStat 
              label="Requested" 
              value={user.connectionsSent} 
              suffix="connections"
            />
          </div>
        </div>
      )}
      
      {/* Trust signals for logged-in users */}
      {!user.isAnonymous && (
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <TrustSignal 
              label="Fee Agreement" 
              signed={user.feeAgreementSigned} 
            />
          </div>
          <div className="flex items-center gap-2">
            <TrustSignal 
              label="NDA" 
              signed={user.ndaSigned} 
            />
          </div>
          
          {user.buyerType && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                getBuyerTypeBadgeColor(user.buyerType)
              )}>
                {formatBuyerType(user.buyerType)}
              </span>
            </div>
          )}
        </div>
      )}
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
        "text-xs text-foreground truncate max-w-[150px]",
        isCode && "font-mono bg-muted/50 px-1.5 py-0.5 rounded"
      )}>
        {value}
      </span>
    </div>
  );
}

function EngagementStat({ 
  label, 
  value, 
  suffix 
}: { 
  label: string; 
  value: number;
  suffix: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function TrustSignal({ label, signed }: { label: string; signed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {signed ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : (
        <FileSignature className="w-4 h-4 text-muted-foreground/50" />
      )}
      <span className={cn(
        "text-xs",
        signed ? "text-emerald-600" : "text-muted-foreground/60"
      )}>
        {signed ? `${label} Signed` : `${label} Pending`}
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

function getBuyerTypeBadgeColor(buyerType: string): string {
  const colorMap: Record<string, string> = {
    'privateEquity': 'bg-violet-500/20 text-violet-400',
    'familyOffice': 'bg-emerald-500/20 text-emerald-400',
    'corporate': 'bg-blue-500/20 text-blue-400',
    'searchFund': 'bg-amber-500/20 text-amber-400',
    'independentSponsor': 'bg-cyan-500/20 text-cyan-400',
    'individual': 'bg-rose-500/20 text-rose-400',
  };
  
  return colorMap[buyerType] || 'bg-slate-500/20 text-slate-400';
}
