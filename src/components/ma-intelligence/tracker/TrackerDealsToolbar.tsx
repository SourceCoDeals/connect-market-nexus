import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Sparkles, Target, FileUp, Pause, Play } from "lucide-react";

interface ScoringProgress {
  current: number;
  total: number;
  isPaused: boolean;
  completedIds: string[];
}

interface TrackerDealsToolbarProps {
  selectedCount: number;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  filterScore: string;
  onFilterScoreChange: (score: string) => void;
  onAddDeal: () => void;
  onBulkEnrich: () => void;
  onBulkScore: () => void;
  scoringProgress?: ScoringProgress | null;
  onPauseScoring?: () => void;
}

export function TrackerDealsToolbar({
  selectedCount,
  totalCount,
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterScore,
  onFilterScoreChange,
  onAddDeal,
  onBulkEnrich,
  onBulkScore,
  scoringProgress,
  onPauseScoring,
}: TrackerDealsToolbarProps) {
  const isScoring = scoringProgress && scoringProgress.current < scoringProgress.total;

  return (
    <div className="space-y-3">
      {scoringProgress && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              Scoring deals: {scoringProgress.current} / {scoringProgress.total}
            </div>
            {onPauseScoring && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPauseScoring}
              >
                {scoringProgress.isPaused ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
            )}
          </div>
          <Progress
            value={(scoringProgress.current / scoringProgress.total) * 100}
            className="h-2"
          />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search deals by name, website, or location..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filter */}
      <Select value={filterStatus} onValueChange={onFilterStatusChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      {/* Score Filter */}
      <Select value={filterScore} onValueChange={onFilterScoreChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by score" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Scores</SelectItem>
          <SelectItem value="hot">Hot (85+)</SelectItem>
          <SelectItem value="high">High (70-84)</SelectItem>
          <SelectItem value="medium">Medium (40-69)</SelectItem>
          <SelectItem value="low">Low (0-39)</SelectItem>
          <SelectItem value="unscored">Unscored</SelectItem>
        </SelectContent>
      </Select>

      {/* Add Deal */}
      <Button onClick={onAddDeal} variant="outline">
        <Plus className="w-4 h-4 mr-2" />
        Import Deals
      </Button>

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <>
          <Button
            onClick={onBulkEnrich}
            variant="secondary"
            disabled={!!isScoring}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Enrich ({selectedCount})
          </Button>

          <Button
            onClick={onBulkScore}
            variant="secondary"
            disabled={!!isScoring}
          >
            <Target className="w-4 h-4 mr-2" />
            Score ({selectedCount})
          </Button>

          <Button variant="outline" disabled={!!isScoring}>
            <FileUp className="w-4 h-4 mr-2" />
            Export Selected
          </Button>
        </>
      )}

      {/* Count Display */}
      <div className="text-sm text-muted-foreground">
        {totalCount} deal{totalCount !== 1 ? "s" : ""}
      </div>
      </div>
    </div>
  );
}
