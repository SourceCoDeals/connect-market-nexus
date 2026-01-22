import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReMarketingBadgeProps {
  listingId: string;
  className?: string;
  showEmpty?: boolean;
}

/**
 * Displays the best matching tier and count for a listing
 */
export function ReMarketingBadge({ listingId, className, showEmpty = false }: ReMarketingBadgeProps) {
  const { data: matchData, isLoading } = useQuery({
    queryKey: ['remarketing-badge', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('tier, status')
        .eq('listing_id', listingId)
        .in('status', ['pending', 'approved']);

      if (error) throw error;

      const scores = data || [];
      const tierCounts = {
        A: scores.filter(s => s.tier === 'A').length,
        B: scores.filter(s => s.tier === 'B').length,
        C: scores.filter(s => s.tier === 'C').length,
        D: scores.filter(s => s.tier === 'D').length,
      };

      const totalMatches = scores.length;
      const bestTier = tierCounts.A > 0 ? 'A' : 
                       tierCounts.B > 0 ? 'B' : 
                       tierCounts.C > 0 ? 'C' : 
                       tierCounts.D > 0 ? 'D' : null;

      return { tierCounts, totalMatches, bestTier };
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  if (isLoading) return null;
  
  if (!matchData?.totalMatches) {
    if (!showEmpty) return null;
    return (
      <Badge variant="outline" className={cn("text-xs gap-1", className)}>
        <Sparkles className="h-3 w-3" />
        No matches
      </Badge>
    );
  }

  const { bestTier, tierCounts, totalMatches } = matchData;

  const tierStyles = {
    A: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    B: 'bg-blue-100 text-blue-800 border-blue-200',
    C: 'bg-amber-100 text-amber-800 border-amber-200',
    D: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const tierCount = bestTier ? tierCounts[bestTier as keyof typeof tierCounts] : 0;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-xs gap-1 font-medium",
        bestTier && tierStyles[bestTier as keyof typeof tierStyles],
        className
      )}
    >
      <Sparkles className="h-3 w-3" />
      {tierCount} Tier {bestTier}
      {totalMatches > tierCount && (
        <span className="text-muted-foreground">+{totalMatches - tierCount}</span>
      )}
    </Badge>
  );
}

export default ReMarketingBadge;
