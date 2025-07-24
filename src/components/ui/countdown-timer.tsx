import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  className?: string;
  variant?: "default" | "compact";
}

export function CountdownTimer({ 
  seconds, 
  onComplete, 
  className,
  variant = "default" 
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const remainingSeconds = time % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  if (variant === "compact") {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        ({formatTime(timeLeft)})
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Clock className="h-4 w-4" />
      <span>Please wait {formatTime(timeLeft)} before requesting another email</span>
    </div>
  );
}