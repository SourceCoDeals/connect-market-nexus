/**
 * DashboardFilters.tsx
 *
 * Timeframe filter bar for the ReMarketing Dashboard.
 *
 * Extracted from ReMarketingDashboard.tsx for maintainability.
 */
import { TF_OPTIONS, type Timeframe } from './useDashboardData';

interface DashboardFiltersProps {
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

export const DashboardFilters = ({ timeframe, onTimeframeChange }: DashboardFiltersProps) => {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-white p-0.5">
      {TF_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onTimeframeChange(opt.key)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            timeframe === opt.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
