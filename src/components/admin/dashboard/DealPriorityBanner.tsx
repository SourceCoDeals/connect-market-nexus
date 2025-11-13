import { AlertCircle } from 'lucide-react';

interface DealPriorityBannerProps {
  staleDeals: number;
  needsFollowUp: number;
}

export function DealPriorityBanner({ staleDeals, needsFollowUp }: DealPriorityBannerProps) {
  const showStale = staleDeals > 0;
  const showFollowUp = !showStale && needsFollowUp > 0;

  if (!showStale && !showFollowUp) return null;

  return (
    <div className="border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
            {showStale 
              ? `${staleDeals} deal${staleDeals === 1 ? '' : 's'} ${staleDeals === 1 ? 'has' : 'have'} been stale for 7+ days`
              : `${needsFollowUp} deal${needsFollowUp === 1 ? '' : 's'} need${needsFollowUp === 1 ? 's' : ''} follow-up`
            }
          </p>
          <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
            Click on these deals below to take action and keep momentum.
          </p>
        </div>
      </div>
    </div>
  );
}
