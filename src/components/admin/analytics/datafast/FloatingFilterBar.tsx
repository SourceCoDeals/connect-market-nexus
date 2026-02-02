import { X, Heart } from "lucide-react";
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

export function FloatingFilterBar() {
  const { filters, removeFilter } = useAnalyticsFilters();

  if (filters.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
      {filters.map((filter) => (
        <div
          key={`${filter.type}-${filter.value}`}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full",
            "bg-card/95 backdrop-blur-sm border border-border/50 shadow-lg",
            "text-sm"
          )}
        >
          {/* Icon */}
          {filter.type === 'referrer' && (
            <ReferrerLogo domain={filter.value} className="w-4 h-4" />
          )}
          
          {/* Label */}
          <span className="text-muted-foreground">
            {FILTER_TYPE_LABELS[filter.type]} is
          </span>
          <span className="text-foreground font-medium">{filter.label}</span>
          
          {/* Remove button */}
          <button
            onClick={() => removeFilter(filter.type, filter.value)}
            className="ml-1 p-1 rounded-full hover:bg-muted transition-colors"
            aria-label={`Remove ${filter.label} filter`}
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      ))}
      
      {/* Favorite button like datafast */}
      <button className="p-2.5 rounded-full bg-card/95 backdrop-blur-sm border border-border/50 shadow-lg text-muted-foreground hover:text-foreground transition-colors">
        <Heart className="h-4 w-4" />
      </button>
    </div>
  );
}
