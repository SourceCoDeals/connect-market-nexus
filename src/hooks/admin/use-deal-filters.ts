import { useMemo, useState } from 'react';
import { Deal } from './use-deals';

export type DealStatusFilter = 'all' | 'new_inquiry' | 'approved' | 'info_sent' | 'buyer_seller_call' | 'due_diligence' | 'loi_submitted' | 'closed';
export type BuyerTypeFilter = 'all' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'corporate' | 'individual' | 'independentSponsor' | 'advisor' | 'businessOwner';
export type ListingFilter = 'all' | string;
export type CompanyFilter = string[]; // Changed to array for multiselect
export type AdminFilter = 'all' | 'unassigned' | 'assigned_to_me' | string;
export type DocumentStatusFilter = 'all' | 'nda_signed' | 'fee_signed' | 'both_signed' | 'none_signed' | 'overdue_followup';
export type DateRangeFilter = { start: Date | null; end: Date | null };
export type SortOption = 'newest' | 'oldest' | 'priority' | 'value' | 'probability' | 'stage_entered' | 'last_activity';

export function useDealFilters(deals: Deal[], currentAdminId?: string) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DealStatusFilter>('all');
  const [buyerTypeFilter, setBuyerTypeFilter] = useState<BuyerTypeFilter>('all');
  const [listingFilter, setListingFilter] = useState<ListingFilter>('all');
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>([]);
  const [adminFilter, setAdminFilter] = useState<AdminFilter>('all');
  const [documentStatusFilter, setDocumentStatusFilter] = useState<DocumentStatusFilter>('all');
  const [createdDateRange, setCreatedDateRange] = useState<DateRangeFilter>({ start: null, end: null });
  const [lastActivityRange, setLastActivityRange] = useState<DateRangeFilter>({ start: null, end: null });
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  const filteredAndSortedDeals = useMemo(() => {
    let filtered = deals;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(deal => 
        deal.deal_title?.toLowerCase().includes(query) ||
        deal.listing_title?.toLowerCase().includes(query) ||
        deal.buyer_name?.toLowerCase().includes(query) ||
        deal.buyer_company?.toLowerCase().includes(query) ||
        deal.contact_name?.toLowerCase().includes(query) ||
        deal.contact_email?.toLowerCase().includes(query)
      );
    }

    // Status filter - updated for new stages
    if (statusFilter !== 'all') {
      switch (statusFilter) {
        case 'new_inquiry':
          filtered = filtered.filter(d => d.stage_name === 'New Inquiry');
          break;
        case 'approved':
          filtered = filtered.filter(d => d.stage_name === 'Approved');
          break;
        case 'info_sent':
          filtered = filtered.filter(d => d.stage_name === 'Info Sent');
          break;
        case 'buyer_seller_call':
          filtered = filtered.filter(d => d.stage_name === 'Buyer/Seller Call');
          break;
        case 'due_diligence':
          filtered = filtered.filter(d => d.stage_name === 'Due Diligence');
          break;
        case 'loi_submitted':
          filtered = filtered.filter(d => d.stage_name === 'LOI Submitted');
          break;
        case 'closed':
          filtered = filtered.filter(d => d.stage_name && ['Closed Won', 'Closed Lost'].includes(d.stage_name));
          break;
      }
    }

    // Buyer type filter
    if (buyerTypeFilter !== 'all') {
      filtered = filtered.filter(d => d.buyer_type === buyerTypeFilter);
    }

    // Listing filter
    if (listingFilter !== 'all') {
      filtered = filtered.filter(d => d.listing_id === listingFilter);
    }

    // Company filter (multi-select)
    if (companyFilter.length > 0) {
      filtered = filtered.filter(d => {
        const buyerCompany = d.buyer_company?.toLowerCase();
        const contactCompany = d.contact_company?.toLowerCase();
        return companyFilter.some(company => 
          buyerCompany === company.toLowerCase() || 
          contactCompany === company.toLowerCase()
        );
      });
    }

    // Admin filter - enhanced with 'assigned_to_me'
    if (adminFilter !== 'all') {
      if (adminFilter === 'unassigned') {
        filtered = filtered.filter(d => !d.assigned_to);
      } else if (adminFilter === 'assigned_to_me' && currentAdminId) {
        filtered = filtered.filter(d => d.assigned_to === currentAdminId);
      } else {
        filtered = filtered.filter(d => d.assigned_to === adminFilter);
      }
    }

    // Created date range filter
    if (createdDateRange.start || createdDateRange.end) {
      filtered = filtered.filter(d => {
        const createdDate = new Date(d.deal_created_at);
        if (createdDateRange.start && createdDate < createdDateRange.start) return false;
        if (createdDateRange.end && createdDate > createdDateRange.end) return false;
        return true;
      });
    }

    // Last activity date range filter
    if (lastActivityRange.start || lastActivityRange.end) {
      filtered = filtered.filter(d => {
        const activityDate = new Date(d.deal_updated_at);
        if (lastActivityRange.start && activityDate < lastActivityRange.start) return false;
        if (lastActivityRange.end && activityDate > lastActivityRange.end) return false;
        return true;
      });
    }

    // Document status filter
    if (documentStatusFilter !== 'all') {
      switch (documentStatusFilter) {
        case 'both_signed':
          filtered = filtered.filter(d => d.nda_status === 'signed' && d.fee_agreement_status === 'signed');
          break;
        case 'nda_signed':
          filtered = filtered.filter(d => d.nda_status === 'signed' && d.fee_agreement_status !== 'signed');
          break;
        case 'fee_signed':
          filtered = filtered.filter(d => d.fee_agreement_status === 'signed' && d.nda_status !== 'signed');
          break;
        case 'none_signed':
          filtered = filtered.filter(d => d.nda_status !== 'signed' && d.fee_agreement_status !== 'signed');
          break;
        case 'overdue_followup':
          filtered = filtered.filter(d => d.followup_overdue === true);
          break;
      }
    }

    // Sorting - added last_activity option
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.deal_created_at).getTime() - new Date(a.deal_created_at).getTime();
        case 'oldest':
          return new Date(a.deal_created_at).getTime() - new Date(b.deal_created_at).getTime();
        case 'priority':
          return (b.buyer_priority_score || 0) - (a.buyer_priority_score || 0);
        case 'value':
          return b.deal_value - a.deal_value;
        case 'probability':
          return b.deal_probability - a.deal_probability;
        case 'stage_entered':
          return new Date(b.deal_stage_entered_at).getTime() - new Date(a.deal_stage_entered_at).getTime();
        case 'last_activity':
          return new Date(b.deal_updated_at).getTime() - new Date(a.deal_updated_at).getTime();
        default:
          return 0;
      }
    });

    return sorted;
  }, [deals, searchQuery, statusFilter, buyerTypeFilter, listingFilter, companyFilter, adminFilter, documentStatusFilter, createdDateRange, lastActivityRange, sortOption, currentAdminId]);

  // Get unique companies for filter dropdown with listing title context
  const uniqueCompanies = useMemo(() => {
    const companiesMap = new Map<string, { label: string; value: string }>();
    
    deals.forEach(deal => {
      const companyName = deal.buyer_company || deal.contact_company;
      const listingTitle = deal.listing_title;
      
      if (companyName) {
        const displayLabel = listingTitle 
          ? `${listingTitle} / ${companyName}`
          : companyName;
        
        // Use company name as the value for filtering
        if (!companiesMap.has(companyName)) {
          companiesMap.set(companyName, {
            label: displayLabel,
            value: companyName
          });
        }
      }
    });
    
    return Array.from(companiesMap.values()).sort((a, b) => 
      a.label.localeCompare(b.label)
    );
  }, [deals]);

  // Get unique listings for filter dropdown
  const uniqueListings = useMemo(() => {
    const listings = new Map<string, string>();
    deals.forEach(deal => {
      if (deal.listing_id && deal.listing_title) {
        listings.set(deal.listing_id, deal.listing_title);
      }
    });
    return Array.from(listings.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [deals]);

  return {
    searchQuery,
    statusFilter,
    buyerTypeFilter,
    listingFilter,
    companyFilter,
    adminFilter,
    documentStatusFilter,
    createdDateRange,
    lastActivityRange,
    sortOption,
    filteredAndSortedDeals,
    uniqueCompanies,
    uniqueListings,
    setSearchQuery,
    setStatusFilter,
    setBuyerTypeFilter,
    setListingFilter,
    setCompanyFilter,
    setAdminFilter,
    setDocumentStatusFilter,
    setCreatedDateRange,
    setLastActivityRange,
    setSortOption,
  };
}