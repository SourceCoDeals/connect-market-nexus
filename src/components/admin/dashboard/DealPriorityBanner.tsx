// No icon imports needed

interface DealPriorityBannerProps {
  staleDeals: number;
  needsFollowUp: number;
}

export function DealPriorityBanner({ staleDeals, needsFollowUp }: DealPriorityBannerProps) {
  const showStale = staleDeals > 0;
  const showFollowUp = !showStale && needsFollowUp > 0;

  if (!showStale && !showFollowUp) return null;

  return (
    <div className="border-l-2 border-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {showStale 
            ? `${staleDeals} deal${staleDeals === 1 ? '' : 's'} stale for 7+ days`
            : `${needsFollowUp} deal${needsFollowUp === 1 ? '' : 's'} awaiting follow-up`
          }
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Review these deals to maintain pipeline momentum
        </p>
      </div>
    </div>
  );
}
