import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, AlertTriangle, Sparkles } from "lucide-react";
import type { EnrichmentSummary } from "@/hooks/useBuyerEnrichmentQueue";

interface EnrichmentSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: EnrichmentSummary | null;
  onRetryFailed?: () => void;
}

export const EnrichmentSummaryDialog = ({
  open,
  onOpenChange,
  summary,
  onRetryFailed
}: EnrichmentSummaryDialogProps) => {
  if (!summary) return null;

  const successRate = summary.total > 0 
    ? Math.round((summary.successful / summary.total) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Enrichment Complete
          </DialogTitle>
          <DialogDescription>
            Completed at {new Date(summary.completedAt).toLocaleTimeString()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted">
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <div className="text-2xl font-bold text-emerald-600 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-5 w-5" />
                {summary.successful}
              </div>
              <div className="text-xs text-muted-foreground">Successful</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
              <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                <XCircle className="h-5 w-5" />
                {summary.failed}
              </div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>

          {/* Success Rate */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <span className="text-sm font-medium">Success Rate</span>
            <Badge 
              variant={successRate >= 80 ? "default" : successRate >= 50 ? "secondary" : "destructive"}
            >
              {successRate}%
            </Badge>
          </div>

          {/* Error Details */}
          {summary.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Failed Items ({summary.errors.length})
              </div>
              <ScrollArea className="h-[200px] rounded-lg border p-3">
                <div className="space-y-2">
                  {summary.errors.map((err, idx) => (
                    <div 
                      key={idx} 
                      className="text-sm p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
                    >
                      <div className="font-medium text-red-700 dark:text-red-400 truncate">
                        {err.buyerName || `Buyer ${err.buyerId.slice(0, 8)}...`}
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-500 mt-1 line-clamp-2">
                        {err.error}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* All Successful Message */}
          {summary.errors.length === 0 && summary.successful > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">
                All {summary.successful} buyers were enriched successfully!
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {summary.failed > 0 && onRetryFailed && (
            <Button variant="outline" onClick={onRetryFailed}>
              Retry Failed ({summary.failed})
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EnrichmentSummaryDialog;
