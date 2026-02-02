import { useState, useMemo } from "react";
import { useEnhancedRealTimeAnalytics } from "@/hooks/useEnhancedRealTimeAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { MapboxGlobeMap } from "./MapboxGlobeMap";
import { PremiumGlobeMap } from "./PremiumGlobeMap";
import { LiveActivityFeed } from "./LiveActivityFeed";
import { countryCodeToFlag } from "@/lib/flagEmoji";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

export function RealTimeTab() {
  const { data, isLoading, error } = useEnhancedRealTimeAnalytics();
  const [activeFilter, setActiveFilter] = useState<{ 
    type: 'country' | 'device' | 'referrer' | 'entrySource'; 
    value: string 
  } | null>(null);
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);

  // Filter users based on active filter
  const filteredUsers = useMemo(() => {
    if (!data?.activeUsers) return [];
    if (!activeFilter) return data.activeUsers;

    return data.activeUsers.filter(user => {
      switch (activeFilter.type) {
        case 'country':
          return user.country === activeFilter.value;
        case 'device':
          return user.deviceType === activeFilter.value;
        case 'referrer':
          const referrer = user.referrer || user.utmSource || 'Direct';
          const normalized = referrer.includes('google') ? 'Google' :
            referrer.includes('facebook') ? 'Facebook' :
            referrer.includes('linkedin') ? 'LinkedIn' :
            referrer === 'Direct' ? 'Direct' : 'Other';
          return normalized === activeFilter.value;
        case 'entrySource':
          return user.entrySource === activeFilter.value;
        default:
          return true;
      }
    });
  }, [data?.activeUsers, activeFilter]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load real-time data</p>
      </div>
    );
  }

  // Check if Mapbox token is available
  const hasMapboxToken = !!import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

  return (
    <div className="space-y-0">
      {/* Stats bar - above the globe (only shown when NOT using Mapbox, since Mapbox has its own panel) */}
      {!hasMapboxToken && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 rounded-t-2xl bg-black/30 backdrop-blur-xl border border-white/10 border-b-0">
            <div className="flex items-center gap-6">
              {/* Live indicator + count */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-coral-500"></span>
                </span>
                <span className="text-white text-sm font-medium tabular-nums">
                  {data.totalActiveUsers} visitor{data.totalActiveUsers !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Top countries as filter chips */}
              <div className="hidden sm:flex items-center gap-2">
                {data.byCountry.slice(0, 4).map(({ country, countryCode, count }) => (
                  <FilterChip
                    key={country}
                    label={`${countryCodeToFlag(countryCode)} ${country}`}
                    count={count}
                    isActive={activeFilter?.type === 'country' && activeFilter.value === country}
                    onClick={() => {
                      if (activeFilter?.type === 'country' && activeFilter.value === country) {
                        setActiveFilter(null);
                      } else {
                        setActiveFilter({ type: 'country', value: country });
                      }
                    }}
                  />
                ))}
              </div>

              {/* Device breakdown */}
              <div className="hidden md:flex items-center gap-2">
                {data.byDevice.map(({ device, count }) => (
                  <FilterChip
                    key={device}
                    label={<DeviceLabel type={device} />}
                    count={count}
                    isActive={activeFilter?.type === 'device' && activeFilter.value === device}
                    onClick={() => {
                      if (activeFilter?.type === 'device' && activeFilter.value === device) {
                        setActiveFilter(null);
                      } else {
                        setActiveFilter({ type: 'device', value: device });
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            <span className="text-[10px] text-white/50 uppercase tracking-wider">
              Updated just now
            </span>
          </div>

          {/* Filter banner when active */}
          {activeFilter && (
            <div className="flex items-center justify-between px-5 py-2 bg-coral-500/10 border-x border-coral-500/20">
              <span className="text-xs text-coral-400">
                Showing {filteredUsers.length} users filtered by {activeFilter.type}: <strong>{activeFilter.value}</strong>
              </span>
              <button 
                onClick={() => setActiveFilter(null)}
                className="text-[10px] text-coral-400 hover:underline uppercase tracking-wider font-medium"
              >
                Clear filter
              </button>
            </div>
          )}
        </>
      )}

      {/* Globe container - full height */}
      <div 
        className={cn(
          "relative",
          hasMapboxToken ? "rounded-2xl overflow-hidden" : ""
        )} 
        style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
      >
        {hasMapboxToken ? (
          <MapboxGlobeMap 
            users={filteredUsers}
            events={data.recentEvents}
            onUserClick={(user) => console.log('User clicked:', user)}
            focusedSessionId={focusedSessionId}
            className="absolute inset-0"
          />
        ) : (
          <PremiumGlobeMap 
            users={filteredUsers}
            onUserClick={(user) => console.log('User clicked:', user)}
            focusedSessionId={focusedSessionId}
            className="absolute inset-0 rounded-none border-x border-white/10"
          />
        )}
      </div>
      
      {/* Activity feed - below the globe (only when NOT using Mapbox) */}
      {!hasMapboxToken && (
        <div className="rounded-b-2xl overflow-hidden border border-white/10 border-t-0">
          <LiveActivityFeed 
            events={data.recentEvents}
            onUserClick={(sessionId) => setFocusedSessionId(sessionId)}
          />
        </div>
      )}
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
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-colors",
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

function DeviceLabel({ type }: { type: string }) {
  const Icon = type === 'mobile' ? Smartphone : type === 'tablet' ? Tablet : Monitor;
  return (
    <span className="flex items-center gap-1">
      <Icon className="w-3 h-3" />
      <span className="capitalize">{type}</span>
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-0">
      <Skeleton className="h-12 rounded-t-2xl rounded-b-none" />
      <Skeleton className="h-[550px] rounded-none" />
      <Skeleton className="h-48 rounded-b-2xl rounded-t-none" />
    </div>
  );
}
