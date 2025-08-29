import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Search,
  SortAsc, 
  CheckCircle2, 
  Clock, 
  XCircle,
  AlertTriangle,
  Users,
  Building2,
  DollarSign,
  Calendar,
  FileCheck,
  ShieldCheck,
  Target
} from "lucide-react";
import { Deal } from "@/hooks/admin/use-deals";

export type DealStatusFilter = 'all' | 'new_inquiry' | 'qualified' | 'due_diligence' | 'under_contract' | 'closed';
export type BuyerTypeFilter = 'all' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'corporate' | 'individual' | 'independentSponsor' | 'advisor' | 'businessOwner';
export type ListingFilter = 'all' | string; // listing ID
export type AdminFilter = 'all' | 'unassigned' | string; // admin ID
export type DocumentStatusFilter = 'all' | 'nda_signed' | 'fee_signed' | 'both_signed' | 'none_signed' | 'overdue_followup';
export type SortOption = 'newest' | 'oldest' | 'priority' | 'value' | 'probability' | 'stage_entered';

interface DealFiltersProps {
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

export function DealFilters({
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
}: DealFiltersProps) {
  
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
    { value: 'all', label: 'All Deals', icon: Target, count: statusCounts.all },
    { value: 'new_inquiry', label: 'New Inquiry', icon: Clock, count: statusCounts.new_inquiry },
    { value: 'qualified', label: 'Qualified', icon: CheckCircle2, count: statusCounts.qualified },
    { value: 'due_diligence', label: 'Due Diligence', icon: AlertTriangle, count: statusCounts.due_diligence },
    { value: 'under_contract', label: 'Under Contract', icon: FileCheck, count: statusCounts.under_contract },
    { value: 'closed', label: 'Closed', icon: XCircle, count: statusCounts.closed },
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

  const documentStatusOptions = [
    { value: 'all', label: 'All Documents' },
    { value: 'both_signed', label: 'NDA & Fee Signed' },
    { value: 'nda_signed', label: 'NDA Signed Only' },
    { value: 'fee_signed', label: 'Fee Signed Only' },
    { value: 'none_signed', label: 'No Documents' },
    { value: 'overdue_followup', label: 'Overdue Follow-up' },
  ] as const;

  const sortOptions = [
    { value: 'newest', label: 'Newest First', icon: Calendar },
    { value: 'oldest', label: 'Oldest First', icon: Calendar },
    { value: 'priority', label: 'Buyer Priority', icon: Users },
    { value: 'value', label: 'Deal Value', icon: DollarSign },
    { value: 'probability', label: 'Probability', icon: Target },
    { value: 'stage_entered', label: 'Stage Entry', icon: Clock },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Responsive Primary Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 py-4 px-6 bg-background border border-border/50 rounded-lg shadow-sm">
        {/* Left Side - Search & Quick Filters */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Responsive Search */}
          <div className="relative min-w-64 max-w-80 flex-shrink">
            <Input
              placeholder="Search deals, buyers, listings..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-4 pr-4 border-border/50 bg-background focus:border-primary/50 focus:ring-0 transition-all"
            />
          </div>

          {/* Responsive Status Filters */}
          <div className="flex items-center gap-2 overflow-hidden">
            {statusOptions.slice(0, 4).map((option) => {
              const isActive = statusFilter === option.value;
              
              return (
                <Button
                  key={option.value}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onStatusFilterChange(option.value as DealStatusFilter)}
                  className={`h-9 px-3 text-sm font-medium whitespace-nowrap transition-all ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <span className="hidden sm:inline">{option.label}</span>
                  <span className="sm:hidden">{option.label.split(' ')[0]}</span>
                  {option.count > 0 && (
                    <span className={`ml-1.5 text-xs ${
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}>
                      {option.count}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Right Side - Advanced Filters & Sort */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Listing Filter */}
          <Select value={listingFilter} onValueChange={onListingFilterChange}>
            <SelectTrigger className="w-32 lg:w-40 h-9 border-border/50 bg-background text-sm">
              <SelectValue placeholder="Listings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Listings</SelectItem>
              {uniqueListings.map((listing) => (
                <SelectItem key={listing.id} value={listing.id}>
                  {listing.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Admin Filter */}
          <Select value={adminFilter} onValueChange={onAdminFilterChange}>
            <SelectTrigger className="w-28 lg:w-32 h-9 border-border/50 bg-background text-sm">
              <SelectValue placeholder="Admins" />
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

          {/* Buyer Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 px-2.5 text-sm text-muted-foreground hover:text-foreground border border-border/50 whitespace-nowrap">
                <span className="hidden sm:inline">Buyer Type</span>
                <span className="sm:hidden">Buyers</span>
                {buyerTypeFilter !== 'all' && (
                  <span className="ml-1.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {buyerTypeCounts[buyerTypeFilter as keyof typeof buyerTypeCounts]}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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
                  <span className="text-xs text-muted-foreground">
                    {option.count}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Document Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 px-2.5 text-sm text-muted-foreground hover:text-foreground border border-border/50 whitespace-nowrap">
                <span className="hidden lg:inline">Documents</span>
                <span className="lg:hidden">Docs</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Document Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {documentStatusOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={documentStatusFilter === option.value}
                  onCheckedChange={() => onDocumentStatusFilterChange(option.value as DocumentStatusFilter)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clean Sort */}
          <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
            <SelectTrigger className="w-24 lg:w-32 h-9 border-border/50 bg-background text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}