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
export type BuyerTypeFilter = 'all' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'corporate' | 'individual' | 'independentSponsor' | 'advisor' | 'businessOwner';
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
    advisor: requests.filter(r => r.user?.buyer_type === 'advisor').length,
    businessOwner: requests.filter(r => r.user?.buyer_type === 'businessOwner').length,
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
    { value: 'advisor', label: 'Advisor / Banker', count: buyerTypeCounts.advisor },
    { value: 'businessOwner', label: 'Business Owner', count: buyerTypeCounts.businessOwner },
  ] as const;

  const sortOptions = [
    { value: 'newest', label: 'Newest First', icon: Calendar },
    { value: 'oldest', label: 'Oldest First', icon: Calendar },
    { value: 'buyer_priority', label: 'Buyer Priority', icon: Users },
    { value: 'deal_size', label: 'Deal Size', icon: DollarSign },
    { value: 'approval_date', label: 'Approval Date', icon: CheckCircle2 },
  ] as const;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Main Filter Row */}
      <div className="flex items-center justify-between p-6">
        {/* Status Filter Tabs */}
        <div className="flex items-center bg-gray-50 rounded-lg p-1">
          {statusOptions.map((option) => {
            const isActive = statusFilter === option.value;
            const StatusIcon = option.icon;
            
            return (
              <button
                key={option.value}
                onClick={() => onStatusFilterChange(option.value as StatusFilter)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  }
                `}
              >
                <StatusIcon className="h-4 w-4" />
                {option.label}
                {option.count > 0 && (
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full font-medium
                    ${isActive 
                      ? "bg-gray-100 text-gray-700" 
                      : "bg-gray-200 text-gray-600"
                    }
                  `}>
                    {option.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Secondary Filters */}
        <div className="flex items-center gap-3">
          {/* Buyer Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                <Building2 className="h-4 w-4" />
                Buyer Type
                {buyerTypeFilter !== 'all' && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                    {buyerTypeCounts[buyerTypeFilter]}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-1"
            >
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Filter by Buyer Type
              </div>
              <div className="h-px bg-gray-100 my-1" />
              {buyerTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onBuyerTypeFilterChange(option.value as BuyerTypeFilter)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors duration-200
                    ${buyerTypeFilter === option.value 
                      ? "bg-blue-50 text-blue-900" 
                      : "text-gray-700 hover:bg-gray-50"
                    }
                  `}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full font-medium
                    ${buyerTypeFilter === option.value 
                      ? "bg-blue-100 text-blue-700" 
                      : "bg-gray-100 text-gray-600"
                    }
                  `}>
                    {option.count}
                  </span>
                </button>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Options */}
          <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
            <SelectTrigger className="w-40 h-10 bg-gray-50 hover:bg-gray-100 border-gray-200 rounded-lg transition-colors duration-200">
              <div className="flex items-center gap-2">
                <SortAsc className="h-4 w-4 text-gray-500" />
                <SelectValue className="text-sm font-medium text-gray-700" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white border border-gray-200 rounded-xl shadow-lg">
              {sortOptions.map((option) => {
                const SortIcon = option.icon;
                return (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="hover:bg-gray-50 rounded-lg mx-1"
                  >
                    <div className="flex items-center gap-2">
                      <SortIcon className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{option.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}