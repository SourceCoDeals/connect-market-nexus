import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { X, RotateCcw, ArrowUpDown } from "lucide-react";
import { AdminListing } from "@/types/admin";

interface AdminListingsFiltersProps {
  filters: {
    status: string;
    category: string;
    location: string;
    revenueMin: string;
    revenueMax: string;
    ebitdaMin: string;
    ebitdaMax: string;
    dateFrom: string;
    dateTo: string;
    statusTag: string;
  };
  onFiltersChange: (filters: any) => void;
  sortBy: string;
  sortOrder: string;
  onSortChange: (sortBy: string, sortOrder: string) => void;
  listings: AdminListing[];
}

export function AdminListingsFilters({
  filters,
  onFiltersChange,
  sortBy,
  sortOrder,
  onSortChange,
  listings
}: AdminListingsFiltersProps) {
  const uniqueCategories = Array.from(new Set(
    listings.flatMap(l => l.categories || (l.category ? [l.category] : []))
  )).sort();
  
  const uniqueLocations = Array.from(new Set(
    listings.map(l => l.location)
  )).sort();

  const uniqueStatusTags = Array.from(new Set(
    listings.map(l => l.status_tag).filter(Boolean)
  )).sort();

  const resetFilters = () => {
    onFiltersChange({
      status: "all",
      category: "all",
      location: "all",
      revenueMin: "",
      revenueMax: "",
      ebitdaMin: "",
      ebitdaMax: "",
      dateFrom: "",
      dateTo: "",
      statusTag: "all"
    });
  };

  const updateFilter = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const activeFiltersCount = Object.values(filters).filter(f => f !== "all" && f !== "").length;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Advanced Filters</CardTitle>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-6">
                {activeFiltersCount} active
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Category</Label>
            <Select value={filters.category} onValueChange={(value) => updateFilter("category", value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Location</Label>
            <Select value={filters.location} onValueChange={(value) => updateFilter("location", value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {uniqueLocations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Tags */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status Tag</Label>
          <Select value={filters.statusTag} onValueChange={(value) => updateFilter("statusTag", value)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Status Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status Tags</SelectItem>
              <SelectItem value="none">No Tag</SelectItem>
              {uniqueStatusTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Financial Filters */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Revenue Range</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Minimum</Label>
              <Input
                type="number"
                placeholder="$0"
                value={filters.revenueMin}
                onChange={(e) => updateFilter("revenueMin", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Maximum</Label>
              <Input
                type="number"
                placeholder="No limit"
                value={filters.revenueMax}
                onChange={(e) => updateFilter("revenueMax", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-medium">EBITDA Range</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Minimum</Label>
              <Input
                type="number"
                placeholder="$0"
                value={filters.ebitdaMin}
                onChange={(e) => updateFilter("ebitdaMin", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Maximum</Label>
              <Input
                type="number"
                placeholder="No limit"
                value={filters.ebitdaMax}
                onChange={(e) => updateFilter("ebitdaMax", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Date Range</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        {/* Sorting */}
        <div className="border-t pt-4">
          <Label className="text-sm font-medium mb-3 block">Sort Options</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Sort by</Label>
              <Select value={sortBy} onValueChange={(value) => onSortChange(value, sortOrder)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date Added</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="internal_company_name">Company Name</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="ebitda">EBITDA</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Order</Label>
              <Select value={sortOrder} onValueChange={(value) => onSortChange(sortBy, value)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}