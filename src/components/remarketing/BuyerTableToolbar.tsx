import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus, 
  Upload, 
  Sparkles, 
  GitMerge,
  Loader2,
  X,
  AlertCircle
} from "lucide-react";

interface EnrichmentProgress {
  current: number;
  total: number;
  successful?: number;
  failed?: number;
  creditsDepleted?: boolean;
}

interface BuyerTableToolbarProps {
  buyerCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddBuyer?: () => void;
  onImportCSV?: () => void;
  onEnrichAll?: () => void;
  onDedupe?: () => void;
  onCancelEnrichment?: () => void;
  isEnriching?: boolean;
  isDeduping?: boolean;
  selectedCount?: number;
  enrichmentProgress?: EnrichmentProgress;
  className?: string;
}

export const BuyerTableToolbar = ({
  buyerCount,
  searchValue,
  onSearchChange,
  onAddBuyer,
  onImportCSV,
  onEnrichAll,
  onDedupe,
  onCancelEnrichment,
  isEnriching = false,
  isDeduping = false,
  selectedCount = 0,
  enrichmentProgress,
  className = ""
}: BuyerTableToolbarProps) => {
  const showProgress = isEnriching && enrichmentProgress && enrichmentProgress.total > 0;
  const progressPercent = showProgress 
    ? (enrichmentProgress.current / enrichmentProgress.total) * 100 
    : 0;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search buyers..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {buyerCount} buyer{buyerCount !== 1 ? 's' : ''}
            {selectedCount > 0 && (
              <span className="ml-1 text-primary font-medium">
                · {selectedCount} selected
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onAddBuyer && (
            <Button onClick={onAddBuyer} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Buyer
            </Button>
          )}
          {onImportCSV && (
            <Button variant="outline" size="sm" onClick={onImportCSV}>
              <Upload className="h-4 w-4 mr-1" />
              Import CSV
            </Button>
          )}
          {onEnrichAll && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onEnrichAll}
              disabled={isEnriching}
            >
              {isEnriching ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Enrich All
            </Button>
          )}
          {isEnriching && onCancelEnrichment && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancelEnrichment}
              className="text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
          {onDedupe && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onDedupe}
              disabled={isDeduping}
            >
              {isDeduping ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <GitMerge className="h-4 w-4 mr-1" />
              )}
              Dedupe
            </Button>
          )}
        </div>
      </div>

      {/* Enrichment Progress Bar */}
      {showProgress && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>
                Enriching buyers... {enrichmentProgress.current} of {enrichmentProgress.total}
              </span>
              {enrichmentProgress.successful !== undefined && (
                <span className="text-muted-foreground">
                  {enrichmentProgress.successful} successful
                  {enrichmentProgress.failed ? `, ${enrichmentProgress.failed} failed` : ''}
                </span>
              )}
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
          {enrichmentProgress.creditsDepleted && (
            <Badge variant="destructive" className="gap-1 shrink-0">
              <AlertCircle className="h-3 w-3" />
              Credits Depleted
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default BuyerTableToolbar;
