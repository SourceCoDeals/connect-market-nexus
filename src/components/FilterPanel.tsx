
// Make sure it accepts the category and location props
interface FilterPanelProps {
  onFilterChange: (filters: FilterOptions) => void;
  totalListings: number;
  filteredCount: number;
  categories?: string[];
  locations?: string[];
}
