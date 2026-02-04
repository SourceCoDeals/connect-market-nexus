import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, AlertTriangle, Sparkles, MapPin, Briefcase, Building2, Users } from "lucide-react";

export interface ExtractionResult {
  success: boolean;
  confidence: number;
  error?: string;
  extractedCriteria?: {
    sizeCriteria?: {
      minRevenue?: number;
      maxRevenue?: number;
      minEbitda?: number;
      maxEbitda?: number;
    };
    geographyCriteria?: {
      priorityRegions?: string[];
      acceptableRegions?: string[];
      excludedRegions?: string[];
    };
    serviceCriteria?: {
      requiredServices?: string[];
      preferredServices?: string[];
      excludedServices?: string[];
    };
    buyerTypes?: {
      enabled: string[];
      disabled: string[];
    };
  };
  warnings?: string[];
}

interface CriteriaExtractionSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ExtractionResult | null;
  universeName?: string;
}

export const CriteriaExtractionSummaryDialog = ({
  open,
  onOpenChange,
  result,
  universeName
}: CriteriaExtractionSummaryDialogProps) => {
  if (!result) return null;

  const { success, confidence, error, extractedCriteria, warnings } = result;

  // Count what was extracted
  const extractedItems = [];
  if (extractedCriteria?.sizeCriteria && Object.keys(extractedCriteria.sizeCriteria).length > 0) {
    extractedItems.push({ icon: Building2, label: 'Size Criteria', count: Object.keys(extractedCriteria.sizeCriteria).length });
  }
  if (extractedCriteria?.geographyCriteria) {
    const geoCount = (extractedCriteria.geographyCriteria.priorityRegions?.length || 0) +
                     (extractedCriteria.geographyCriteria.acceptableRegions?.length || 0) +
                     (extractedCriteria.geographyCriteria.excludedRegions?.length || 0);
    if (geoCount > 0) {
      extractedItems.push({ icon: MapPin, label: 'Geographic Regions', count: geoCount });
    }
  }
  if (extractedCriteria?.serviceCriteria) {
    const svcCount = (extractedCriteria.serviceCriteria.requiredServices?.length || 0) +
                     (extractedCriteria.serviceCriteria.preferredServices?.length || 0) +
                     (extractedCriteria.serviceCriteria.excludedServices?.length || 0);
    if (svcCount > 0) {
      extractedItems.push({ icon: Briefcase, label: 'Service Criteria', count: svcCount });
    }
  }
  if (extractedCriteria?.buyerTypes) {
    const typeCount = (extractedCriteria.buyerTypes.enabled?.length || 0);
    if (typeCount > 0) {
      extractedItems.push({ icon: Users, label: 'Buyer Types', count: typeCount });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            {success ? 'Extraction Complete' : 'Extraction Failed'}
          </DialogTitle>
          <DialogDescription>
            {universeName ? `Criteria extracted from ${universeName} M&A Guide` : 'Buyer fit criteria extraction results'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Success State */}
          {success && (
            <>
              {/* Confidence Score */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm font-medium">Confidence Score</span>
                <Badge 
                  variant={confidence >= 80 ? "default" : confidence >= 50 ? "secondary" : "outline"}
                  className={confidence >= 80 ? "bg-emerald-500" : ""}
                >
                  {confidence}%
                </Badge>
              </div>

              {/* Extracted Items */}
              {extractedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Extracted Criteria
                  </p>
                  <div className="grid gap-2">
                    {extractedItems.map((item, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <Badge variant="secondary">{item.count} items</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {extractedItems.length === 0 && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm">
                    No specific criteria could be extracted from the guide. Try enriching the guide with more detailed buyer requirements.
                  </span>
                </div>
              )}

              {/* Warnings */}
              {warnings && warnings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings ({warnings.length})
                  </p>
                  <ScrollArea className="h-[100px] rounded-lg border p-3">
                    <div className="space-y-1">
                      {warnings.map((warning, idx) => (
                        <p key={idx} className="text-xs text-amber-600 dark:text-amber-400">
                          • {warning}
                        </p>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}

          {/* Error State */}
          {!success && error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                Error Details
              </p>
              <p className="text-sm text-red-600 dark:text-red-500">
                {error}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {success ? 'Done' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CriteriaExtractionSummaryDialog;
