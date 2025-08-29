import { useMemo } from 'react';
import { Deal } from '@/hooks/admin/use-deals';

interface PipelineMetrics {
  totalDeals: number;
  totalValue: number;
  weightedValue: number;
  closedWonValue: number;
  newDealsThisMonth: number;
  avgDealAge: number;
  avgDealSize: number;
  avgProbability: number;
  conversionRate: number;
}

export function usePipelineMetrics(deals: Deal[]): PipelineMetrics {
  return useMemo(() => {
    if (!deals || deals.length === 0) {
      return {
        totalDeals: 0,
        totalValue: 0,
        weightedValue: 0,
        closedWonValue: 0,
        newDealsThisMonth: 0,
        avgDealAge: 0,
        avgDealSize: 0,
        avgProbability: 0,
        conversionRate: 0,
      };
    }

    const totalDeals = deals.length;
    const totalValue = deals.reduce((sum, deal) => sum + deal.deal_value, 0);
    const weightedValue = deals.reduce((sum, deal) => sum + (deal.deal_value * deal.deal_probability / 100), 0);
    
    // Since there's no deal_status field, we'll use fee_agreement_status as proxy for closed deals
    const closedWonDeals = deals.filter(deal => deal.fee_agreement_status === 'signed');
    const closedWonValue = closedWonDeals.reduce((sum, deal) => sum + deal.deal_value, 0);
    
    // Calculate new deals this month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const newDealsThisMonth = deals.filter(deal => {
      const dealDate = new Date(deal.deal_created_at);
      return dealDate.getMonth() === currentMonth && dealDate.getFullYear() === currentYear;
    }).length;

    // Calculate average deal age in days
    const avgDealAge = deals.reduce((sum, deal) => {
      const dealDate = new Date(deal.deal_created_at);
      const daysDiff = Math.floor((currentDate.getTime() - dealDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + daysDiff;
    }, 0) / totalDeals;

    const avgDealSize = totalValue / totalDeals;
    const avgProbability = deals.reduce((sum, deal) => sum + deal.deal_probability, 0) / totalDeals;
    
    // Calculate conversion rate (closed won / total deals)
    const conversionRate = (closedWonDeals.length / totalDeals) * 100;

    return {
      totalDeals,
      totalValue,
      weightedValue,
      closedWonValue,
      newDealsThisMonth,
      avgDealAge: Math.round(avgDealAge),
      avgDealSize,
      avgProbability,
      conversionRate,
    };
  }, [deals]);
}