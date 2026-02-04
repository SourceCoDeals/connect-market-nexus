import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Zap,
  FileText,
  Timer,
  Layers
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GenerationOutcome = 'success' | 'timeout' | 'error' | 'cancelled' | 'rate_limited';

export interface GenerationSummary {
  outcome: GenerationOutcome;
  startTime: number;
  endTime: number;
  batchesCompleted: number;
  totalBatches: number;
  phasesCompleted?: number;
  totalPhases?: number;
  wordCount: number;
  errorMessage?: string;
  isRecoverable?: boolean;
}

interface GenerationSummaryPanelProps {
  summary: GenerationSummary;
  onResume?: () => void;
  onDismiss: () => void;
  hasCheckpoint?: boolean;
}

const OUTCOME_CONFIG: Record<GenerationOutcome, {
  icon: typeof CheckCircle2;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  success: {
    icon: CheckCircle2,
    title: "Generation Complete",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800"
  },
  timeout: {
    icon: Clock,
    title: "Generation Timed Out",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
  rate_limited: {
    icon: Zap,
    title: "Rate Limit Reached",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
  error: {
    icon: XCircle,
    title: "Generation Failed",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800"
  },
  cancelled: {
    icon: AlertTriangle,
    title: "Generation Cancelled",
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    borderColor: "border-border"
  }
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

export function GenerationSummaryPanel({
  summary,
  onResume,
  onDismiss,
  hasCheckpoint = false
}: GenerationSummaryPanelProps) {
  const config = OUTCOME_CONFIG[summary.outcome];
  const IconComponent = config.icon;
  const duration = summary.endTime - summary.startTime;
  const progressPercent = summary.totalBatches > 0 
    ? Math.round((summary.batchesCompleted / summary.totalBatches) * 100)
    : 0;

  return (
    <Card className={cn(
      "overflow-hidden border-2",
      config.bgColor,
      config.borderColor
    )}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg", config.bgColor)}>
            <IconComponent className={cn("h-5 w-5", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn("font-semibold", config.color)}>
              {config.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {summary.outcome === 'success' 
                ? 'Your M&A Research Guide is ready'
                : summary.outcome === 'timeout'
                ? 'The generation hit the platform time limit'
                : summary.outcome === 'rate_limited'
                ? 'AI service rate limit was reached'
                : summary.outcome === 'cancelled'
                ? 'Generation was stopped by user'
                : 'An error occurred during generation'
              }
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border/50">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium text-sm">{formatDuration(duration)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border/50">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Batches</p>
              <p className="font-medium text-sm">{summary.batchesCompleted}/{summary.totalBatches}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border/50">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Words</p>
              <p className="font-medium text-sm">{summary.wordCount.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border/50">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="font-medium text-sm">{progressPercent}%</p>
            </div>
          </div>
        </div>

        {/* Recoverable indicator */}
        {summary.outcome !== 'success' && summary.outcome !== 'cancelled' && summary.isRecoverable && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-background/60 border border-border/50">
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Progress Saved
            </Badge>
            <span className="text-sm text-muted-foreground">
              {summary.wordCount.toLocaleString()} words saved
              {summary.batchesCompleted > 0 && ` • Batches 1-${summary.batchesCompleted} complete`}
            </span>
          </div>
        )}

        {/* Error message */}
        {summary.errorMessage && summary.outcome !== 'success' && (
          <p className="text-sm text-muted-foreground bg-background/40 p-2 rounded border border-border/50">
            {summary.errorMessage}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {summary.outcome !== 'success' && summary.isRecoverable && hasCheckpoint && onResume && (
            <Button onClick={onResume} size="sm">
              Resume Generation
            </Button>
          )}
          <Button 
            variant={summary.outcome === 'success' ? "default" : "outline"} 
            size="sm" 
            onClick={onDismiss}
          >
            {summary.outcome === 'success' ? 'Got it' : 'Dismiss'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
