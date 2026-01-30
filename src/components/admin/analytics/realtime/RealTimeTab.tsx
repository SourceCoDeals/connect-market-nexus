import { useState, useMemo } from "react";
import { useEnhancedRealTimeAnalytics } from "@/hooks/useEnhancedRealTimeAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumGlobeMap } from "./PremiumGlobeMap";
import { RealTimeSummaryPanel } from "./RealTimeSummaryPanel";
import { LiveActivityFeed } from "./LiveActivityFeed";
import { ActiveSessionsList } from "./ActiveSessionsList";
import { cn } from "@/lib/utils";

export function RealTimeTab() {
  const { data, isLoading, error } = useEnhancedRealTimeAnalytics();
  const [activeFilter, setActiveFilter] = useState<{ 
    type: 'country' | 'device' | 'referrer'; 
    value: string 
  } | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Filter banner when active */}
      {activeFilter && (
        <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-coral-500/10 border border-coral-500/20">
          <span className="text-sm text-coral-500">
            Showing {filteredUsers.length} users filtered by {activeFilter.type}: <strong>{activeFilter.value}</strong>
          </span>
          <button 
            onClick={() => setActiveFilter(null)}
            className="text-xs text-coral-500 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Main layout: Map + Summary panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Globe Map - 3 columns */}
        <div className="lg:col-span-3">
          <PremiumGlobeMap 
            users={filteredUsers}
            onUserClick={(user) => console.log('User clicked:', user)}
          />
        </div>

        {/* Summary Panel - 1 column */}
        <div className="lg:col-span-1">
          <RealTimeSummaryPanel 
            data={data}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        </div>
      </div>

      {/* Bottom row: Activity Feed + Session List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Activity Feed */}
        <LiveActivityFeed 
          events={data.recentEvents}
          onUserClick={(sessionId) => console.log('Filter to user:', sessionId)}
        />

        {/* Active Sessions List */}
        <ActiveSessionsList 
          sessions={data.activeUsers.slice(0, 10).map(u => ({
            sessionId: u.sessionId,
            userId: u.userId,
            country: u.country,
            city: u.city,
            lastActiveAt: u.lastActiveAt,
            durationSeconds: u.sessionDurationSeconds,
          }))} 
        />
      </div>

      {/* Duration distribution card */}
      <DurationDistributionCard users={data.activeUsers} />
    </div>
  );
}

function DurationDistributionCard({ users }: { 
  users: Array<{ sessionDurationSeconds: number }> 
}) {
  // Calculate distribution
  const distribution = {
    under1min: 0,
    oneToFive: 0,
    fiveToFifteen: 0,
    over15min: 0,
  };

  users.forEach(u => {
    const duration = u.sessionDurationSeconds || 0;
    if (duration < 60) distribution.under1min++;
    else if (duration < 300) distribution.oneToFive++;
    else if (duration < 900) distribution.fiveToFifteen++;
    else distribution.over15min++;
  });

  const total = users.length;
  
  const bars = [
    { label: '< 1 min', value: distribution.under1min, color: 'bg-coral-200' },
    { label: '1-5 min', value: distribution.oneToFive, color: 'bg-coral-300' },
    { label: '5-15 min', value: distribution.fiveToFifteen, color: 'bg-coral-400' },
    { label: '15+ min', value: distribution.over15min, color: 'bg-coral-500' },
  ];

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Session Duration Distribution
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Active sessions by time spent
        </p>
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        {bars.map(bar => (
          <div key={bar.label} className="text-center">
            <div className="h-24 flex items-end justify-center mb-2">
              <div 
                className={cn("w-12 rounded-t-lg transition-all", bar.color)}
                style={{ height: `${total > 0 ? Math.max((bar.value / total) * 100, 8) : 8}%` }}
              />
            </div>
            <p className="text-lg font-semibold tabular-nums">{bar.value}</p>
            <p className="text-[10px] text-muted-foreground">{bar.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Skeleton className="h-[400px] rounded-2xl lg:col-span-3" />
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px] rounded-2xl" />
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    </div>
  );
}
