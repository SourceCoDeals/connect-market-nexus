import { useState } from "react";
import { Globe, X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { RealTimeTab } from "../realtime/RealTimeTab";

export function FloatingGlobeToggle() {
  const [isGlobeOpen, setIsGlobeOpen] = useState(false);

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
        <div className="fixed inset-0 z-50 bg-background">
          {/* Close button in corner */}
          <button
            onClick={() => setIsGlobeOpen(false)}
            className="absolute top-4 right-4 z-[60] w-10 h-10 rounded-full bg-card/90 backdrop-blur border border-border/50 shadow-lg flex items-center justify-center hover:bg-card transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          {/* Globe Content */}
          <div className="h-full w-full">
            <RealTimeTab />
          </div>
        </div>
      )}
    </>
  );
}
