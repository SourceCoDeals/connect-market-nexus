import { Monitor, Smartphone, Tablet, Globe, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/lib/flagEmoji";
import type { EnhancedRealTimeData } from "@/hooks/useEnhancedRealTimeAnalytics";

interface RealTimeSummaryPanelProps {
  data: EnhancedRealTimeData;
  activeFilter?: { type: 'country' | 'device' | 'referrer'; value: string } | null;
  onFilterChange?: (filter: { type: 'country' | 'device' | 'referrer'; value: string } | null) => void;
}

export function RealTimeSummaryPanel({ 
  data, 
  activeFilter, 
  onFilterChange 
}: RealTimeSummaryPanelProps) {
  return (
    <div className="space-y-4">
      {/* Main stats card */}
      <div className="rounded-2xl bg-card border border-border/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-coral-500"></span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Real-Time
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-light tracking-tight text-foreground tabular-nums">
            {data.totalActiveUsers}
          </span>
          <span className="text-sm text-muted-foreground">visitors on site</span>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          Est. value: <span className="font-semibold text-coral-400">${data.totalEstimatedValue.toFixed(2)}</span>
        </div>
      </div>

      {/* Referrers */}
      <div className="rounded-2xl bg-card border border-border/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Referrers
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data.byReferrer.map(({ referrer, count }) => (
            <FilterChip
              key={referrer}
              label={referrer}
              count={count}
              isActive={activeFilter?.type === 'referrer' && activeFilter.value === referrer}
              onClick={() => {
                if (activeFilter?.type === 'referrer' && activeFilter.value === referrer) {
                  onFilterChange?.(null);
                } else {
                  onFilterChange?.({ type: 'referrer', value: referrer });
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Countries */}
      <div className="rounded-2xl bg-card border border-border/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Countries
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data.byCountry.slice(0, 5).map(({ country, countryCode, count }) => (
            <FilterChip
              key={country}
              label={`${countryCodeToFlag(countryCode)} ${country}`}
              count={count}
              isActive={activeFilter?.type === 'country' && activeFilter.value === country}
              onClick={() => {
                if (activeFilter?.type === 'country' && activeFilter.value === country) {
                  onFilterChange?.(null);
                } else {
                  onFilterChange?.({ type: 'country', value: country });
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Devices */}
      <div className="rounded-2xl bg-card border border-border/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Devices
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data.byDevice.map(({ device, count }) => (
            <FilterChip
              key={device}
              label={
                <span className="flex items-center gap-1.5">
                  <DeviceIcon type={device} />
                  <span className="capitalize">{device}</span>
                </span>
              }
              count={count}
              isActive={activeFilter?.type === 'device' && activeFilter.value === device}
              onClick={() => {
                if (activeFilter?.type === 'device' && activeFilter.value === device) {
                  onFilterChange?.(null);
                } else {
                  onFilterChange?.({ type: 'device', value: device });
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ 
  label, 
  count, 
  isActive, 
  onClick 
}: { 
  label: React.ReactNode; 
  count: number; 
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors",
        isActive 
          ? "bg-coral-500 text-white" 
          : "bg-muted/50 text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
      <span className={cn(
        "font-semibold tabular-nums",
        isActive ? "text-white/90" : "text-foreground"
      )}>
        {count}
      </span>
    </button>
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
