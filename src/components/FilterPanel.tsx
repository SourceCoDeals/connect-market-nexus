
import { useState, useEffect } from "react";
import { FilterOptions } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";

// Filter panel props
export interface FilterPanelProps {
  onFilterChange: (filters: FilterOptions) => void;
  totalListings: number;
  filteredCount: number;
  categories?: string[];
  locations?: string[];
}

const FilterPanel = ({
  onFilterChange,
  totalListings,
  filteredCount,
  categories = [],
  locations = []
}: FilterPanelProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState<string | undefined>(undefined);
  const [revenueRange, setRevenueRange] = useState<[number, number]>([0, 10000000]);
  const [ebitdaRange, setEbitdaRange] = useState<[number, number]>([0, 5000000]);

  // Update filters when any filter value changes
  useEffect(() => {
    const filters: FilterOptions = {};
    
    if (searchTerm) filters.search = searchTerm;
    if (category) filters.category = category;
    if (location) filters.location = location;
    
    filters.revenueMin = revenueRange[0];
    filters.revenueMax = revenueRange[1];
    filters.ebitdaMin = ebitdaRange[0];
    filters.ebitdaMax = ebitdaRange[1];
    
    onFilterChange(filters);
  }, [searchTerm, category, location, revenueRange, ebitdaRange, onFilterChange]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setCategory(undefined);
    setLocation(undefined);
    setRevenueRange([0, 10000000]);
    setEbitdaRange([0, 5000000]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Search listings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Category select */}
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={(value) => setCategory(value)}>
            <SelectTrigger id="category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Location select */}
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Select value={location} onValueChange={(value) => setLocation(value)}>
            <SelectTrigger id="location">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Revenue range */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Revenue range</Label>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(revenueRange[0])}</span>
              <span>{formatCurrency(revenueRange[1])}</span>
            </div>
            <Slider
              min={0}
              max={10000000}
              step={100000}
              value={revenueRange}
              onValueChange={(value) => setRevenueRange(value as [number, number])}
            />
          </div>
        </div>
        
        {/* EBITDA range */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>EBITDA range</Label>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(ebitdaRange[0])}</span>
              <span>{formatCurrency(ebitdaRange[1])}</span>
            </div>
            <Slider
              min={0}
              max={5000000}
              step={50000}
              value={ebitdaRange}
              onValueChange={(value) => setEbitdaRange(value as [number, number])}
            />
          </div>
        </div>
        
        {/* Results summary and reset button */}
        <div className="pt-4 space-y-4 border-t">
          <div className="text-sm">
            <p>Showing {filteredCount} of {totalListings} listings</p>
          </div>
          <Button variant="outline" onClick={handleResetFilters} className="w-full">
            Reset all filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FilterPanel;
