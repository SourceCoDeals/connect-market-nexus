import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";

interface SessionData {
  trackerId: string;
  operation: string;
  progress: number;
  total: number;
  timestamp: number;
}

interface InterruptedSessionBannerProps {
  trackerId: string;
}

export function InterruptedSessionBanner({ trackerId }: InterruptedSessionBannerProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check for interrupted sessions in localStorage
    const storageKey = `ma-intelligence-session-${trackerId}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const data: SessionData = JSON.parse(stored);

        // Only show if session is less than 24 hours old
        const hoursSinceLastUpdate = (Date.now() - data.timestamp) / (1000 * 60 * 60);
        if (hoursSinceLastUpdate < 24) {
          setSession(data);
        } else {
          // Clean up old session
          localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.error("Error parsing session data:", error);
        localStorage.removeItem(storageKey);
      }
    }
  }, [trackerId]);

  const handleResume = () => {
    // Resume the interrupted operation
    // This would trigger the appropriate enrichment/scoring operation
    console.log("Resuming session:", session);
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (session) {
      const storageKey = `ma-intelligence-session-${trackerId}`;
      localStorage.removeItem(storageKey);
    }
  };

  if (!session || isDismissed) {
    return null;
  }

  const progressPercent = Math.round((session.progress / session.total) * 100);

  return (
    <Alert variant="default" className="border-blue-500 bg-blue-50">
      <AlertCircle className="h-4 w-4 text-blue-500" />
      <AlertTitle className="flex items-center justify-between">
        <span>Interrupted {session.operation}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          <p className="text-sm">
            Your {session.operation.toLowerCase()} was interrupted at {progressPercent}%
            ({session.progress} of {session.total} completed).
          </p>
          <Button onClick={handleResume} variant="outline" size="sm">
            Resume Operation
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

// Helper function to save session state
export function saveSessionState(
  trackerId: string,
  operation: string,
  progress: number,
  total: number
) {
  const storageKey = `ma-intelligence-session-${trackerId}`;
  const data: SessionData = {
    trackerId,
    operation,
    progress,
    total,
    timestamp: Date.now(),
  };

  localStorage.setItem(storageKey, JSON.stringify(data));
}

// Helper function to clear session state
export function clearSessionState(trackerId: string) {
  const storageKey = `ma-intelligence-session-${trackerId}`;
  localStorage.removeItem(storageKey);
}
