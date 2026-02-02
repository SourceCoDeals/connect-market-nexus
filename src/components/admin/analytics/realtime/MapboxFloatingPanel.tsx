import { cn } from '@/lib/utils';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

interface MapboxFloatingPanelProps {
  totalUsers: number;
  totalEstimatedValue: number;
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
  'Direct': '🔗',
  'Other': '🌐',
};

export function MapboxFloatingPanel({
  totalUsers,
  totalEstimatedValue,
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
    <div className="absolute top-4 left-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 w-80 z-10 border border-white/20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span className="text-sm font-medium text-foreground">
          <span className="font-bold">{totalUsers}</span> visitor{totalUsers !== 1 ? 's' : ''} on{' '}
          <span className="font-semibold">marketplace</span>
        </span>
        <span className="text-sm text-emerald-600 dark:text-emerald-400 ml-auto font-medium">
          (est. ${totalEstimatedValue.toFixed(0)})
        </span>
      </div>

      {/* Filter rows */}
      <div className="space-y-3 text-sm">
        {/* Referrers */}
        <FilterRow
          label="Referrers"
          items={sortedReferrers.map(([name, count]) => ({
            icon: referrerIcons[name] || '🌐',
            label: name,
            count,
          }))}
        />

        {/* Countries */}
        <FilterRow
          label="Countries"
          items={sortedCountries.map(([name, data]) => ({
            icon: data.flag,
            label: name,
            count: data.count,
          }))}
        />

        {/* Devices */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wider w-20 flex-shrink-0">
            Devices
          </span>
          <div className="flex flex-wrap gap-1.5">
            {deviceBreakdown.desktop > 0 && (
              <DeviceChip icon={<Monitor className="w-3 h-3" />} label="Desktop" count={deviceBreakdown.desktop} />
            )}
            {deviceBreakdown.mobile > 0 && (
              <DeviceChip icon={<Smartphone className="w-3 h-3" />} label="Mobile" count={deviceBreakdown.mobile} />
            )}
            {deviceBreakdown.tablet > 0 && (
              <DeviceChip icon={<Tablet className="w-3 h-3" />} label="Tablet" count={deviceBreakdown.tablet} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
      <span className="text-muted-foreground text-xs uppercase tracking-wider w-20 flex-shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item.label}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted text-xs transition-colors"
          >
            <span>{item.icon}</span>
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-semibold text-foreground">{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DeviceChip({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted text-xs transition-colors">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{count}</span>
    </button>
  );
}
