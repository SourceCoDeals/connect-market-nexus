
import { useState, useEffect } from "react";
import { FilterOptions } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  // Update filters when any filter value changes
  useEffect(() => {
    const filters: FilterOptions = {};
    
    if (searchTerm) filters.search = searchTerm;
    if (category && category !== "all") filters.category = category;
    if (location && location !== "all") filters.location = location;
    
    onFilterChange(filters);
  }, [searchTerm, category, location, onFilterChange]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setCategory(undefined);
    setLocation(undefined);
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
              <SelectItem value="all">All categories</SelectItem>
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
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
