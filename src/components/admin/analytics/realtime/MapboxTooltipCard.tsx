import { Monitor, Smartphone, Tablet, X, FileCheck, FileText, Eye, Heart, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countryCodeToFlag } from '@/lib/flagEmoji';
import type { EnhancedActiveUser } from '@/hooks/useEnhancedRealTimeAnalytics';

interface MapboxTooltipCardProps {
  user: EnhancedActiveUser;
  position: { x: number; y: number };
  onClose: () => void;
}

// DiceBear avatar URL generator
function getAvatarUrl(user: EnhancedActiveUser): string {
  const seed = user.sessionId || user.displayName;
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

const referrerIcons: Record<string, string> = {
  'Google': '🔍',
  'YouTube': '▶️',
  'Facebook': '📘',
  'LinkedIn': '💼',
  'X': '𝕏',
  'X (Twitter)': '𝕏',
  'Twitter': '𝕏',
  'Direct': '🔗',
  'Lovable': '💜',
};

function getDisplayReferrer(referrer: string | null, utmSource: string | null): { icon: string; name: string } {
  const source = (referrer || utmSource || '').toLowerCase();
  
  if (!source) return { icon: '🔗', name: 'Direct' };
  if (source.includes('google')) return { icon: '🔍', name: 'Google' };
  if (source.includes('youtube')) return { icon: '▶️', name: 'YouTube' };
  if (source.includes('facebook') || source.includes('fb.')) return { icon: '📘', name: 'Facebook' };
  if (source.includes('linkedin')) return { icon: '💼', name: 'LinkedIn' };
  if (source.includes('twitter') || source.includes('x.com') || source.includes('t.co')) return { icon: '𝕏', name: 'X' };
  if (source.includes('instagram')) return { icon: '📷', name: 'Instagram' };
  if (source.includes('tiktok')) return { icon: '🎵', name: 'TikTok' };
  if (source.includes('lovable')) return { icon: '💜', name: 'Lovable' };
  
  return { icon: '🌐', name: 'Referral' };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins} min ${secs} sec`;
  const hours = Math.floor(mins / 60);
  return `${hours} hr ${mins % 60} min`;
}

// Buyer type display names and colors
const buyerTypeConfig: Record<string, { label: string; className: string }> = {
  'privateEquity': { label: 'Private Equity', className: 'bg-violet-500/20 text-violet-600 dark:text-violet-400' },
  'familyOffice': { label: 'Family Office', className: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  'corporate': { label: 'Corporate', className: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' },
  'searchFund': { label: 'Search Fund', className: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  'independentSponsor': { label: 'Independent Sponsor', className: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' },
  'individual': { label: 'Individual', className: 'bg-rose-500/20 text-rose-600 dark:text-rose-400' },
  'advisor': { label: 'Advisor', className: 'bg-slate-500/20 text-slate-600 dark:text-slate-400' },
};

export function MapboxTooltipCard({
  user,
  position,
  onClose,
}: MapboxTooltipCardProps) {
  const flag = countryCodeToFlag(user.countryCode);
  const location = [user.city, user.country].filter(Boolean).join(', ') || 'Unknown';
  const referrer = getDisplayReferrer(user.referrer, user.utmSource);
  const buyerConfig = user.buyerType ? buyerTypeConfig[user.buyerType] : null;

  // Position calculation to keep tooltip on screen
  const left = Math.min(position.x + 16, window.innerWidth - 340);
  const top = Math.max(Math.min(position.y - 150, window.innerHeight - 480), 10);

  return (
    <div
      className="fixed z-50 w-80 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-border/50 overflow-hidden"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-muted/30 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md flex-shrink-0">
            <img 
              src={getAvatarUrl(user)} 
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0 pr-6">
            <p className="font-semibold text-foreground truncate text-base">
              {user.displayName}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>{flag}</span>
              <span className="truncate">{location}</span>
            </p>
            
            {/* Device info row */}
            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
              <DeviceIcon type={user.deviceType} />
              <span>{user.deviceType || 'Desktop'}</span>
              {user.browser && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <span>🌐 {user.browser}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Source info */}
      <div className="p-4 border-b border-border/50 space-y-2">
        <SectionLabel>Traffic Source</SectionLabel>
        <InfoRow
          label="Referrer"
          value={
            <span className="flex items-center gap-1.5">
              <span>{referrer.icon}</span>
              <span>{referrer.name}</span>
            </span>
          }
        />
        <InfoRow
          label="Current URL"
          value={
            <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">
              {user.currentPage || '/'}
            </span>
          }
        />
        <InfoRow label="Session time" value={formatDuration(user.sessionDurationSeconds)} />
        <InfoRow label="Total visits" value={user.totalVisits.toString()} />
      </div>

      {/* Engagement metrics */}
      <div className="p-4 border-b border-border/50 space-y-2">
        <SectionLabel>Engagement</SectionLabel>
        <EngagementRow
          icon={<Eye className="w-3.5 h-3.5 text-muted-foreground" />}
          label="Listings viewed"
          value={user.listingsViewed}
          max={10}
        />
        <EngagementRow
          icon={<Heart className="w-3.5 h-3.5 text-rose-500" />}
          label="Listings saved"
          value={user.listingsSaved}
          max={5}
        />
        <EngagementRow
          icon={<MessageCircle className="w-3.5 h-3.5 text-coral-500" />}
          label="Connections sent"
          value={user.connectionsSent}
          max={3}
        />
      </div>

      {/* Buyer Profile - only for logged-in users */}
      {!user.isAnonymous && (
        <div className="p-4 space-y-2">
          <SectionLabel>Buyer Profile</SectionLabel>
          
          {/* Buyer Type Badge */}
          {buyerConfig && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Buyer type</span>
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                buyerConfig.className
              )}>
                {buyerConfig.label}
              </span>
            </div>
          )}
          
          {/* NDA Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">NDA</span>
            <StatusBadge signed={user.ndaSigned} />
          </div>
          
          {/* Fee Agreement Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Fee Agreement</span>
            <StatusBadge signed={user.feeAgreementSigned} />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground">{value}</span>
    </div>
  );
}

function EngagementRow({ 
  icon, 
  label, 
  value, 
  max = 10 
}: { 
  icon: React.ReactNode;
  label: string; 
  value: number; 
  max?: number;
}) {
  const percent = Math.min((value / max) * 100, 100);
  
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-coral-400 to-coral-500 rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-foreground tabular-nums w-4 text-right">
          {value}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ signed }: { signed: boolean }) {
  return signed ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <FileCheck className="w-3.5 h-3.5" />
      <span>Signed</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <FileText className="w-3.5 h-3.5" />
      <span>Pending</span>
    </span>
  );
}

function DeviceIcon({ type }: { type: string }) {
  switch (type) {
    case 'mobile':
      return <Smartphone className="w-3 h-3" />;
    case 'tablet':
      return <Tablet className="w-3 h-3" />;
    default:
      return <Monitor className="w-3 h-3" />;
  }
}
