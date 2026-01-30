import { Monitor, Smartphone, Tablet, Globe, Link, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/lib/flagEmoji";
import type { EnhancedRealTimeData } from "@/hooks/useEnhancedRealTimeAnalytics";

interface RealTimeSummaryPanelProps {
  data: EnhancedRealTimeData;
  activeFilter?: { type: 'country' | 'device' | 'referrer' | 'entrySource'; value: string } | null;
  onFilterChange?: (filter: { type: 'country' | 'device' | 'referrer' | 'entrySource'; value: string } | null) => void;
}

export function RealTimeSummaryPanel({ 
  data, 
  activeFilter, 
  onFilterChange 
}: RealTimeSummaryPanelProps) {
  return (
    <div className="space-y-3">
      {/* Main stats card */}
      <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-coral-500"></span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
            Real-Time
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-light tracking-tight text-white tabular-nums">
            {data.totalActiveUsers}
          </span>
          <span className="text-xs text-white/60">visitors on site</span>
        </div>
      </div>

      {/* Entry Sources - NEW */}
      <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 p-3">
        <div className="flex items-center gap-2 mb-2">
          <LogIn className="w-3 h-3 text-white/50" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Entry Sources
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data.byEntrySource.slice(0, 6).map(({ source, count }) => (
            <FilterChip
              key={source}
              label={source}
              count={count}
              isActive={activeFilter?.type === 'entrySource' && activeFilter.value === source}
              onClick={() => {
                if (activeFilter?.type === 'entrySource' && activeFilter.value === source) {
                  onFilterChange?.(null);
                } else {
                  onFilterChange?.({ type: 'entrySource', value: source });
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Referrers */}
      <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Link className="w-3 h-3 text-white/50" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Referrers
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data.byReferrer.slice(0, 5).map(({ referrer, count }) => (
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
      <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-3 h-3 text-white/50" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
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
      <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Monitor className="w-3 h-3 text-white/50" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
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
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] transition-colors",
        isActive 
          ? "bg-coral-500 text-white" 
          : "bg-white/10 text-white/70 hover:bg-white/20"
      )}
    >
      {label}
      <span className={cn(
        "font-semibold tabular-nums",
        isActive ? "text-white/90" : "text-white/90"
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
