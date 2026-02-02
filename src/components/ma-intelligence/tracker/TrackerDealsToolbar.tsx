import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Sparkles, Target, FileUp } from "lucide-react";

interface TrackerDealsToolbarProps {
  selectedCount: number;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  onAddDeal: () => void;
  onBulkEnrich: () => void;
  onBulkScore: () => void;
  isEnriching: boolean;
}

export function TrackerDealsToolbar({
  selectedCount,
  totalCount,
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  onAddDeal,
  onBulkEnrich,
  onBulkScore,
  isEnriching,
}: TrackerDealsToolbarProps) {
  return (
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
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
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
            disabled={isEnriching}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Enrich ({selectedCount})
          </Button>

          <Button
            onClick={onBulkScore}
            variant="secondary"
          >
            <Target className="w-4 h-4 mr-2" />
            Score ({selectedCount})
          </Button>

          <Button variant="outline">
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
  );
}
