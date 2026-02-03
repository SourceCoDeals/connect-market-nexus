import { useState, useEffect, useCallback } from "react";
import { Globe, X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { FullscreenGlobeView } from "./FullscreenGlobeView";

const GLOBE_STORAGE_KEY = 'globe-visible-default';

export function FloatingGlobeToggle() {
  // Initialize state from localStorage - default to TRUE on first visit
  const [isGlobeOpen, setIsGlobeOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(GLOBE_STORAGE_KEY);
    // First visit (null) = show globe, otherwise parse stored value
    return stored === null ? true : stored === 'true';
  });

  // Handle toggle with localStorage persistence
  const handleToggle = useCallback((open: boolean) => {
    setIsGlobeOpen(open);
    localStorage.setItem(GLOBE_STORAGE_KEY, String(open));
  }, []);

  // ESC key to close fullscreen globe
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isGlobeOpen) {
      handleToggle(false);
    }
  }, [isGlobeOpen, handleToggle]);

  useEffect(() => {
    if (isGlobeOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when fullscreen is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isGlobeOpen, handleKeyDown]);

  return (
    <>
      {/* Floating Buttons - only show when globe is closed */}
      {!isGlobeOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-row gap-3 z-40">
          {/* Lightbulb - future AI insights */}
          <button
            className="w-12 h-12 rounded-full bg-muted hover:bg-muted/80 border border-border/50 shadow-lg flex items-center justify-center transition-all hover:scale-105"
            title="AI Insights (coming soon)"
          >
            <Lightbulb className="h-5 w-5 text-muted-foreground" />
          </button>
          
          {/* Globe Toggle */}
          <button
            onClick={() => handleToggle(true)}
            className="w-12 h-12 rounded-full bg-card hover:bg-muted border border-border/50 shadow-lg flex items-center justify-center transition-all hover:scale-105"
            title="Open Real-Time Globe"
          >
            <Globe className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Fullscreen Globe Overlay */}
      {isGlobeOpen && (
        <FullscreenGlobeView onClose={() => handleToggle(false)} />
      )}
    </>
  );
}
