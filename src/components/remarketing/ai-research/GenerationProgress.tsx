import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";
import type { GenerationProgressProps, QualityResultPanelProps, GapFillProgressProps } from "./types";

export function GenerationProgress({
  state,
  currentBatch,
  totalBatches,
  currentPhase,
  totalPhases,
  phaseName,
  wordCount,
  progressPercent,
  onCancel,
}: GenerationProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state === 'generating' && (
            <span>
              Batch {currentBatch + 1}/{totalBatches} &bull; Phase {currentPhase}/{totalPhases}: {phaseName}
            </span>
          )}
          {state === 'quality_check' && 'Running quality check...'}
          {state === 'gap_filling' && 'Filling content gaps...'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{wordCount.toLocaleString()} words</span>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <div className="text-xs text-muted-foreground text-center">
        Auto-batching: 1 phase per batch for maximum reliability ({totalBatches} total batches)
      </div>
    </div>
  );
}

export function QualityResultPanel({ qualityResult }: QualityResultPanelProps) {
  return (
    <div className={`p-3 rounded-lg border ${qualityResult.passed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {qualityResult.passed ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          )}
          <span className="font-medium">
            Quality Score: {qualityResult.score}/100
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline">{qualityResult.wordCount.toLocaleString()} words</Badge>
          <Badge variant="outline">{qualityResult.tableCount} tables</Badge>
          {qualityResult.hasPrimaryFocus ? (
            <Badge variant="default" className="bg-green-600">Primary Focus &#10003;</Badge>
          ) : (
            <Badge variant="destructive">Missing Primary Focus</Badge>
          )}
        </div>
      </div>
      {qualityResult.missingElements.length > 0 && (
        <div className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium">Needs improvement:</span> {qualityResult.missingElements.join(', ')}
        </div>
      )}
    </div>
  );
}

export function GapFillProgress({ state, missingElements }: GapFillProgressProps) {
  if (state !== 'gap_filling' || missingElements.length === 0) return null;

  return (
    <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
        <span className="font-medium">Generating additional content for:</span>
      </div>
      <ul className="text-sm text-muted-foreground list-disc list-inside">
        {missingElements.map((elem) => (
          <li key={elem}>{elem}</li>
        ))}
      </ul>
    </div>
  );
}
