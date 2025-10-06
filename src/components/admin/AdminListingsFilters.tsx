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
import { X, RotateCcw, ArrowUpDown, Users, Tag, DollarSign, MapPin, Calendar } from "lucide-react";
import { AdminListing } from "@/types/admin";
import { STATUS_TAG_LABELS } from "@/constants/statusTags";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    buyerVisibility: string;
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

  const buyerTypeLabels: Record<string, string> = {
    privateEquity: 'Private Equity',
    corporate: 'Corporate',
    familyOffice: 'Family Office',
    searchFund: 'Search Fund',
    individual: 'Individual',
    independentSponsor: 'Independent Sponsor',
    advisor: 'Advisor/Banker',
    businessOwner: 'Business Owner'
  };

  const removeFilter = (key: string) => {
    if (key === 'revenueMin' || key === 'revenueMax' || key === 'ebitdaMin' || 
        key === 'ebitdaMax' || key === 'dateFrom' || key === 'dateTo') {
      updateFilter(key, '');
    } else {
      updateFilter(key, 'all');
    }
  };

  const getActiveFilterChips = () => {
    const chips: { key: string; label: string; value: string }[] = [];
    
    if (filters.status !== 'all') {
      chips.push({ key: 'status', label: 'Status', value: filters.status });
    }
    if (filters.category !== 'all') {
      chips.push({ key: 'category', label: 'Category', value: filters.category });
    }
    if (filters.location !== 'all') {
      chips.push({ key: 'location', label: 'Location', value: filters.location });
    }
    if (filters.statusTag !== 'all') {
      chips.push({ key: 'statusTag', label: 'Status Tag', value: filters.statusTag === 'none' ? 'No Tag' : filters.statusTag });
    }
    if (filters.buyerVisibility !== 'all') {
      chips.push({ 
        key: 'buyerVisibility', 
        label: 'Buyer Visibility', 
        value: filters.buyerVisibility === 'unrestricted' ? 'Unrestricted' : buyerTypeLabels[filters.buyerVisibility] || filters.buyerVisibility 
      });
    }
    if (filters.revenueMin) {
      chips.push({ key: 'revenueMin', label: 'Min Revenue', value: `$${Number(filters.revenueMin).toLocaleString()}` });
    }
    if (filters.revenueMax) {
      chips.push({ key: 'revenueMax', label: 'Max Revenue', value: `$${Number(filters.revenueMax).toLocaleString()}` });
    }
    if (filters.ebitdaMin) {
      chips.push({ key: 'ebitdaMin', label: 'Min EBITDA', value: `$${Number(filters.ebitdaMin).toLocaleString()}` });
    }
    if (filters.ebitdaMax) {
      chips.push({ key: 'ebitdaMax', label: 'Max EBITDA', value: `$${Number(filters.ebitdaMax).toLocaleString()}` });
    }
    if (filters.dateFrom) {
      chips.push({ key: 'dateFrom', label: 'From', value: new Date(filters.dateFrom).toLocaleDateString() });
    }
    if (filters.dateTo) {
      chips.push({ key: 'dateTo', label: 'To', value: new Date(filters.dateTo).toLocaleDateString() });
    }
    
    return chips;
  };

  const activeFilterChips = getActiveFilterChips();

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
      statusTag: "all",
      buyerVisibility: "all"
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
    <Card className="border shadow-sm bg-gradient-to-br from-card to-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium">Advanced Filters</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Refine your listing search</p>
          </div>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-6 bg-sourceco/10 text-sourceco border-sourceco/20">
                {activeFiltersCount} active
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2 hover:bg-destructive/10 hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset All
            </Button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
            {activeFilterChips.map((chip) => (
              <Badge 
                key={chip.key} 
                variant="secondary" 
                className="h-7 px-3 bg-sourceco/10 text-sourceco border-sourceco/20 hover:bg-sourceco/20 cursor-pointer transition-colors"
                onClick={() => removeFilter(chip.key)}
              >
                <span className="text-xs font-medium">{chip.label}:</span>
                <span className="text-xs ml-1.5">{chip.value}</span>
                <X className="h-3 w-3 ml-2" />
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-10 bg-muted/50">
            <TabsTrigger value="basic" className="text-xs">
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="financial" className="text-xs">
              <DollarSign className="h-3.5 w-3.5 mr-1.5" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="visibility" className="text-xs">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Visibility
            </TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Label className="text-sm font-medium">
              <MapPin className="h-3.5 w-3.5 inline mr-1.5" />
              Location
            </Label>
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

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              <Tag className="h-3.5 w-3.5 inline mr-1.5" />
              Status Tag
            </Label>
            <Select value={filters.statusTag} onValueChange={(value) => updateFilter("statusTag", value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Status Tags" />
              </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border shadow-lg z-50">
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
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4 mt-4">

            <div className="space-y-4">
              <Label className="text-sm font-medium">
                <DollarSign className="h-3.5 w-3.5 inline mr-1.5" />
                Revenue Range
              </Label>
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
              <Label className="text-sm font-medium">
                <DollarSign className="h-3.5 w-3.5 inline mr-1.5" />
                EBITDA Range
              </Label>
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
          </TabsContent>

          <TabsContent value="visibility" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border">
                <Users className="h-5 w-5 text-sourceco mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-1">Buyer Type Visibility</h4>
                  <p className="text-xs text-muted-foreground">Filter listings by which buyer types can view them</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Visible To</Label>
                <Select value={filters.buyerVisibility} onValueChange={(value) => updateFilter("buyerVisibility", value)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Visibility Settings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Visibility Settings</SelectItem>
                    <SelectItem value="unrestricted">🌐 Unrestricted (All Buyer Types)</SelectItem>
                    <SelectItem value="privateEquity">{buyerTypeLabels.privateEquity}</SelectItem>
                    <SelectItem value="corporate">{buyerTypeLabels.corporate}</SelectItem>
                    <SelectItem value="familyOffice">{buyerTypeLabels.familyOffice}</SelectItem>
                    <SelectItem value="searchFund">{buyerTypeLabels.searchFund}</SelectItem>
                    <SelectItem value="individual">{buyerTypeLabels.individual}</SelectItem>
                    <SelectItem value="independentSponsor">{buyerTypeLabels.independentSponsor}</SelectItem>
                    <SelectItem value="advisor">{buyerTypeLabels.advisor}</SelectItem>
                    <SelectItem value="businessOwner">{buyerTypeLabels.businessOwner}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filters.buyerVisibility !== 'all' && (
                <div className="p-3 bg-sourceco/5 border border-sourceco/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {filters.buyerVisibility === 'unrestricted' 
                      ? 'Showing listings visible to all buyer types'
                      : `Showing listings visible to ${buyerTypeLabels[filters.buyerVisibility]} buyers`}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-4">
              <Label className="text-sm font-medium">
                <Calendar className="h-3.5 w-3.5 inline mr-1.5" />
                Date Range
              </Label>
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

            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-3 block">
                <ArrowUpDown className="h-3.5 w-3.5 inline mr-1.5" />
                Sort Options
              </Label>
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}