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
  Loader2,
  X,
  AlertCircle,
  Target
} from "lucide-react";

interface EnrichmentProgress {
  current: number;
  total: number;
  successful?: number;
  failed?: number;
  creditsDepleted?: boolean;
  rateLimited?: boolean;
  resetTime?: string;
}

interface AlignmentProgress {
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
  onCancelEnrichment?: () => void;
  onScoreAlignment?: () => void;
  onCancelAlignment?: () => void;
  isEnriching?: boolean;
  isScoringAlignment?: boolean;
  selectedCount?: number;
  enrichmentProgress?: EnrichmentProgress;
  alignmentProgress?: AlignmentProgress;
  className?: string;
}

export const BuyerTableToolbar = ({
  buyerCount,
  searchValue,
  onSearchChange,
  onAddBuyer,
  onImportCSV,
  onEnrichAll,
  onCancelEnrichment,
  onScoreAlignment,
  onCancelAlignment,
  isEnriching = false,
  isScoringAlignment = false,
  selectedCount = 0,
  enrichmentProgress,
  alignmentProgress,
  className = ""
}: BuyerTableToolbarProps) => {
  const showEnrichProgress = isEnriching && enrichmentProgress && enrichmentProgress.total > 0;
  const enrichProgressPercent = showEnrichProgress 
    ? (enrichmentProgress.current / enrichmentProgress.total) * 100 
    : 0;

  const showAlignmentProgress = isScoringAlignment && alignmentProgress && alignmentProgress.total > 0;
  const alignmentProgressPercent = showAlignmentProgress 
    ? (alignmentProgress.current / alignmentProgress.total) * 100 
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
              disabled={isEnriching || isScoringAlignment}
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
          {onScoreAlignment && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onScoreAlignment}
              disabled={isScoringAlignment || isEnriching}
            >
              {isScoringAlignment ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Target className="h-4 w-4 mr-1" />
              )}
              {isScoringAlignment && alignmentProgress 
                ? `Scoring... ${alignmentProgress.current}/${alignmentProgress.total}`
                : "Score Alignment"
              }
            </Button>
          )}
          {isScoringAlignment && onCancelAlignment && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancelAlignment}
              className="text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Enrichment Progress Bar */}
      {showEnrichProgress && (
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
            <Progress value={enrichProgressPercent} className="h-2" />
          </div>
          {enrichmentProgress.creditsDepleted && (
            <Badge variant="destructive" className="gap-1 shrink-0">
              <AlertCircle className="h-3 w-3" />
              Credits Depleted
            </Badge>
          )}
          {enrichmentProgress.rateLimited && (
            <Badge variant="outline" className="gap-1 shrink-0 border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-3 w-3" />
              Rate Limited
              {enrichmentProgress.resetTime && (
                <span className="text-xs">
                  (reset: {new Date(enrichmentProgress.resetTime).toLocaleTimeString()})
                </span>
              )}
            </Badge>
          )}
        </div>
      )}

      {/* Alignment Scoring Progress Bar */}
      {showAlignmentProgress && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
          <Target className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>
                Scoring industry alignment... {alignmentProgress.current} of {alignmentProgress.total}
              </span>
              {alignmentProgress.successful !== undefined && (
                <span className="text-muted-foreground">
                  {alignmentProgress.successful} scored
                  {alignmentProgress.failed ? `, ${alignmentProgress.failed} failed` : ''}
                </span>
              )}
            </div>
            <Progress value={alignmentProgressPercent} className="h-2" />
          </div>
          {alignmentProgress.creditsDepleted && (
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
