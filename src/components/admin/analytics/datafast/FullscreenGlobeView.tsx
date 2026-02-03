import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEnhancedRealTimeAnalytics } from "@/hooks/useEnhancedRealTimeAnalytics";
import { MapboxGlobeMap } from "../realtime/MapboxGlobeMap";

interface FullscreenGlobeViewProps {
  onClose: () => void;
}

export function FullscreenGlobeView({ onClose }: FullscreenGlobeViewProps) {
  const { data, isLoading, error } = useEnhancedRealTimeAnalytics();
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);

  const users = useMemo(() => data?.activeUsers || [], [data?.activeUsers]);
  const events = useMemo(() => data?.recentEvents || [], [data?.recentEvents]);

  // Use React Portal to render directly to document.body
  // This escapes all parent container constraints (AdminLayout, sticky headers, etc.)
  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] bg-[#0a0a1a] overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
      }}
    >
      {/* Close button - top right corner */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-[100000] w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center hover:bg-white/20 transition-all hover:scale-105"
        title="Close (ESC)"
      >
        <X className="h-5 w-5 text-white" />
      </button>

      {/* Globe fills entire screen */}
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-white/60 text-lg">Loading globe...</div>
          </div>
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
      <div className="absolute bottom-6 right-6 z-[100000] px-3 py-1.5 rounded-md bg-white/10 backdrop-blur-md border border-white/20 text-white/60 text-xs font-medium">
        Press ESC to close
      </div>
    </div>,
    document.body
  );
}
