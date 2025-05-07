
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterOptions } from "@/types";
import { Search } from "lucide-react";

interface FilterPanelProps {
  onFilterChange: (filters: FilterOptions) => void;
  totalListings: number;
  filteredCount: number;
  categories: string[];
  locations: string[];
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  onFilterChange,
  totalListings,
  filteredCount,
  categories,
  locations,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [revenueRange, setRevenueRange] = useState<[number, number]>([0, 10000000]); // 0 - $10M
  const [ebitdaRange, setEbitdaRange] = useState<[number, number]>([0, 2000000]); // 0 - $2M
  
  // Format revenue and EBITDA for display
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  // Apply filters when they change
  useEffect(() => {
    const filters: FilterOptions = {
      search: search.trim() || undefined,
      category: selectedCategories.length > 0
        ? selectedCategories.join(",")
        : undefined,
      location: selectedLocations.length > 0
        ? selectedLocations.join(",")
        : undefined,
      revenueMin: revenueRange[0] > 0 ? revenueRange[0] : undefined,
      revenueMax: revenueRange[1] < 10000000 ? revenueRange[1] : undefined,
      ebitdaMin: ebitdaRange[0] > 0 ? ebitdaRange[0] : undefined,
      ebitdaMax: ebitdaRange[1] < 2000000 ? ebitdaRange[1] : undefined,
    };
    
    onFilterChange(filters);
  }, [search, selectedCategories, selectedLocations, revenueRange, ebitdaRange]);

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, category]);
    } else {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    }
  };

  const handleLocationChange = (location: string, checked: boolean) => {
    if (checked) {
      setSelectedLocations([...selectedLocations, location]);
    } else {
      setSelectedLocations(selectedLocations.filter(l => l !== location));
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedCategories([]);
    setSelectedLocations([]);
    setRevenueRange([0, 10000000]);
    setEbitdaRange([0, 2000000]);
  };

  return (
    <div className="bg-white rounded-lg border border-border p-4 h-full sticky top-24">
      <div className="space-y-6">
        {/* Search */}
        <div>
          <Label htmlFor="search" className="text-sm font-medium mb-1.5 block">
            Keyword Search
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search listings..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Categories */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">
            Categories
          </Label>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {categories.map((category) => (
              <div key={category} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category}`}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={(checked) => 
                    handleCategoryChange(category, checked as boolean)
                  }
                />
                <label
                  htmlFor={`category-${category}`}
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {category}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Locations */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">
            Locations
          </Label>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {locations.map((location) => (
              <div key={location} className="flex items-center space-x-2">
                <Checkbox
                  id={`location-${location}`}
                  checked={selectedLocations.includes(location)}
                  onCheckedChange={(checked) => 
                    handleLocationChange(location, checked as boolean)
                  }
                />
                <label
                  htmlFor={`location-${location}`}
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {location}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Range */}
        <div>
          <div className="flex justify-between mb-1.5">
            <Label className="text-sm font-medium">Revenue</Label>
            <span className="text-sm text-muted-foreground">
              {formatCurrency(revenueRange[0])} - {formatCurrency(revenueRange[1])}
            </span>
          </div>
          <Slider
            defaultValue={[0, 10000000]}
            min={0}
            max={10000000}
            step={100000}
            value={revenueRange}
            onValueChange={setRevenueRange}
            className="mt-6 mb-8"
          />
        </div>

        {/* EBITDA Range */}
        <div>
          <div className="flex justify-between mb-1.5">
            <Label className="text-sm font-medium">EBITDA</Label>
            <span className="text-sm text-muted-foreground">
              {formatCurrency(ebitdaRange[0])} - {formatCurrency(ebitdaRange[1])}
            </span>
          </div>
          <Slider
            defaultValue={[0, 2000000]}
            min={0}
            max={2000000}
            step={50000}
            value={ebitdaRange}
            onValueChange={setEbitdaRange}
            className="mt-6"
          />
        </div>
        
        {/* Results summary */}
        <div className="border-t border-border pt-4">
          <div className="text-sm">
            Showing <span className="font-medium">{filteredCount}</span> of{" "}
            <span className="font-medium">{totalListings}</span> listings
          </div>
          {(selectedCategories.length > 0 || 
           selectedLocations.length > 0 || 
           search || 
           revenueRange[0] > 0 || 
           revenueRange[1] < 10000000 ||
           ebitdaRange[0] > 0 ||
           ebitdaRange[1] < 2000000) && (
            <Button 
              variant="link" 
              className="px-0 text-sm h-auto"
              onClick={handleResetFilters}
            >
              Reset all filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
