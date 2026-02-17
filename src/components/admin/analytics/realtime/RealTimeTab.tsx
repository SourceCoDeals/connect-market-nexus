import { useState, useMemo } from "react";
import { useEnhancedRealTimeAnalytics } from "@/hooks/useEnhancedRealTimeAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { MapboxGlobeMap } from "./MapboxGlobeMap";

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
        case 'referrer': {
          const referrer = user.referrer || user.utmSource || 'Direct';
          const normalized = referrer.includes('google') ? 'Google' :
            referrer.includes('facebook') ? 'Facebook' :
            referrer.includes('linkedin') ? 'LinkedIn' :
            referrer === 'Direct' ? 'Direct' : 'Other';
          return normalized === activeFilter.value;
        }
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

  // Always try Mapbox first - the component handles fallback internally
  const useMapbox = true;

  return (
    <div className="space-y-0">
      {/* Globe container - full height with Mapbox */}
      <div 
        className="relative rounded-2xl overflow-hidden"
        style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
      >
        <MapboxGlobeMap 
          users={filteredUsers}
          events={data.recentEvents}
          onUserClick={(user) => console.log('User clicked:', user)}
          focusedSessionId={focusedSessionId}
          className="absolute inset-0"
        />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-0">
      <div className="h-[600px] rounded-2xl bg-muted/50 animate-pulse" />
    </div>
  );
}
