import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface EnrichmentResult {
  buyerId: string;
  buyerName?: string;
  status: 'success' | 'error' | 'warning';
  error?: string;
  errorCode?: string;
  fieldsExtracted?: number;
}

export interface EnrichmentSummaryData {
  total: number;
  successful: number;
  failed: number;
  warnings: number;
  results: EnrichmentResult[];
  creditsDepleted?: boolean;
  rateLimited?: boolean;
  resetTime?: string;
}

interface EnrichmentSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: EnrichmentSummaryData;
  onRetryFailed?: () => void;
}

export const EnrichmentSummaryDialog = ({
  open,
  onOpenChange,
  summary,
  onRetryFailed
}: EnrichmentSummaryDialogProps) => {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);

  const toggleError = (buyerId: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(buyerId)) {
      newExpanded.delete(buyerId);
    } else {
      newExpanded.add(buyerId);
    }
    setExpandedErrors(newExpanded);
  };

  // Group errors by error message
  const errorGroups = summary.results
    .filter(r => r.status === 'error')
    .reduce((acc, result) => {
      const errorMsg = result.error || 'Unknown error';
      if (!acc[errorMsg]) {
        acc[errorMsg] = [];
      }
      acc[errorMsg].push(result);
      return acc;
    }, {} as Record<string, EnrichmentResult[]>);

  const warningResults = summary.results.filter(r => r.status === 'warning');
  const errorResults = summary.results.filter(r => r.status === 'error');
  const successResults = summary.results.filter(r => r.status === 'success');

  const successRate = summary.total > 0
    ? Math.round((summary.successful / summary.total) * 100)
    : 0;

  const downloadCSV = () => {
    const csvContent = [
      ['Buyer ID', 'Buyer Name', 'Status', 'Error', 'Fields Extracted'].join(','),
      ...summary.results.map(r => [
        r.buyerId,
        r.buyerName || '',
        r.status,
        r.error || '',
        r.fieldsExtracted || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrichment-results-${new Date().toISOString()}.csv`;
    a.click();
  };

  const copyErrorLog = () => {
    const errorLog = Object.entries(errorGroups)
      .map(([error, results]) => `${error} (${results.length} buyers)\n${results.map(r => `  - ${r.buyerName || r.buyerId}`).join('\n')}`)
      .join('\n\n');

    navigator.clipboard.writeText(errorLog);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {summary.successful === summary.total ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : summary.failed === summary.total ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            Enrichment Complete
          </DialogTitle>
          <DialogDescription>
            Summary of buyer enrichment results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.successful}</div>
              <div className="text-xs text-muted-foreground">Successful</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-900">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary.warnings}</div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
          </div>

          {/* Success Rate */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Success Rate</span>
            <Badge variant={successRate >= 80 ? 'default' : successRate >= 50 ? 'secondary' : 'destructive'}>
              {successRate}%
            </Badge>
          </div>

          {/* Critical Issues */}
          {(summary.creditsDepleted || summary.rateLimited) && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {summary.creditsDepleted && "AI Credits Depleted"}
                {summary.rateLimited && `Rate Limit Exceeded${summary.resetTime ? ` (resets at ${new Date(summary.resetTime).toLocaleTimeString()})` : ''}`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.creditsDepleted && "Add credits in Settings → Workspace → Usage to continue enrichment."}
                {summary.rateLimited && "Wait until rate limit resets and retry failed enrichments."}
              </p>
            </div>
          )}

          <Separator />

          {/* Error Groups (if any failures) */}
          {errorResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Errors ({errorResults.length})
                </h4>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyErrorLog}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Log
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllErrors(!showAllErrors)}
                  >
                    {showAllErrors ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Hide
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Show All
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {Object.entries(errorGroups).map(([errorMsg, results]) => (
                    <Collapsible
                      key={errorMsg}
                      open={showAllErrors || expandedErrors.has(errorMsg)}
                    >
                      <div className="border rounded-lg p-2">
                        <CollapsibleTrigger
                          className="flex items-center justify-between w-full text-left"
                          onClick={() => toggleError(errorMsg)}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-red-600 dark:text-red-400">
                              {errorMsg}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Affects {results.length} buyer{results.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="text-xs text-muted-foreground space-y-1 pl-4">
                            {results.map(r => (
                              <div key={r.buyerId}>• {r.buyerName || r.buyerId}</div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Warnings (if any) */}
          {warningResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Warnings ({warningResults.length})
              </h4>
              <div className="text-xs text-muted-foreground space-y-1">
                {warningResults.slice(0, 5).map(r => (
                  <div key={r.buyerId}>
                    • {r.buyerName || r.buyerId}: {r.error || 'No data extracted'}
                  </div>
                ))}
                {warningResults.length > 5 && (
                  <div className="text-muted-foreground italic">
                    + {warningResults.length - 5} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success summary */}
          {successResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Successfully Enriched ({successResults.length})
              </h4>
              <div className="text-xs text-muted-foreground">
                Average fields extracted: {Math.round(
                  successResults.reduce((sum, r) => sum + (r.fieldsExtracted || 0), 0) / successResults.length
                )} fields per buyer
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadCSV}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          {onRetryFailed && errorResults.length > 0 && !summary.creditsDepleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onRetryFailed();
                onOpenChange(false);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry Failed ({errorResults.length})
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            className="sm:ml-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
