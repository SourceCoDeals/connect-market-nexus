import { cn } from '@/lib/utils';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import type { BuyerBreakdown } from './MapboxGlobeMap';
import { BuyerComposition } from './BuyerComposition';

interface MapboxFloatingPanelProps {
  totalUsers: number;
  buyerBreakdown: BuyerBreakdown;
  referrerBreakdown: Record<string, number>;
  countryBreakdown: Record<string, { count: number; flag: string }>;
  deviceBreakdown: Record<string, number>;
}

const referrerIcons: Record<string, string> = {
  'Google': '🔍',
  'YouTube': '▶️',
  'Facebook': '📘',
  'LinkedIn': '💼',
  'X': '𝕏',
  'X (Twitter)': '𝕏',
  'Direct': '→',
  'Lovable': '💜',
  'SourceCoDeals': '🏢',
  'Email (Brevo)': '✉️',
  'Other': '🌐',
};

export function MapboxFloatingPanel({
  totalUsers,
  buyerBreakdown,
  referrerBreakdown,
  countryBreakdown,
  deviceBreakdown,
}: MapboxFloatingPanelProps) {
  const sortedReferrers = Object.entries(referrerBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const sortedCountries = Object.entries(countryBreakdown)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4);

  return (
    <div className="absolute top-4 left-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-5 w-[320px] z-10 border border-white/20">
      {/* Header - clean and prominent */}
      <div className="flex items-center gap-2.5 mb-5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-light text-foreground tabular-nums">{totalUsers}</span>
          <span className="text-sm text-muted-foreground">
            {totalUsers === 1 ? 'visitor' : 'visitors'}
          </span>
        </div>
      </div>

      {/* Traffic breakdown rows - minimal labels */}
      <div className="space-y-3 text-sm border-b border-border/30 pb-4 mb-4">
        {/* Referrers */}
        <FilterRow
          label="Sources"
          items={sortedReferrers.map(([name, count]) => ({
            icon: referrerIcons[name] || '🌐',
            label: name,
            count,
          }))}
        />

        {/* Countries */}
        <FilterRow
          label="Regions"
          items={sortedCountries.map(([name, data]) => ({
            icon: data.flag,
            label: truncateCountry(name),
            count: data.count,
          }))}
        />

        {/* Devices - compact visual */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wider w-14 flex-shrink-0">
            Devices
          </span>
          <div className="flex gap-1.5">
            {deviceBreakdown.desktop > 0 && (
              <DeviceChip icon={<Monitor className="w-3 h-3" />} count={deviceBreakdown.desktop} />
            )}
            {deviceBreakdown.mobile > 0 && (
              <DeviceChip icon={<Smartphone className="w-3 h-3" />} count={deviceBreakdown.mobile} />
            )}
            {deviceBreakdown.tablet > 0 && (
              <DeviceChip icon={<Tablet className="w-3 h-3" />} count={deviceBreakdown.tablet} />
            )}
          </div>
        </div>
      </div>

      {/* Buyer Intelligence Section - premium design */}
      <div>
        <span className="text-muted-foreground/60 text-[10px] uppercase tracking-[0.12em] font-medium mb-3 block">
          Buyer Intelligence
        </span>
        <BuyerComposition 
          breakdown={buyerBreakdown} 
          totalUsers={totalUsers} 
        />
      </div>
    </div>
  );
}

function truncateCountry(name: string): string {
  if (name.length <= 10) return name;
  // Common abbreviations
  const abbrevs: Record<string, string> = {
    'United States': 'USA',
    'United Kingdom': 'UK',
    'Netherlands': 'NL',
    'Germany': 'DE',
    'Australia': 'AU',
  };
  return abbrevs[name] || name.slice(0, 8);
}

function FilterRow({
  label,
  items,
}: {
  label: string;
  items: Array<{ icon: string; label: string; count: number }>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wider w-14 flex-shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <button
            key={item.label}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/30 hover:bg-muted/50 text-xs transition-colors"
          >
            <span className="text-[11px]">{item.icon}</span>
            <span className="text-muted-foreground text-[10px]">{item.label}</span>
            <span className="font-medium text-foreground text-[10px] tabular-nums">{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DeviceChip({
  icon,
  count,
}: {
  icon: React.ReactNode;
  count: number;
}) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/30 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium text-foreground tabular-nums text-[10px]">{count}</span>
    </div>
  );
}
