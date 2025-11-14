import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MarketContextData {
  similarDealsCount: number;
  medianEbitdaMultiple: number | null;
  avgTimeToClose: number | null;
}

export function useMarketContext(listingId: string, category: string, revenue: number, ebitda: number) {
  return useQuery({
    queryKey: ['market-context', listingId, category],
    queryFn: async (): Promise<MarketContextData> => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Find similar deals (same category, similar revenue within 50%)
      const revenueMin = revenue * 0.5;
      const revenueMax = revenue * 1.5;

      const { data: similarListings } = await supabase
        .from('listings')
        .select('id, revenue, ebitda, created_at')
        .eq('category', category)
        .gte('revenue', revenueMin)
        .lte('revenue', revenueMax)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .neq('id', listingId)
        .eq('status', 'active');

      const similarDealsCount = similarListings?.length || 0;

      // Calculate median EBITDA multiple
      let medianEbitdaMultiple: number | null = null;
      if (similarListings && similarListings.length > 0) {
        const multiples = similarListings
          .filter(l => l.ebitda > 0)
          .map(l => l.revenue / l.ebitda)
          .sort((a, b) => a - b);

        if (multiples.length > 0) {
          const mid = Math.floor(multiples.length / 2);
          medianEbitdaMultiple = multiples.length % 2 === 0
            ? (multiples[mid - 1] + multiples[mid]) / 2
            : multiples[mid];
        }
      }

      // Calculate average time to close from connection requests that converted
      const { data: convertedRequests } = await supabase
        .from('connection_requests')
        .select('created_at, approved_at')
        .in('listing_id', similarListings?.map(l => l.id) || [])
        .eq('status', 'approved')
        .not('approved_at', 'is', null)
        .gte('created_at', ninetyDaysAgo.toISOString());

      let avgTimeToClose: number | null = null;
      if (convertedRequests && convertedRequests.length > 0) {
        const totalDays = convertedRequests.reduce((sum, req) => {
          const created = new Date(req.created_at);
          const approved = new Date(req.approved_at!);
          const days = Math.floor((approved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        avgTimeToClose = Math.round(totalDays / convertedRequests.length);
      }

      return {
        similarDealsCount,
        medianEbitdaMultiple,
        avgTimeToClose,
      };
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
