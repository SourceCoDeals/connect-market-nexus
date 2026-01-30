import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

interface ActiveUsersCounterProps {
  count: number;
}

export function ActiveUsersCounter({ count }: ActiveUsersCounterProps) {
  const [displayCount, setDisplayCount] = useState(count);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (displayCount !== count) {
      setIsAnimating(true);
      
      // Animate the count change
      const steps = 10;
      const increment = (count - displayCount) / steps;
      let currentStep = 0;
      
      const timer = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setDisplayCount(count);
          setIsAnimating(false);
          clearInterval(timer);
        } else {
          setDisplayCount(prev => Math.round(prev + increment));
        }
      }, 30);
      
      return () => clearInterval(timer);
    }
  }, [count, displayCount]);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-coral-500/10 to-peach-500/10 border border-coral-500/30 p-5 relative overflow-hidden">
      {/* Pulse indicator */}
      <div className="absolute top-4 right-4">
        <div className="relative">
          <Activity className={cn(
            "h-4 w-4 text-coral-500 transition-transform",
            isAnimating && "scale-110"
          )} />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>
      
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-coral-500/80">
        Active Right Now
      </p>
      <p className={cn(
        "text-4xl md:text-5xl font-light tracking-tight text-coral-500 mt-2 tabular-nums transition-transform",
        isAnimating && "scale-105"
      )}>
        {displayCount}
      </p>
      <p className="text-[10px] text-muted-foreground mt-2">
        Users with activity in the last 2 minutes
      </p>
    </div>
  );
}
