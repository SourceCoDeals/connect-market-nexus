import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search,
  SortAsc,
  MoreHorizontal,
  Building2,
  Users,
  ShieldCheck
} from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';

export type DealStatusFilter = 'all' | 'new_inquiry' | 'qualified' | 'due_diligence' | 'under_contract' | 'closed';
export type BuyerTypeFilter = 'all' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'corporate' | 'individual' | 'independentSponsor' | 'advisor' | 'businessOwner';
export type ListingFilter = 'all' | string;
export type AdminFilter = 'all' | 'unassigned' | string;
export type DocumentStatusFilter = 'all' | 'nda_signed' | 'fee_signed' | 'both_signed' | 'none_signed' | 'overdue_followup';
export type SortOption = 'newest' | 'oldest' | 'priority' | 'value' | 'probability' | 'stage_entered';

interface FilterBarProps {
  deals: Deal[];
  searchQuery: string;
  statusFilter: DealStatusFilter;
  buyerTypeFilter: BuyerTypeFilter;
  listingFilter: ListingFilter;
  adminFilter: AdminFilter;
  documentStatusFilter: DocumentStatusFilter;
  sortOption: SortOption;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (filter: DealStatusFilter) => void;
  onBuyerTypeFilterChange: (filter: BuyerTypeFilter) => void;
  onListingFilterChange: (filter: ListingFilter) => void;
  onAdminFilterChange: (filter: AdminFilter) => void;
  onDocumentStatusFilterChange: (filter: DocumentStatusFilter) => void;
  onSortChange: (sort: SortOption) => void;
}

export function FilterBar({
  deals,
  searchQuery,
  statusFilter,
  buyerTypeFilter,
  listingFilter,
  adminFilter,
  documentStatusFilter,
  sortOption,
  onSearchChange,
  onStatusFilterChange,
  onBuyerTypeFilterChange,
  onListingFilterChange,
  onAdminFilterChange,
  onDocumentStatusFilterChange,
  onSortChange
}: FilterBarProps) {
  
  // Calculate counts for different filters
  const statusCounts = {
    all: deals.length,
    new_inquiry: deals.filter(d => d.stage_name === 'New Inquiry').length,
    qualified: deals.filter(d => d.stage_name === 'Qualified').length,
    due_diligence: deals.filter(d => d.stage_name === 'Due Diligence').length,
    under_contract: deals.filter(d => d.stage_name === 'Under Contract').length,
    closed: deals.filter(d => ['Closed Won', 'Closed Lost'].includes(d.stage_name)).length,
  };

  const buyerTypeCounts = {
    all: deals.length,
    privateEquity: deals.filter(d => d.buyer_type === 'privateEquity').length,
    familyOffice: deals.filter(d => d.buyer_type === 'familyOffice').length,
    searchFund: deals.filter(d => d.buyer_type === 'searchFund').length,
    corporate: deals.filter(d => d.buyer_type === 'corporate').length,
    individual: deals.filter(d => d.buyer_type === 'individual').length,
    independentSponsor: deals.filter(d => d.buyer_type === 'independentSponsor').length,
    advisor: deals.filter(d => d.buyer_type === 'advisor').length,
    businessOwner: deals.filter(d => d.buyer_type === 'businessOwner').length,
  };

  // Get unique listings and admins for filter options
  const uniqueListings = Array.from(new Set(deals.map(d => ({ id: d.listing_id, title: d.listing_title }))))
    .filter(l => l.id && l.title);
  
  const uniqueAdmins = Array.from(new Set(deals.map(d => ({ id: d.assigned_to, name: d.assigned_admin_name }))))
    .filter(a => a.id && a.name);

  const statusOptions = [
    { value: 'all', label: 'All', count: statusCounts.all },
    { value: 'new_inquiry', label: 'Active', count: statusCounts.new_inquiry },
    { value: 'qualified', label: 'Qualified', count: statusCounts.qualified },
    { value: 'due_diligence', label: 'Due Diligence', count: statusCounts.due_diligence },
    { value: 'under_contract', label: 'Under Contract', count: statusCounts.under_contract },
    { value: 'closed', label: 'Closed', count: statusCounts.closed },
  ] as const;

  const buyerTypeOptions = [
    { value: 'all', label: 'All Types', count: buyerTypeCounts.all },
    { value: 'privateEquity', label: 'Private Equity', count: buyerTypeCounts.privateEquity },
    { value: 'familyOffice', label: 'Family Office', count: buyerTypeCounts.familyOffice },
    { value: 'searchFund', label: 'Search Fund', count: buyerTypeCounts.searchFund },
    { value: 'corporate', label: 'Corporate', count: buyerTypeCounts.corporate },
    { value: 'individual', label: 'Individual', count: buyerTypeCounts.individual },
    { value: 'independentSponsor', label: 'Independent Sponsor', count: buyerTypeCounts.independentSponsor },
    { value: 'advisor', label: 'Advisor', count: buyerTypeCounts.advisor },
    { value: 'businessOwner', label: 'Business Owner', count: buyerTypeCounts.businessOwner },
  ] as const;

  const documentStatusOptions = [
    { value: 'all', label: 'All Documents' },
    { value: 'both_signed', label: 'Both Signed' },
    { value: 'nda_signed', label: 'NDA Only' },
    { value: 'fee_signed', label: 'Fee Only' },
    { value: 'none_signed', label: 'None Signed' },
    { value: 'overdue_followup', label: 'Overdue' },
  ] as const;

  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'value', label: 'Value' },
    { value: 'probability', label: 'Probability' },
  ] as const;

  return (
    <div className="h-9 flex items-center gap-3 px-4 border-b border-border/20 bg-background/50">
      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground/70" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 pl-8 text-xs border-border/40 bg-background/60 focus:bg-background"
        />
      </div>

      {/* Status Pills */}
      <div className="flex items-center gap-1">
        {statusOptions.map((option) => {
          const isActive = statusFilter === option.value;
          return (
            <Button
              key={option.value}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => onStatusFilterChange(option.value as DealStatusFilter)}
              className={`h-7 px-2.5 text-xs font-medium ${
                isActive 
                  ? "bg-foreground text-background" 
                  : "hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              {option.label}
              {option.count > 0 && (
                <span className={`ml-1.5 text-xs ${
                  isActive ? "text-background/70" : "text-muted-foreground/70"
                }`}>
                  {option.count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Advanced Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
              <MoreHorizontal className="h-3 w-3 mr-1" />
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs">Advanced Filters</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Buyer Type submenu would go here */}
            <div className="p-2 space-y-2">
              <Select value={buyerTypeFilter} onValueChange={onBuyerTypeFilterChange}>
                <SelectTrigger className="h-7 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    <SelectValue placeholder="Buyer Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {buyerTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label} ({option.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={adminFilter} onValueChange={onAdminFilterChange}>
                <SelectTrigger className="h-7 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    <SelectValue placeholder="Admin" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Admins</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {uniqueAdmins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id || ''}>
                      {admin.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={documentStatusFilter} onValueChange={onDocumentStatusFilterChange}>
                <SelectTrigger className="h-7 text-xs">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" />
                    <SelectValue placeholder="Documents" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {documentStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
          <SelectTrigger className="w-28 h-7 text-xs border-border/40">
            <div className="flex items-center gap-1.5">
              <SortAsc className="h-3 w-3" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}