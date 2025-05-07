
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { FilterOptions } from "@/types";
import { X, SlidersHorizontal } from "lucide-react";
import { useMarketplace } from "@/hooks/use-marketplace";

interface FilterPanelProps {
  onFilterChange: (filters: FilterOptions) => void;
  totalListings: number;
  filteredCount: number;
}

const FilterPanel = ({
  onFilterChange,
  totalListings,
  filteredCount,
}: FilterPanelProps) => {
  const { useListingMetadata } = useMarketplace();
  const { data: metadata } = useListingMetadata();
  const categories = metadata?.categories || [];
  const locations = metadata?.locations || [];
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [revenueRange, setRevenueRange] = useState<[number, number]>([0, 10000000]);
  const [ebitdaRange, setEbitdaRange] = useState<[number, number]>([0, 2000000]);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Helper function to format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  // Helper function to format slider values
  const formatSliderValue = (value: number) => {
    return `$${value}`;
  };

  // Helper function to handle slider value changes - fixes the type mismatch
  const handleSliderChange = (
    setter: React.Dispatch<React.SetStateAction<[number, number]>>
  ) => {
    return (value: number[]) => {
      setter([value[0], value[1]] as [number, number]);
    };
  };

  // Apply filters when they change
  useEffect(() => {
    const filters: FilterOptions = {
      search: searchTerm,
      category: selectedCategories.length > 0 ? selectedCategories.join(",") : undefined,
      location: selectedLocations.length > 0 ? selectedLocations.join(",") : undefined,
      revenueMin: revenueRange[0] > 0 ? revenueRange[0] : undefined,
      revenueMax: revenueRange[1] < 10000000 ? revenueRange[1] : undefined,
      ebitdaMin: ebitdaRange[0] > 0 ? ebitdaRange[0] : undefined,
      ebitdaMax: ebitdaRange[1] < 2000000 ? ebitdaRange[1] : undefined,
    };

    onFilterChange(filters);
  }, [
    searchTerm,
    selectedCategories,
    selectedLocations,
    revenueRange,
    ebitdaRange,
    onFilterChange,
  ]);

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedCategories([]);
    setSelectedLocations([]);
    setRevenueRange([0, 10000000]);
    setEbitdaRange([0, 2000000]);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleLocationChange = (location: string) => {
    setSelectedLocations((prev) => {
      if (prev.includes(location)) {
        return prev.filter((l) => l !== location);
      } else {
        return [...prev, location];
      }
    });
  };

  const filterContent = (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="space-y-2">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          placeholder="Search businesses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Separator />

      {/* Categories Filter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Category</Label>
          {selectedCategories.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedCategories([])}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category}`}
                checked={selectedCategories.includes(category)}
                onCheckedChange={() => handleCategoryChange(category)}
              />
              <label
                htmlFor={`category-${category}`}
                className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {category}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Location Filter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Location</Label>
          {selectedLocations.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedLocations([])}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
          {locations.map((location) => (
            <div key={location} className="flex items-center space-x-2">
              <Checkbox
                id={`location-${location}`}
                checked={selectedLocations.includes(location)}
                onCheckedChange={() => handleLocationChange(location)}
              />
              <label
                htmlFor={`location-${location}`}
                className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {location}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Revenue Filter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Revenue</Label>
          {(revenueRange[0] > 0 || revenueRange[1] < 10000000) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setRevenueRange([0, 10000000])}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">{formatCurrency(revenueRange[0])}</span>
          <span className="text-sm">{formatCurrency(revenueRange[1])}</span>
        </div>
        <Slider
            defaultValue={[0, 10000000]}
            min={0}
            max={10000000}
            step={100000}
            value={revenueRange}
            onValueChange={handleSliderChange(setRevenueRange)}
            className="mt-6 mb-8"
          />
      </div>

      <Separator />

      {/* EBITDA Filter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>EBITDA</Label>
          {(ebitdaRange[0] > 0 || ebitdaRange[1] < 2000000) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEbitdaRange([0, 2000000])}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">{formatCurrency(ebitdaRange[0])}</span>
          <span className="text-sm">{formatCurrency(ebitdaRange[1])}</span>
        </div>
        <Slider
            defaultValue={[0, 2000000]}
            min={0}
            max={2000000}
            step={50000}
            value={ebitdaRange}
            onValueChange={handleSliderChange(setEbitdaRange)}
            className="mt-6"
          />
      </div>

      {/* Clear All Button */}
      <div className="pt-4">
        <Button
          variant="outline"
          onClick={clearAllFilters}
          className="w-full"
        >
          Clear All Filters
        </Button>
      </div>
    </div>
  );

  const isFiltersActive =
    searchTerm ||
    selectedCategories.length > 0 ||
    selectedLocations.length > 0 ||
    revenueRange[0] > 0 ||
    revenueRange[1] < 10000000 ||
    ebitdaRange[0] > 0 ||
    ebitdaRange[1] < 2000000;

  return (
    <>
      {/* Desktop Filter Panel */}
      <div className="hidden lg:block">
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium">Filters</h2>
            {isFiltersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          {filterContent}

          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing{" "}
                <Badge variant="outline" className="font-normal ml-1">
                  {filteredCount}
                </Badge>{" "}
                of{" "}
                <Badge variant="outline" className="font-normal">
                  {totalListings}
                </Badge>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filter Button & Sheet */}
      <div className="lg:hidden w-full mb-4">
        <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="w-full"
              aria-label="Filter"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {isFiltersActive && (
                <Badge
                  variant="secondary"
                  className="ml-2 rounded-full h-6 w-6 p-0 text-xs flex items-center justify-center"
                >
                  !
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full max-w-full sm:max-w-md">
            <SheetHeader className="mb-6">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto max-h-[calc(100vh-8rem)] pr-2">
              {filterContent}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm">
                  Showing {filteredCount} of {totalListings} listings
                </span>
              </div>
              <Button
                className="w-full"
                onClick={() => setIsMobileFilterOpen(false)}
              >
                View Results
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default FilterPanel;
