import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface DealFiltersBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedTracker: string;
  onTrackerChange: (value: string) => void;
  trackers: { id: string; industry_name: string }[];
  scoreRange: string;
  onScoreRangeChange: (value: string) => void;
  industryFilter: string;
  onIndustryChange: (value: string) => void;
  industries: string[];
  motivationFilter: string;
  onMotivationChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function DealFiltersBar({
  searchQuery,
  onSearchChange,
  selectedTracker,
  onTrackerChange,
  trackers,
  scoreRange,
  onScoreRangeChange,
  industryFilter,
  onIndustryChange,
  industries,
  motivationFilter,
  onMotivationChange,
  statusFilter,
  onStatusChange,
  onClearFilters,
  hasActiveFilters,
}: DealFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Bar */}
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, domain, or geography..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tracker Filter */}
      <Select value={selectedTracker} onValueChange={onTrackerChange}>
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="All Trackers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Trackers</SelectItem>
          {trackers.map((tracker) => (
            <SelectItem key={tracker.id} value={tracker.id}>
              {tracker.industry_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Score Range Filter */}
      <Select value={scoreRange} onValueChange={onScoreRangeChange}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Any Score" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any Score</SelectItem>
          <SelectItem value="hot">Hot (85+)</SelectItem>
          <SelectItem value="high">High (70-84)</SelectItem>
          <SelectItem value="medium">Medium (40-69)</SelectItem>
          <SelectItem value="low">Low (0-39)</SelectItem>
          <SelectItem value="unscored">Unscored</SelectItem>
        </SelectContent>
      </Select>

      {/* Industry Filter */}
      <Select value={industryFilter} onValueChange={onIndustryChange}>
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="All Industries" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Industries</SelectItem>
          {industries.map((industry) => (
            <SelectItem key={industry} value={industry}>
              {industry}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Motivation Filter */}
      <Select value={motivationFilter} onValueChange={onMotivationChange}>
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="All Motivation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Motivation</SelectItem>
          <SelectItem value="retirement">Retirement</SelectItem>
          <SelectItem value="growth">Growth Capital</SelectItem>
          <SelectItem value="partner">Partner Buyout</SelectItem>
          <SelectItem value="health">Health Issues</SelectItem>
          <SelectItem value="burnout">Burnout</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Any Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any Status</SelectItem>
          <SelectItem value="Active">Active</SelectItem>
          <SelectItem value="Inactive">Inactive</SelectItem>
          <SelectItem value="Closed">Closed</SelectItem>
          <SelectItem value="Archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-9">
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
