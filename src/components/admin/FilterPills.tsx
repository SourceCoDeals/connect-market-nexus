import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, ChevronDown, SortAsc, Filter } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { DealStatusFilter, BuyerTypeFilter, SortOption } from './DealFilters';

interface FilterPillsProps {
  deals: Deal[];
  searchQuery: string;
  statusFilter: DealStatusFilter;
  buyerTypeFilter: BuyerTypeFilter;
  sortOption: SortOption;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (filter: DealStatusFilter) => void;
  onBuyerTypeFilterChange: (filter: BuyerTypeFilter) => void;
  onSortChange: (sort: SortOption) => void;
}

export function FilterPills({
  deals,
  searchQuery,
  statusFilter,
  buyerTypeFilter,
  sortOption,
  onSearchChange,
  onStatusFilterChange,
  onBuyerTypeFilterChange,
  onSortChange,
}: FilterPillsProps) {
  
  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'new_inquiry', label: 'New' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'due_diligence', label: 'Due Diligence' },
    { value: 'under_contract', label: 'Contract' },
    { value: 'closed', label: 'Closed' },
  ] as const;

  const buyerTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'privateEquity', label: 'PE' },
    { value: 'familyOffice', label: 'Family Office' },
    { value: 'searchFund', label: 'Search Fund' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'individual', label: 'Individual' },
  ] as const;

  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'value', label: 'Value' },
    { value: 'probability', label: 'Probability' },
    { value: 'priority', label: 'Priority' },
  ] as const;

  return (
    <div className="h-11 px-4 flex items-center gap-3 border-b border-border/20 bg-background/50">
      {/* Search - Apple style */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input
          placeholder="Search deals..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 pl-9 text-xs bg-muted/30 border-muted-foreground/20 focus:bg-background focus:border-border"
        />
      </div>

      {/* Status Pills - HubSpot style */}
      <div className="flex items-center gap-1">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onStatusFilterChange(option.value as DealStatusFilter)}
            className={`h-7 px-3 rounded-md text-xs font-medium transition-all duration-200 ${
              statusFilter === option.value
                ? 'bg-foreground text-background' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border/40" />

      {/* Advanced Filters */}
      <div className="flex items-center gap-2">
        {/* Buyer Type */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className={`h-7 px-3 text-xs ${
                buyerTypeFilter !== 'all' 
                  ? 'bg-muted text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {buyerTypeOptions.find(o => o.value === buyerTypeFilter)?.label}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {buyerTypeOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={buyerTypeFilter === option.value}
                onCheckedChange={() => onBuyerTypeFilterChange(option.value as BuyerTypeFilter)}
                className="text-xs"
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <SortAsc className="h-3 w-3 mr-1" />
              {sortOptions.find(o => o.value === sortOption)?.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {sortOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={sortOption === option.value}
                onCheckedChange={() => onSortChange(option.value as SortOption)}
                className="text-xs"
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}