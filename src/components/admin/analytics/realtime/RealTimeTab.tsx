import { useState, useMemo } from "react";
import { useEnhancedRealTimeAnalytics } from "@/hooks/useEnhancedRealTimeAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumGlobeMap } from "./PremiumGlobeMap";
import { RealTimeSummaryPanel } from "./RealTimeSummaryPanel";
import { LiveActivityFeed } from "./LiveActivityFeed";

export function RealTimeTab() {
  const { data, isLoading, error } = useEnhancedRealTimeAnalytics();
  const [activeFilter, setActiveFilter] = useState<{ 
    type: 'country' | 'device' | 'referrer'; 
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

      {/* Premium overlay layout */}
      <div className="relative min-h-[600px] h-[70vh]">
        {/* Full-size globe */}
        <PremiumGlobeMap 
          users={filteredUsers}
          onUserClick={(user) => console.log('User clicked:', user)}
          focusedSessionId={focusedSessionId}
          className="absolute inset-0"
        />
        
        {/* Floating summary panel - top left */}
        <div className="absolute top-4 left-4 w-72 z-10">
          <RealTimeSummaryPanel 
            data={data}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        </div>
        
        {/* Floating activity feed - bottom left */}
        <div className="absolute bottom-4 left-4 w-96 max-h-72 z-10">
          <LiveActivityFeed 
            events={data.recentEvents}
            onUserClick={(sessionId) => setFocusedSessionId(sessionId)}
          />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="relative min-h-[600px] h-[70vh]">
        <Skeleton className="absolute inset-0 rounded-2xl" />
        <div className="absolute top-4 left-4 w-72 space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <div className="absolute bottom-4 left-4 w-96">
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
