import { Monitor, Smartphone, Tablet, Globe, Clock, Eye, Link2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countryCodeToFlag } from '@/lib/flagEmoji';
import type { EnhancedActiveUser } from '@/hooks/useEnhancedRealTimeAnalytics';
import { ConversionLikelihoodBar } from './ConversionLikelihoodBar';

interface MapboxTooltipCardProps {
  user: EnhancedActiveUser;
  position: { x: number; y: number };
  conversionLikelihood: number;
  estimatedValue: number;
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
  'Twitter': '𝕏',
  'Direct': '🔗',
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

export function MapboxTooltipCard({
  user,
  position,
  conversionLikelihood,
  estimatedValue,
  onClose,
}: MapboxTooltipCardProps) {
  const flag = countryCodeToFlag(user.countryCode);
  const location = [user.city, user.country].filter(Boolean).join(', ') || 'Unknown';
  const referrer = getDisplayReferrer(user.referrer, user.utmSource);
  
  // Calculate vs average (baseline 30%)
  const vsAverage = Math.round(((conversionLikelihood - 30) / 30) * 100);
  const vsAverageText = vsAverage >= 0 ? `+${vsAverage}%` : `${vsAverage}%`;

  // Position calculation to keep tooltip on screen
  const left = Math.min(position.x + 16, window.innerWidth - 340);
  const top = Math.max(Math.min(position.y - 150, window.innerHeight - 400), 10);

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

      {/* Session info */}
      <div className="p-4 border-b border-border/50 space-y-2">
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

      {/* Conversion metrics */}
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Conversion likelihood</span>
            <span className={cn(
              "text-xs font-medium",
              vsAverage >= 0 ? "text-emerald-600" : "text-red-500"
            )}>
              {vsAverageText} vs. avg
            </span>
          </div>
          <ConversionLikelihoodBar value={conversionLikelihood} />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">Estimated value</span>
          <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            ${estimatedValue.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
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
