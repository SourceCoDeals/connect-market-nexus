import { useState, useEffect, useCallback } from "react";
import { Globe, X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { FullscreenGlobeView } from "./FullscreenGlobeView";

export function FloatingGlobeToggle() {
  const [isGlobeOpen, setIsGlobeOpen] = useState(false);

  // ESC key to close fullscreen globe
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isGlobeOpen) {
      setIsGlobeOpen(false);
    }
  }, [isGlobeOpen]);

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
      {/* Floating Buttons */}
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
          onClick={() => setIsGlobeOpen(!isGlobeOpen)}
          className={cn(
            "w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105",
            isGlobeOpen 
              ? "bg-[hsl(12_95%_77%)] text-white hover:bg-[hsl(12_95%_70%)]"
              : "bg-card hover:bg-muted border border-border/50"
          )}
          title={isGlobeOpen ? "Close Globe" : "Open Real-Time Globe"}
        >
          {isGlobeOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Globe className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Fullscreen Globe Overlay */}
      {isGlobeOpen && (
        <FullscreenGlobeView onClose={() => setIsGlobeOpen(false)} />
      )}
    </>
  );
}
