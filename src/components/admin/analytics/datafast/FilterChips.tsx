import { X, Filter } from "lucide-react";
import { useAnalyticsFilters, FilterType } from "@/contexts/AnalyticsFiltersContext";
import { cn } from "@/lib/utils";
import { ReferrerLogo } from "./ReferrerLogo";

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  channel: 'Channel',
  referrer: 'Referrer',
  country: 'Country',
  city: 'City',
  region: 'Region',
  page: 'Page',
  browser: 'Browser',
  os: 'OS',
  device: 'Device',
  campaign: 'Campaign',
  keyword: 'Keyword',
};

export function FilterChips() {
  const { filters, removeFilter, clearFilters } = useAnalyticsFilters();

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-xl border border-border/50">
      <div className="flex items-center gap-1.5 text-muted-foreground mr-2">
        <Filter className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase tracking-wider">Filtered by</span>
      </div>
      
      {filters.map((filter) => (
        <div
          key={`${filter.type}-${filter.value}`}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg",
            "bg-card border border-border/50",
            "text-sm font-medium",
            "transition-all hover:border-border"
          )}
        >
          {/* Icon */}
          {filter.type === 'referrer' && filter.icon && (
            <ReferrerLogo domain={filter.value} className="w-4 h-4" />
          )}
          
          {/* Label */}
          <span className="text-muted-foreground text-xs">
            {FILTER_TYPE_LABELS[filter.type]} is
          </span>
          <span className="text-foreground">{filter.label}</span>
          
          {/* Remove button */}
          <button
            onClick={() => removeFilter(filter.type, filter.value)}
            className="ml-1 p-0.5 rounded-md hover:bg-muted transition-colors"
            aria-label={`Remove ${filter.label} filter`}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      ))}
      
      {filters.length > 1 && (
        <button
          onClick={clearFilters}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
