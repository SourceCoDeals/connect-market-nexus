import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Sparkles, Target, FileUp, GitMerge, MoreVertical } from "lucide-react";

interface TrackerBuyersToolbarProps {
  selectedCount: number;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterCoverage: "all" | "high" | "medium" | "low";
  onFilterCoverageChange: (coverage: "all" | "high" | "medium" | "low") => void;
  onAddBuyer: () => void;
  onBulkEnrich: () => void;
  onBulkScore: (dealId: string) => void;
  onDedupe: () => void;
  isEnriching: boolean;
}

export function TrackerBuyersToolbar({
  selectedCount,
  totalCount,
  searchQuery,
  onSearchChange,
  filterCoverage,
  onFilterCoverageChange,
  onAddBuyer,
  onBulkEnrich,
  onBulkScore,
  onDedupe,
  isEnriching,
}: TrackerBuyersToolbarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search buyers by firm, platform, or location..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Coverage Filter */}
      <Select value={filterCoverage} onValueChange={onFilterCoverageChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by coverage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Coverage</SelectItem>
          <SelectItem value="high">High Coverage</SelectItem>
          <SelectItem value="medium">Medium Coverage</SelectItem>
          <SelectItem value="low">Low Coverage</SelectItem>
        </SelectContent>
      </Select>

      {/* Add Buyer */}
      <Button onClick={onAddBuyer} variant="outline">
        <Plus className="w-4 h-4 mr-2" />
        Add Buyer
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <MoreVertical className="w-4 h-4 mr-2" />
                More Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Target className="w-4 h-4 mr-2" />
                Score Against Deal
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileUp className="w-4 h-4 mr-2" />
                Export Selected
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDedupe}>
                <GitMerge className="w-4 h-4 mr-2" />
                Find Duplicates
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      {/* Count Display */}
      <div className="text-sm text-muted-foreground">
        {totalCount} buyer{totalCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
