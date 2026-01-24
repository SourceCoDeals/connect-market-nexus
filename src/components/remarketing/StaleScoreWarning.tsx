import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, TrendingUp, TrendingDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DealSnapshot {
  revenue?: number;
  ebitda?: number;
  location?: string;
  category?: string;
  snapshot_at?: string;
}

interface CurrentDeal {
  revenue?: number;
  ebitda?: number;
  location?: string;
  category?: string;
}

interface StaleScoreWarningProps {
  dealSnapshot: DealSnapshot | null;
  currentDeal: CurrentDeal;
  onRescore: () => void;
  isRescoring?: boolean;
  className?: string;
}

interface Change {
  field: string;
  oldValue: string | number | undefined;
  newValue: string | number | undefined;
  percentChange?: number;
  icon: typeof TrendingUp;
}

const formatCurrency = (value: number | undefined) => {
  if (!value) return 'N/A';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const detectChanges = (snapshot: DealSnapshot | null, current: CurrentDeal): Change[] => {
  if (!snapshot) return [];
  
  const changes: Change[] = [];
  
  // Revenue change
  if (snapshot.revenue && current.revenue && snapshot.revenue !== current.revenue) {
    const percentChange = ((current.revenue - snapshot.revenue) / snapshot.revenue) * 100;
    changes.push({
      field: 'Revenue',
      oldValue: snapshot.revenue,
      newValue: current.revenue,
      percentChange,
      icon: percentChange > 0 ? TrendingUp : TrendingDown,
    });
  }
  
  // EBITDA change
  if (snapshot.ebitda && current.ebitda && snapshot.ebitda !== current.ebitda) {
    const percentChange = ((current.ebitda - snapshot.ebitda) / snapshot.ebitda) * 100;
    changes.push({
      field: 'EBITDA',
      oldValue: snapshot.ebitda,
      newValue: current.ebitda,
      percentChange,
      icon: percentChange > 0 ? TrendingUp : TrendingDown,
    });
  }
  
  // Location change
  if (snapshot.location && current.location && snapshot.location !== current.location) {
    changes.push({
      field: 'Location',
      oldValue: snapshot.location,
      newValue: current.location,
      icon: MapPin,
    });
  }
  
  // Category change
  if (snapshot.category && current.category && snapshot.category !== current.category) {
    changes.push({
      field: 'Category',
      oldValue: snapshot.category,
      newValue: current.category,
      icon: AlertTriangle,
    });
  }
  
  return changes;
};

export const StaleScoreWarning = ({
  dealSnapshot,
  currentDeal,
  onRescore,
  isRescoring = false,
  className,
}: StaleScoreWarningProps) => {
  const changes = detectChanges(dealSnapshot, currentDeal);
  
  // No warning needed if no snapshot or no changes
  if (!dealSnapshot || changes.length === 0) return null;
  
  return (
    <Alert 
      variant="default" 
      className={cn(
        'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20',
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Deal Updated Since Scoring
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            The deal financials have changed since scores were calculated. Results may be stale.
          </p>
          
          <div className="flex flex-wrap gap-2">
            {changes.map((change, index) => {
              const Icon = change.icon;
              const isPositive = change.percentChange && change.percentChange > 0;
              
              return (
                <div
                  key={index}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
                    isPositive 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{change.field}:</span>
                  {change.percentChange !== undefined ? (
                    <span>
                      {isPositive ? '+' : ''}{change.percentChange.toFixed(1)}%
                      <span className="text-muted-foreground ml-1">
                        ({formatCurrency(change.oldValue as number)} → {formatCurrency(change.newValue as number)})
                      </span>
                    </span>
                  ) : (
                    <span>
                      {String(change.oldValue)} → {String(change.newValue)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onRescore}
            disabled={isRescoring}
            className="mt-2 border-amber-500/50 text-amber-700 hover:bg-amber-100 dark:text-amber-300"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRescoring && 'animate-spin')} />
            {isRescoring ? 'Rescoring...' : 'Refresh Scores'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default StaleScoreWarning;
