import { cn } from '@/lib/utils';

interface EngagementDepthProps {
  listingsViewed: number;
  listingsSaved: number;
  connectionsSent: number;
}

/**
 * Premium engagement visualization with semantic color-coded progress bars.
 * No icons - pure data-driven visualization.
 */
export function EngagementDepth({
  listingsViewed,
  listingsSaved,
  connectionsSent,
}: EngagementDepthProps) {
  // Calculate engagement level for summary
  const engagementLevel = getEngagementLevel(listingsViewed, listingsSaved, connectionsSent);

  return (
    <div className="space-y-3">
      <EngagementBar
        label="Listings explored"
        value={listingsViewed}
        max={20}
        contextLabel={`of ~40`}
      />
      <EngagementBar
        label="Intent signals"
        value={listingsSaved}
        max={5}
        contextLabel="saved"
      />
      <EngagementBar
        label="Outreach"
        value={connectionsSent}
        max={3}
        contextLabel="connections"
      />
      
      {/* Engagement summary line */}
      <div className="pt-2 border-t border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/70">
            Engagement level
          </span>
          <span className={cn(
            "text-[10px] font-medium",
            engagementLevel.colorClass
          )}>
            {engagementLevel.label}
          </span>
        </div>
      </div>
    </div>
  );
}

interface EngagementBarProps {
  label: string;
  value: number;
  max: number;
  contextLabel: string;
}

function EngagementBar({ label, value, max, contextLabel }: EngagementBarProps) {
  const percent = Math.min((value / max) * 100, 100);
  const colorClass = getBarColor(value, max);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground tabular-nums">
          {value} <span className="text-muted-foreground/60 font-normal">{contextLabel}</span>
        </span>
      </div>
      <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Semantic color coding based on engagement level:
 * - Gray: 0 (no activity)
 * - Blue gradient: low engagement (< 30%)
 * - Coral gradient: moderate engagement (30-70%)
 * - Emerald gradient: high engagement (> 70%)
 */
function getBarColor(value: number, max: number): string {
  if (value === 0) return 'bg-muted/50';
  
  const ratio = value / max;
  
  if (ratio < 0.3) {
    return 'bg-gradient-to-r from-blue-400/80 to-blue-500/90';
  }
  if (ratio < 0.7) {
    return 'bg-gradient-to-r from-coral-400 to-coral-500';
  }
  return 'bg-gradient-to-r from-emerald-400 to-emerald-500';
}

function getEngagementLevel(
  viewed: number,
  saved: number,
  connections: number
): { label: string; colorClass: string } {
  // Simple scoring: viewed (1pt each), saved (3pt each), connections (5pt each)
  const score = viewed + (saved * 3) + (connections * 5);
  
  if (score === 0) {
    return { label: 'Observing', colorClass: 'text-muted-foreground/60' };
  }
  if (score < 5) {
    return { label: 'Browsing', colorClass: 'text-blue-500' };
  }
  if (score < 15) {
    return { label: 'Interested', colorClass: 'text-coral-500' };
  }
  if (score < 25) {
    return { label: 'Active buyer', colorClass: 'text-emerald-500' };
  }
  return { label: 'High intent', colorClass: 'text-emerald-600 font-semibold' };
}
