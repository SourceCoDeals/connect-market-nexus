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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  Clock, 
  XCircle,
  AlertTriangle,
  Users,
  DollarSign,
  Calendar,
  FileText,
  Shield,
  Search,
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";

export type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'on_hold';
export type BuyerTypeFilter = 'all' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'corporate' | 'individual' | 'independentSponsor' | 'advisor' | 'businessOwner';
export type NdaFilter = 'all' | 'signed' | 'not_signed' | 'sent';
export type FeeAgreementFilter = 'all' | 'signed' | 'not_signed' | 'sent';
export type SortOption = 'newest' | 'oldest' | 'buyer_priority' | 'deal_size' | 'approval_date';

interface PipelineFiltersProps {
  requests: AdminConnectionRequest[];
  statusFilter: StatusFilter;
  buyerTypeFilter: BuyerTypeFilter;
  ndaFilter: NdaFilter;
  feeAgreementFilter: FeeAgreementFilter;
  sortOption: SortOption;
  searchQuery: string;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onBuyerTypeFilterChange: (filter: BuyerTypeFilter) => void;
  onNdaFilterChange: (filter: NdaFilter) => void;
  onFeeAgreementFilterChange: (filter: FeeAgreementFilter) => void;
  onSortChange: (sort: SortOption) => void;
  onSearchChange: (query: string) => void;
}

function FilterDropdown({ 
  label, 
  icon: Icon, 
  value, 
  options, 
  onChange 
}: { 
  label: string; 
  icon: React.ElementType; 
  value: string; 
  options: { value: string; label: string; count?: number }[]; 
  onChange: (value: string) => void;
}) {
  const isFiltered = value !== 'all';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`
          flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-full
          ${isFiltered 
            ? "bg-primary/10 text-primary border border-primary/20" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }
        `}>
          <Icon className="h-3.5 w-3.5" />
          {label}
          {isFiltered && (
            <span className="text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
              {options.find(o => o.value === value)?.count ?? ''}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-56 bg-popover border border-border rounded-lg shadow-lg"
      >
        <div className="p-3 border-b border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </div>
        </div>
        <div className="p-2">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`
                w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors duration-200
                ${value === option.value 
                  ? "bg-primary text-primary-foreground" 
                  : "text-foreground hover:bg-muted"
                }
              `}
            >
              <span className="font-medium">{option.label}</span>
              {option.count !== undefined && (
                <span className={`
                  text-xs font-medium
                  ${value === option.value 
                    ? "text-primary-foreground/70" 
                    : "text-muted-foreground"
                  }
                `}>
                  {option.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PipelineFilters({
  requests,
  statusFilter,
  buyerTypeFilter,
  ndaFilter,
  feeAgreementFilter,
  sortOption,
  searchQuery,
  onStatusFilterChange,
  onBuyerTypeFilterChange,
  onNdaFilterChange,
  onFeeAgreementFilterChange,
  onSortChange,
  onSearchChange,
}: PipelineFiltersProps) {
  
  const statusCounts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    on_hold: requests.filter(r => r.status === 'on_hold').length,
  };

  const buyerTypeOptions = [
    { value: 'all', label: 'All Buyer Types', count: requests.length },
    { value: 'privateEquity', label: 'Private Equity', count: requests.filter(r => r.user?.buyer_type === 'privateEquity').length },
    { value: 'familyOffice', label: 'Family Office', count: requests.filter(r => r.user?.buyer_type === 'familyOffice').length },
    { value: 'searchFund', label: 'Search Fund', count: requests.filter(r => r.user?.buyer_type === 'searchFund').length },
    { value: 'corporate', label: 'Corporate', count: requests.filter(r => r.user?.buyer_type === 'corporate').length },
    { value: 'individual', label: 'Individual', count: requests.filter(r => r.user?.buyer_type === 'individual').length },
    { value: 'independentSponsor', label: 'Independent Sponsor', count: requests.filter(r => r.user?.buyer_type === 'independentSponsor').length },
    { value: 'advisor', label: 'Advisor / Banker', count: requests.filter(r => r.user?.buyer_type === 'advisor').length },
    { value: 'businessOwner', label: 'Business Owner', count: requests.filter(r => r.user?.buyer_type === 'businessOwner').length },
  ];

  const ndaOptions = [
    { value: 'all', label: 'All NDA Status' },
    { value: 'signed', label: 'NDA Signed', count: requests.filter(r => r.lead_nda_signed || r.user?.nda_signed).length },
    { value: 'sent', label: 'NDA Sent (Not Signed)', count: requests.filter(r => (r.lead_nda_email_sent || r.user?.nda_email_sent) && !(r.lead_nda_signed || r.user?.nda_signed)).length },
    { value: 'not_signed', label: 'NDA Not Signed', count: requests.filter(r => !(r.lead_nda_signed || r.user?.nda_signed)).length },
  ];

  const feeAgreementOptions = [
    { value: 'all', label: 'All Fee Agreement Status' },
    { value: 'signed', label: 'Fee Agreement Signed', count: requests.filter(r => r.lead_fee_agreement_signed || r.user?.fee_agreement_signed).length },
    { value: 'sent', label: 'Fee Sent (Not Signed)', count: requests.filter(r => (r.lead_fee_agreement_email_sent || r.user?.fee_agreement_email_sent) && !(r.lead_fee_agreement_signed || r.user?.fee_agreement_signed)).length },
    { value: 'not_signed', label: 'Fee Not Signed', count: requests.filter(r => !(r.lead_fee_agreement_signed || r.user?.fee_agreement_signed)).length },
  ];

  const statusDropdownOptions = [
    { value: 'all', label: 'All Statuses', count: statusCounts.all },
    { value: 'pending', label: 'Pending', count: statusCounts.pending },
    { value: 'approved', label: 'Approved', count: statusCounts.approved },
    { value: 'rejected', label: 'Rejected', count: statusCounts.rejected },
    { value: 'on_hold', label: 'On Hold', count: statusCounts.on_hold },
  ];

  const statusOptions = [
    { value: 'all', label: 'All Requests', icon: Users, count: statusCounts.all },
    { value: 'pending', label: 'Pending', icon: Clock, count: statusCounts.pending },
    { value: 'approved', label: 'Approved', icon: CheckCircle2, count: statusCounts.approved },
    { value: 'rejected', label: 'Rejected', icon: XCircle, count: statusCounts.rejected },
    { value: 'on_hold', label: 'On Hold', icon: AlertTriangle, count: statusCounts.on_hold },
  ] as const;

  const sortOptions = [
    { value: 'newest', label: 'Newest First', icon: Calendar },
    { value: 'oldest', label: 'Oldest First', icon: Calendar },
    { value: 'buyer_priority', label: 'Buyer Priority', icon: Users },
    { value: 'deal_size', label: 'Deal Size', icon: DollarSign },
    { value: 'approval_date', label: 'Approval Date', icon: CheckCircle2 },
  ] as const;

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-6 py-4">
        {/* Top row: Search + Sort */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search requests..."
              className="pl-10 h-9 bg-background border-border/60"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border rounded-lg shadow-lg">
              <div className="p-3 border-b border-border">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Sort By
                </div>
              </div>
              <div className="p-2">
                {sortOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="px-3 py-2 hover:bg-muted rounded-md cursor-pointer"
                  >
                    <span className="font-medium">{option.label}</span>
                  </SelectItem>
                ))}
              </div>
            </SelectContent>
          </Select>
        </div>

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
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }
                  `}
                >
                  {option.label}
                  {option.count > 0 && (
                    <span className={`
                      ml-2 text-xs font-medium
                      ${isActive 
                        ? "text-primary-foreground/70" 
                        : "text-muted-foreground"
                      }
                    `}>
                      {option.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filters Row */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
          <FilterDropdown
            label="Buyer Type"
            icon={Users}
            value={buyerTypeFilter}
            options={buyerTypeOptions}
            onChange={(v) => onBuyerTypeFilterChange(v as BuyerTypeFilter)}
          />
          <FilterDropdown
            label="NDA"
            icon={Shield}
            value={ndaFilter}
            options={ndaOptions}
            onChange={(v) => onNdaFilterChange(v as NdaFilter)}
          />
          <FilterDropdown
            label="Fee Agreement"
            icon={FileText}
            value={feeAgreementFilter}
            options={feeAgreementOptions}
            onChange={(v) => onFeeAgreementFilterChange(v as FeeAgreementFilter)}
          />
          <FilterDropdown
            label="Status"
            icon={CheckCircle2}
            value={statusFilter}
            options={statusDropdownOptions}
            onChange={(v) => onStatusFilterChange(v as StatusFilter)}
          />
        </div>
      </div>
    </div>
  );
}
