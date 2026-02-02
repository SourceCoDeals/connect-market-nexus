import { cn } from '@/lib/utils';
import type { BuyerBreakdown } from './MapboxGlobeMap';

interface BuyerCompositionProps {
  breakdown: BuyerBreakdown;
  totalUsers: number;
}

/**
 * Premium buyer composition display with visual progress bars.
 * Replaces generic icon-based layout with data-driven visualization.
 */
export function BuyerComposition({ breakdown, totalUsers }: BuyerCompositionProps) {
  const authenticatedPercent = totalUsers > 0 
    ? Math.round((breakdown.loggedInCount / totalUsers) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Composition bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Authenticated</span>
          <span className="font-medium text-foreground">
            {authenticatedPercent}%{' '}
            <span className="text-muted-foreground/60 font-normal">
              ({breakdown.loggedInCount} of {totalUsers})
            </span>
          </span>
        </div>
        <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-coral-400 to-coral-500 rounded-full transition-all duration-700"
            style={{ width: `${authenticatedPercent}%` }}
          />
        </div>
      </div>

      {/* Qualified buyers section */}
      <div className="space-y-2.5">
        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
          Qualified Buyers
        </span>
        
        <QualifiedMetric
          label="NDA Completed"
          value={breakdown.ndaSignedCount}
          max={breakdown.loggedInCount || 1}
          accentColor="emerald"
        />
        
        <QualifiedMetric
          label="Fee Agreement"
          value={breakdown.feeAgreementCount}
          max={breakdown.loggedInCount || 1}
          accentColor="blue"
        />
      </div>

      {/* Activity velocity */}
      <div className="pt-3 border-t border-border/30 space-y-1.5">
        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
          Activity Velocity
        </span>
        
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Connections this hour</span>
          <span className={cn(
            "text-lg font-light tabular-nums",
            breakdown.connectionsThisHour > 0 ? "text-coral-500" : "text-muted-foreground/60"
          )}>
            {breakdown.connectionsThisHour}
          </span>
        </div>
      </div>
    </div>
  );
}

interface QualifiedMetricProps {
  label: string;
  value: number;
  max: number;
  accentColor: 'emerald' | 'blue' | 'coral';
}

function QualifiedMetric({ label, value, max, accentColor }: QualifiedMetricProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  
  const colorClasses: Record<string, string> = {
    emerald: 'from-emerald-400/80 to-emerald-500',
    blue: 'from-blue-400/80 to-blue-500',
    coral: 'from-coral-400 to-coral-500',
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 bg-gradient-to-r",
              value > 0 ? colorClasses[accentColor] : 'bg-muted/50'
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 min-w-[80px] justify-end">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn(
          "text-sm font-medium tabular-nums w-6 text-right",
          value > 0 ? "text-foreground" : "text-muted-foreground/50"
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}
