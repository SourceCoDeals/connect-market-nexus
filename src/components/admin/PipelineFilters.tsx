import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Filter, 
  SortAsc, 
  CheckCircle2, 
  Clock, 
  XCircle,
  AlertTriangle,
  Users,
  Building2,
  DollarSign,
  Calendar
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";

export type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'on_hold';
export type BuyerTypeFilter = 'all' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'corporate' | 'individual' | 'independentSponsor';
export type SortOption = 'newest' | 'oldest' | 'buyer_priority' | 'deal_size' | 'approval_date';

interface PipelineFiltersProps {
  requests: AdminConnectionRequest[];
  statusFilter: StatusFilter;
  buyerTypeFilter: BuyerTypeFilter;
  sortOption: SortOption;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onBuyerTypeFilterChange: (filter: BuyerTypeFilter) => void;
  onSortChange: (sort: SortOption) => void;
}

export function PipelineFilters({
  requests,
  statusFilter,
  buyerTypeFilter,
  sortOption,
  onStatusFilterChange,
  onBuyerTypeFilterChange,
  onSortChange
}: PipelineFiltersProps) {
  
  // Calculate counts for each status
  const statusCounts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    on_hold: requests.filter(r => r.status === 'on_hold').length,
  };

  // Calculate counts for each buyer type
  const buyerTypeCounts = {
    all: requests.length,
    privateEquity: requests.filter(r => r.user?.buyer_type === 'privateEquity').length,
    familyOffice: requests.filter(r => r.user?.buyer_type === 'familyOffice').length,
    searchFund: requests.filter(r => r.user?.buyer_type === 'searchFund').length,
    corporate: requests.filter(r => r.user?.buyer_type === 'corporate').length,
    individual: requests.filter(r => r.user?.buyer_type === 'individual').length,
    independentSponsor: requests.filter(r => r.user?.buyer_type === 'independentSponsor').length,
  };

  const statusOptions = [
    { value: 'all', label: 'All Requests', icon: Users, count: statusCounts.all },
    { value: 'pending', label: 'Pending', icon: Clock, count: statusCounts.pending },
    { value: 'approved', label: 'Approved', icon: CheckCircle2, count: statusCounts.approved },
    { value: 'rejected', label: 'Rejected', icon: XCircle, count: statusCounts.rejected },
    { value: 'on_hold', label: 'On Hold', icon: AlertTriangle, count: statusCounts.on_hold },
  ] as const;

  const buyerTypeOptions = [
    { value: 'all', label: 'All Buyer Types', count: buyerTypeCounts.all },
    { value: 'privateEquity', label: 'Private Equity', count: buyerTypeCounts.privateEquity },
    { value: 'familyOffice', label: 'Family Office', count: buyerTypeCounts.familyOffice },
    { value: 'searchFund', label: 'Search Fund', count: buyerTypeCounts.searchFund },
    { value: 'corporate', label: 'Corporate', count: buyerTypeCounts.corporate },
    { value: 'individual', label: 'Individual', count: buyerTypeCounts.individual },
    { value: 'independentSponsor', label: 'Independent Sponsor', count: buyerTypeCounts.independentSponsor },
  ] as const;

  const sortOptions = [
    { value: 'newest', label: 'Newest First', icon: Calendar },
    { value: 'oldest', label: 'Oldest First', icon: Calendar },
    { value: 'buyer_priority', label: 'Buyer Priority', icon: Users },
    { value: 'deal_size', label: 'Deal Size', icon: DollarSign },
    { value: 'approval_date', label: 'Approval Date', icon: CheckCircle2 },
  ] as const;

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-background/60 backdrop-blur-sm rounded-lg border border-border/40">
      {/* Quick Status Filter Badges */}
      <div className="flex gap-2 flex-wrap">
        {statusOptions.map((option) => {
          const isActive = statusFilter === option.value;
          const StatusIcon = option.icon;
          
          return (
            <Button
              key={option.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange(option.value as StatusFilter)}
              className={`h-8 text-xs transition-all hover:scale-105 ${
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "hover:bg-accent/50"
              }`}
            >
              <StatusIcon className="h-3 w-3 mr-1.5" />
              {option.label}
              {option.count > 0 && (
                <Badge 
                  variant="secondary" 
                  className={`ml-2 text-xs h-4 px-1.5 ${
                    isActive 
                      ? "bg-primary-foreground/20 text-primary-foreground" 
                      : "bg-background/80 text-muted-foreground"
                  }`}
                >
                  {option.count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Advanced Filters */}
      <div className="flex gap-2 ml-auto">
        {/* Buyer Type Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Building2 className="h-3 w-3 mr-1.5" />
              Buyer Type
              {buyerTypeFilter !== 'all' && (
                <Badge variant="secondary" className="ml-2 text-xs h-4 px-1.5">
                  {buyerTypeCounts[buyerTypeFilter]}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Filter by Buyer Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {buyerTypeOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={buyerTypeFilter === option.value}
                onCheckedChange={() => onBuyerTypeFilterChange(option.value as BuyerTypeFilter)}
                className="flex items-center justify-between"
              >
                <span>{option.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {option.count}
                </Badge>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort Options */}
        <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
          <SelectTrigger className="w-36 h-8">
            <div className="flex items-center gap-1.5">
              <SortAsc className="h-3 w-3" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => {
              const SortIcon = option.icon;
              return (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <SortIcon className="h-3 w-3" />
                    {option.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}