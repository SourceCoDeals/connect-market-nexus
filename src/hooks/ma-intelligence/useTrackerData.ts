import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MATracker {
  id: string;
  user_id: string | null;
  industry_name: string;
  description: string | null;
  is_active: boolean | null;
  is_archived: boolean | null;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export interface MABuyer {
  id: string;
  tracker_id: string;
  pe_firm_name: string;
  [key: string]: any;
}

export interface MADeal {
  id: string;
  tracker_id: string;
  deal_name: string;
  [key: string]: any;
}

export interface DealBuyerCounts {
  approved: number;
  interested: number;
  passed: number;
}

export interface UseTrackerDataResult {
  tracker: MATracker | null;
  buyers: MABuyer[];
  deals: MADeal[];
  dealBuyerCounts: Record<string, DealBuyerCounts>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTrackerData(trackerId: string | undefined): UseTrackerDataResult {
  const [tracker, setTracker] = useState<MATracker | null>(null);
  const [buyers, setBuyers] = useState<MABuyer[]>([]);
  const [deals, setDeals] = useState<MADeal[]>([]);
  const [dealBuyerCounts, setDealBuyerCounts] = useState<Record<string, DealBuyerCounts>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    if (!trackerId) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      // Query industry_trackers - the schema may differ, so we adapt
      const { data: trackerData, error: trackerError } = await supabase
        .from('industry_trackers')
        .select('*')
        .eq('id', trackerId)
        .single();

      if (trackerError) throw trackerError;

      // Map to MATracker interface - adapt to actual schema
      const rawTracker = trackerData as any;
      const mappedTracker: MATracker = {
        id: rawTracker.id,
        user_id: rawTracker.user_id ?? null,
        industry_name: rawTracker.name || rawTracker.industry_name || 'Unknown',
        description: rawTracker.description ?? null,
        is_active: rawTracker.is_active ?? true,
        is_archived: !rawTracker.is_active, // Derive from is_active
        created_at: rawTracker.created_at,
        updated_at: rawTracker.updated_at,
        ...rawTracker,
      };
      setTracker(mappedTracker);

      // Fetch buyers using remarketing_buyers table
      const { data: buyersData } = await supabase
        .from('remarketing_buyers')
        .select('*')
        .eq('industry_tracker_id', trackerId)
        .order('company_name');

      // Map to MABuyer interface
      const mappedBuyers: MABuyer[] = (buyersData || []).map((b: any) => ({
        id: b.id,
        tracker_id: b.industry_tracker_id || trackerId,
        pe_firm_name: b.company_name || b.pe_firm_name || 'Unknown',
        ...b,
      }));
      setBuyers(mappedBuyers);

      // Fetch deals scoped to this tracker
      const { data: dealsData } = await supabase
        .from('deals')
        .select('*')
        .eq('listing_id', trackerId)
        .order('created_at', { ascending: false });

      // Map to MADeal interface
      const mappedDeals: MADeal[] = (dealsData || []).map((d: any) => ({
        id: d.id,
        tracker_id: d.listing_id || d.tracker_id || '',
        deal_name: d.contact_name || d.deal_name || 'Unknown Deal',
        ...d,
      }));
      setDeals(mappedDeals);

      // Fetch buyer counts for each deal using remarketing_scores
      if (dealsData && dealsData.length > 0) {
        const dealIds = dealsData.map((d: any) => d.id);
        const { data: scores } = await supabase
          .from('remarketing_scores')
          .select('listing_id, status')
          .in('listing_id', dealIds);

        if (scores) {
          const counts: Record<string, DealBuyerCounts> = {};
          dealIds.forEach((dealId: string) => {
            const dealScores = (scores as any[]).filter(s => s.listing_id === dealId);
            counts[dealId] = {
              approved: dealScores.filter(s => s.status === 'approved').length,
              interested: dealScores.filter(s => s.status === 'interested').length,
              passed: dealScores.filter(s => s.status === 'passed').length,
            };
          });
          setDealBuyerCounts(counts);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load tracker data'));
    } finally {
      setIsLoading(false);
    }
  }, [trackerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    tracker,
    buyers,
    deals,
    dealBuyerCounts,
    isLoading,
    error,
    refetch: loadData,
  };
}
