import { useMemo, useState } from 'react';
import { Deal } from './use-deals';

export type DealStatusFilter = 'all' | 'new_inquiry' | 'qualified' | 'due_diligence' | 'under_contract' | 'closed';
export type BuyerTypeFilter = 'all' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'corporate' | 'individual' | 'independentSponsor' | 'advisor' | 'businessOwner';
export type ListingFilter = 'all' | string;
export type AdminFilter = 'all' | 'unassigned' | string;
export type DocumentStatusFilter = 'all' | 'nda_signed' | 'fee_signed' | 'both_signed' | 'none_signed' | 'overdue_followup';
export type SortOption = 'newest' | 'oldest' | 'priority' | 'value' | 'probability' | 'stage_entered';

export function useDealFilters(deals: Deal[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DealStatusFilter>('all');
  const [buyerTypeFilter, setBuyerTypeFilter] = useState<BuyerTypeFilter>('all');
  const [listingFilter, setListingFilter] = useState<ListingFilter>('all');
  const [adminFilter, setAdminFilter] = useState<AdminFilter>('all');
  const [documentStatusFilter, setDocumentStatusFilter] = useState<DocumentStatusFilter>('all');
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

    // Status filter
    if (statusFilter !== 'all') {
      switch (statusFilter) {
        case 'new_inquiry':
          filtered = filtered.filter(d => d.stage_name === 'New Inquiry');
          break;
        case 'qualified':
          filtered = filtered.filter(d => d.stage_name === 'Qualified');
          break;
        case 'due_diligence':
          filtered = filtered.filter(d => d.stage_name === 'Due Diligence');
          break;
        case 'under_contract':
          filtered = filtered.filter(d => d.stage_name === 'Under Contract');
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

    // Admin filter
    if (adminFilter !== 'all') {
      if (adminFilter === 'unassigned') {
        filtered = filtered.filter(d => !d.assigned_to);
      } else {
        filtered = filtered.filter(d => d.assigned_to === adminFilter);
      }
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

    // Sorting
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
        default:
          return 0;
      }
    });

    return sorted;
  }, [deals, searchQuery, statusFilter, buyerTypeFilter, listingFilter, adminFilter, documentStatusFilter, sortOption]);

  return {
    searchQuery,
    statusFilter,
    buyerTypeFilter,
    listingFilter,
    adminFilter,
    documentStatusFilter,
    sortOption,
    filteredAndSortedDeals,
    setSearchQuery,
    setStatusFilter,
    setBuyerTypeFilter,
    setListingFilter,
    setAdminFilter,
    setDocumentStatusFilter,
    setSortOption,
  };
}