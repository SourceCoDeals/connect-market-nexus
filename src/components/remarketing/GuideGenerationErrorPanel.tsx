import { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  Clock, 
  XCircle, 
  CreditCard,
  Wifi,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface ErrorDetails {
  code: string;
  message: string;
  batchIndex: number;
  phaseIndex?: number;
  phaseName?: string;
  isRecoverable: boolean;
  retryAfterMs?: number;
  savedWordCount?: number;
  timestamp: number;
}

interface GuideGenerationErrorPanelProps {
  errorDetails: ErrorDetails;
  onRetry: () => void;
  onResume: () => void;
  onCancel: () => void;
  hasCheckpoint: boolean;
  totalBatches?: number;
}

const ERROR_CONFIG: Record<string, {
  icon: typeof AlertTriangle;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  rate_limited: {
    icon: Clock,
    title: "Rate Limit Reached",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
  phase_timeout: {
    icon: Clock,
    title: "Phase Timed Out",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
  function_timeout: {
    icon: AlertTriangle,
    title: "Generation Timed Out",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
  payment_required: {
    icon: CreditCard,
    title: "AI Credits Depleted",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800"
  },
  service_overloaded: {
    icon: AlertTriangle,
    title: "Service Overloaded",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
  network_error: {
    icon: Wifi,
    title: "Connection Lost",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
  unknown: {
    icon: XCircle,
    title: "Generation Failed",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800"
  }
};

const ERROR_MESSAGES: Record<string, { description: string; action: string }> = {
  rate_limited: {
    description: "The AI service received too many requests. This is temporary and your progress has been saved.",
    action: "Wait for the cooldown period to end, then resume generation."
  },
  phase_timeout: {
    description: "This phase took too long to generate. This sometimes happens with complex industries.",
    action: "Try resuming - the system will retry with optimized settings."
  },
  function_timeout: {
    description: "The generation process exceeded the time limit. Your progress has been saved automatically.",
    action: "Click Resume to continue from where it stopped."
  },
  payment_required: {
    description: "Your AI credits have been depleted. You need to add more credits to continue.",
    action: "Add credits in Settings → Workspace → Usage, then retry."
  },
  service_overloaded: {
    description: "The AI service is temporarily overloaded with requests.",
    action: "Wait a moment for the service to recover, then retry."
  },
  network_error: {
    description: "The connection was lost during generation.",
    action: "Check your internet connection and try again."
  },
  unknown: {
    description: "An unexpected error occurred during generation.",
    action: "Try again. If the problem persists, contact support."
  }
};

export function GuideGenerationErrorPanel({
  errorDetails,
  onRetry,
  onResume,
  onCancel,
  hasCheckpoint,
  totalBatches = 13
}: GuideGenerationErrorPanelProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const errorConfig = ERROR_CONFIG[errorDetails.code] || ERROR_CONFIG.unknown;
  const errorMessage = ERROR_MESSAGES[errorDetails.code] || ERROR_MESSAGES.unknown;
  const IconComponent = errorConfig.icon;

  // Handle countdown for rate-limited errors
  useEffect(() => {
    if (errorDetails.code === 'rate_limited' && errorDetails.retryAfterMs) {
      const seconds = Math.ceil(errorDetails.retryAfterMs / 1000);
      setCountdown(seconds);
      
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [errorDetails.code, errorDetails.retryAfterMs]);

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <Card className={cn(
      "overflow-hidden border-2",
      errorConfig.bgColor,
      errorConfig.borderColor
    )}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg", errorConfig.bgColor)}>
            <IconComponent className={cn("h-5 w-5", errorConfig.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn("font-semibold", errorConfig.color)}>
              {errorConfig.title}
            </h3>
            {errorDetails.phaseName && (
              <p className="text-sm text-muted-foreground mt-0.5">
                During Batch {errorDetails.batchIndex + 1}/{totalBatches}
                {errorDetails.phaseName && ` • ${errorDetails.phaseName}`}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-foreground/80">
          {errorMessage.description}
        </p>

        {/* Progress saved indicator */}
        {hasCheckpoint && errorDetails.savedWordCount && errorDetails.savedWordCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-background/60 border border-border/50">
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Progress Saved
            </Badge>
            <span className="text-sm text-muted-foreground">
              {errorDetails.savedWordCount.toLocaleString()} words
              {errorDetails.batchIndex > 0 && ` (Batches 1-${errorDetails.batchIndex} complete)`}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {hasCheckpoint && (
            <Button 
              onClick={onResume}
              className="gap-2"
              disabled={countdown !== null && countdown > 0}
            >
              <RefreshCw className="h-4 w-4" />
              {countdown !== null && countdown > 0 
                ? `Resume in ${formatCountdown(countdown)}`
                : 'Resume Generation'
              }
            </Button>
          )}
          
          <Button 
            variant={hasCheckpoint ? "outline" : "default"}
            onClick={onRetry}
            disabled={countdown !== null && countdown > 0}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {countdown !== null && countdown > 0 
              ? `Retry in ${formatCountdown(countdown)}`
              : 'Retry Now'
            }
          </Button>
          
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>

          {errorDetails.code === 'payment_required' && (
            <Button 
              variant="outline" 
              className="gap-2 ml-auto"
              onClick={() => window.open('https://lovable.dev/settings', '_blank')}
            >
              <CreditCard className="h-4 w-4" />
              Add Credits
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Technical details (collapsible) */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start">
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Technical Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 rounded-lg bg-muted/50 text-sm font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Error code:</span>
                <span>{errorDetails.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batch:</span>
                <span>{errorDetails.batchIndex + 1} of {totalBatches}</span>
              </div>
              {errorDetails.phaseName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phase:</span>
                  <span>{errorDetails.phaseName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timestamp:</span>
                <span>{formatTimestamp(errorDetails.timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recoverable:</span>
                <span>{errorDetails.isRecoverable ? 'Yes' : 'No'}</span>
              </div>
              {errorDetails.message && (
                <div className="pt-2 border-t border-border/50">
                  <span className="text-muted-foreground block mb-1">Message:</span>
                  <span className="break-words">{errorDetails.message}</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
