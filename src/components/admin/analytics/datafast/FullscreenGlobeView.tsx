import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useEnhancedRealTimeAnalytics } from "@/hooks/useEnhancedRealTimeAnalytics";
import { MapboxGlobeMap } from "../realtime/MapboxGlobeMap";
import { Skeleton } from "@/components/ui/skeleton";

interface FullscreenGlobeViewProps {
  onClose: () => void;
}

export function FullscreenGlobeView({ onClose }: FullscreenGlobeViewProps) {
  const { data, isLoading, error } = useEnhancedRealTimeAnalytics();
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);

  const users = useMemo(() => data?.activeUsers || [], [data?.activeUsers]);
  const events = useMemo(() => data?.recentEvents || [], [data?.recentEvents]);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-[#0a0a1a]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Close button - top right corner like datafast */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-[10000] w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center hover:bg-white/20 transition-all hover:scale-105"
        title="Close (ESC)"
      >
        <X className="h-5 w-5 text-white" />
      </button>

      {/* Globe fills entire screen */}
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white/60 text-lg">Loading globe...</div>
        </div>
      ) : error ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white/60 text-lg">Unable to load real-time data</div>
        </div>
      ) : (
        <MapboxGlobeMap 
          users={users}
          events={events}
          onUserClick={(user) => setFocusedSessionId(user.sessionId)}
          focusedSessionId={focusedSessionId}
          className="w-full h-full"
        />
      )}

      {/* ESC hint - bottom right */}
      <div className="absolute bottom-6 right-6 z-[10000] px-3 py-1.5 rounded-md bg-white/10 backdrop-blur-md border border-white/20 text-white/60 text-xs font-medium">
        Press ESC to close
      </div>
    </div>
  );
}
