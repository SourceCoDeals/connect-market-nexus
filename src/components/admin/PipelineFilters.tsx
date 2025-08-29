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
    <div className="bg-white border-b border-gray-100">
      <div className="px-6 py-4">
        {/* Status Filter Pills */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {statusOptions.map((option) => {
              const isActive = statusFilter === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => onStatusFilterChange(option.value as StatusFilter)}
                  className={`
                    px-4 py-2 text-sm font-medium rounded-full transition-all duration-200
                    ${isActive 
                      ? "bg-black text-white" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }
                  `}
                >
                  {option.label}
                  {option.count > 0 && (
                    <span className={`
                      ml-2 text-xs font-medium
                      ${isActive 
                        ? "text-gray-300" 
                        : "text-gray-400"
                      }
                    `}>
                      {option.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center space-x-4">
            {/* Buyer Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200">
                  Buyer Type
                  {buyerTypeFilter !== 'all' && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {buyerTypeCounts[buyerTypeFilter]}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-64 bg-white border border-gray-200 rounded-lg shadow-lg"
              >
                <div className="p-3 border-b border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Buyer Type
                  </div>
                </div>
                <div className="p-2">
                  {buyerTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onBuyerTypeFilterChange(option.value as BuyerTypeFilter)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors duration-200
                        ${buyerTypeFilter === option.value 
                          ? "bg-black text-white" 
                          : "text-gray-700 hover:bg-gray-50"
                        }
                      `}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className={`
                        text-xs font-medium
                        ${buyerTypeFilter === option.value 
                          ? "text-gray-300" 
                          : "text-gray-400"
                        }
                      `}>
                        {option.count}
                      </span>
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort Options */}
            <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
              <SelectTrigger className="w-36 h-auto p-0 border-0 bg-transparent hover:bg-transparent focus:ring-0">
                <div className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200">
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 rounded-lg shadow-lg">
                <div className="p-3 border-b border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Sort By
                  </div>
                </div>
                <div className="p-2">
                  {sortOptions.map((option) => (
                    <SelectItem 
                      key={option.value} 
                      value={option.value}
                      className="px-3 py-2 hover:bg-gray-50 rounded-md cursor-pointer"
                    >
                      <span className="font-medium">{option.label}</span>
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}