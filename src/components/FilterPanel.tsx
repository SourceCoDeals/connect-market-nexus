
import { useState, useEffect } from "react";
import { FilterOptions } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Filter, DollarSign, Bell } from "lucide-react";
import { useAnalyticsTracking } from "@/hooks/use-analytics-tracking";
import { CreateDealAlertDialog } from "./deal-alerts/CreateDealAlertDialog";

// Filter panel props
export interface FilterPanelProps {
  onFilterChange: (filters: FilterOptions) => void;
  totalListings: number;
  filteredCount: number;
  categories?: string[];
  locations?: string[];
}

// All available categories from our database
const ALL_CATEGORIES = [
  'Technology',
  'E-commerce',
  'SaaS',
  'Manufacturing',
  'Retail',
  'Healthcare',
  'Food & Beverage',
  'Service',
  'Consumer Services',
  'Consumer & Retail',
  'Consumer Multi-Site',
  'Industrials',
  'Vehicle Aftermarket Products & Services',
  'Digital Media',
  'Business Services',
  'Marketing & Info Services',
  'HR services',
  'Financial Services',
  'Asset & Wealth Management',
  'Other'
];

// Revenue range options (in millions)
const REVENUE_RANGES = [
  { label: 'Any', value: null },
  { label: 'Under $1M', value: { min: 0, max: 1000000 } },
  { label: '$1M - $5M', value: { min: 1000000, max: 5000000 } },
  { label: '$5M - $10M', value: { min: 5000000, max: 10000000 } },
  { label: '$10M - $25M', value: { min: 10000000, max: 25000000 } },
  { label: '$25M - $50M', value: { min: 25000000, max: 50000000 } },
  { label: 'Over $50M', value: { min: 50000000, max: null } }
];

// EBITDA range options (in millions)
const EBITDA_RANGES = [
  { label: 'Any', value: null },
  { label: 'Under $500K', value: { min: 0, max: 500000 } },
  { label: '$500K - $1M', value: { min: 500000, max: 1000000 } },
  { label: '$1M - $2.5M', value: { min: 1000000, max: 2500000 } },
  { label: '$2.5M - $5M', value: { min: 2500000, max: 5000000 } },
  { label: '$5M - $10M', value: { min: 5000000, max: 10000000 } },
  { label: 'Over $10M', value: { min: 10000000, max: null } }
];

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
  const [revenueRange, setRevenueRange] = useState<string>('any');
  const [ebitdaRange, setEbitdaRange] = useState<string>('any');
  const { trackSearch } = useAnalyticsTracking();

  // Merge categories from database with our complete list
  const allCategories = [...new Set([...ALL_CATEGORIES, ...categories])].sort();

  // Update filters when any filter value changes
  useEffect(() => {
    const filters: FilterOptions = {};
    
    if (searchTerm) filters.search = searchTerm;
    if (category && category !== "all") filters.category = category;
    if (location && location !== "all") filters.location = location;
    
    // Apply revenue range filter
    if (revenueRange !== 'any') {
      const range = REVENUE_RANGES.find(r => r.label === revenueRange);
      if (range?.value) {
        if (range.value.min !== null) filters.revenueMin = range.value.min;
        if (range.value.max !== null) filters.revenueMax = range.value.max;
      }
    }
    
    // Apply EBITDA range filter
    if (ebitdaRange !== 'any') {
      const range = EBITDA_RANGES.find(r => r.label === ebitdaRange);
      if (range?.value) {
        if (range.value.min !== null) filters.ebitdaMin = range.value.min;
        if (range.value.max !== null) filters.ebitdaMax = range.value.max;
      }
    }
    
    onFilterChange(filters);
    
    // Track search analytics when search term is used
    if (searchTerm.trim()) {
      trackSearch(searchTerm, filters, filteredCount, filteredCount === 0);
    }
  }, [searchTerm, category, location, revenueRange, ebitdaRange, onFilterChange, filteredCount, trackSearch]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setCategory(undefined);
    setLocation(undefined);
    setRevenueRange('any');
    setEbitdaRange('any');
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
              {allCategories.map((cat) => (
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
        
        {/* Revenue Range */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Annual Revenue
          </Label>
          <Select value={revenueRange} onValueChange={setRevenueRange}>
            <SelectTrigger>
              <SelectValue placeholder="Any revenue" />
            </SelectTrigger>
            <SelectContent>
              {REVENUE_RANGES.map((range) => (
                <SelectItem key={range.label} value={range.label}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* EBITDA Range */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Annual EBITDA
          </Label>
          <Select value={ebitdaRange} onValueChange={setEbitdaRange}>
            <SelectTrigger>
              <SelectValue placeholder="Any EBITDA" />
            </SelectTrigger>
            <SelectContent>
              {EBITDA_RANGES.map((range) => (
                <SelectItem key={range.label} value={range.label}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Results summary and actions */}
        <div className="pt-4 space-y-4 border-t">
          <div className="text-sm">
            <p>Showing {filteredCount} of {totalListings} listings</p>
          </div>
          
          <CreateDealAlertDialog 
            trigger={
              <Button variant="default" className="w-full">
                <Bell className="h-4 w-4 mr-2" />
                Get Deal Alerts
              </Button>
            }
          />
          
          <Button variant="outline" onClick={handleResetFilters} className="w-full">
            Reset all filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FilterPanel;
