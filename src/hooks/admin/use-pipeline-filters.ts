import { useState, useMemo } from 'react';
import { AdminConnectionRequest } from '@/types/admin';

export type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'on_hold';
export type BuyerTypeFilter = 'all' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'corporate' | 'individual' | 'independentSponsor' | 'advisor' | 'businessOwner';
export type SortOption = 'newest' | 'oldest' | 'buyer_priority' | 'deal_size' | 'approval_date';

export function usePipelineFilters(requests: AdminConnectionRequest[]) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [buyerTypeFilter, setBuyerTypeFilter] = useState<BuyerTypeFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // Buyer type priority mapping (higher number = higher priority)
  const getBuyerPriority = (buyerType: string | undefined): number => {
    switch (buyerType) {
      case 'privateEquity': return 6;
      case 'independentSponsor': return 5;
      case 'familyOffice': return 4;
      case 'corporate': return 3;
      case 'businessOwner': return 2;
      case 'individual': return 1;
      case 'advisor': return 1;
      default: return 0;
    }
  };

  const filteredAndSortedRequests = useMemo(() => {
    let filtered = requests;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }

    // Apply buyer type filter
    if (buyerTypeFilter !== 'all') {
      filtered = filtered.filter(request => request.user?.buyer_type === buyerTypeFilter);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        
        case 'buyer_priority': {
          const priorityA = getBuyerPriority(a.user?.buyer_type);
          const priorityB = getBuyerPriority(b.user?.buyer_type);
          if (priorityB !== priorityA) {
            return priorityB - priorityA; // Higher priority first
          }
          // If same priority, sort by newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }

        case 'deal_size': {
          const revenueA = a.listing?.revenue || 0;
          const revenueB = b.listing?.revenue || 0;
          if (revenueB !== revenueA) {
            return revenueB - revenueA; // Higher revenue first
          }
          // If same revenue, sort by newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        
        case 'approval_date':
          // Only consider approved requests for this sort
          if (a.status === 'approved' && b.status === 'approved') {
            const approvalA = a.approved_at ? new Date(a.approved_at).getTime() : 0;
            const approvalB = b.approved_at ? new Date(b.approved_at).getTime() : 0;
            return approvalB - approvalA; // Most recent approvals first
          }
          // If one is not approved, sort by status (approved first)
          if (a.status === 'approved' && b.status !== 'approved') return -1;
          if (b.status === 'approved' && a.status !== 'approved') return 1;
          // If neither approved, sort by newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return sorted;
  }, [requests, statusFilter, buyerTypeFilter, sortOption]);

  return {
    statusFilter,
    buyerTypeFilter,
    sortOption,
    filteredAndSortedRequests,
    setStatusFilter,
    setBuyerTypeFilter,
    setSortOption,
  };
}