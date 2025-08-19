import { AdminConnectionRequest } from '@/types/admin';

export interface FinancialMetric {
  label: string;
  value: string;
  icon?: string;
}

// Helper function to check if a field has meaningful data
const hasValue = (value: any): boolean => {
  return value && 
         value !== '' && 
         value !== 'NA' && 
         value !== 'null' && 
         value !== 'undefined' &&
         String(value).trim() !== '';
};

// Get the most relevant financial metrics for each buyer type
export const getFinancialMetricsForBuyerType = (user: any): FinancialMetric[] => {
  if (!user?.buyer_type) return [];

  const metrics: FinancialMetric[] = [];
  
  if (user.buyer_type === 'privateEquity' || user.buyer_type.includes('privateEquity')) {
    // Private Equity - AUM, Fund Size, Check Size
    if (hasValue(user.aum)) {
      metrics.push({ label: 'AUM', value: user.aum, icon: '💰' });
    }
    if (hasValue(user.fund_size)) {
      metrics.push({ label: 'Fund', value: user.fund_size, icon: '🏦' });
    }
    if (hasValue(user.investment_size)) {
      metrics.push({ label: 'Check', value: user.investment_size, icon: '💳' });
    }
  } else if (user.buyer_type === 'familyOffice' || user.buyer_type.includes('familyOffice')) {
    // Family Office - AUM, Check Size, Fund Size
    if (hasValue(user.aum)) {
      metrics.push({ label: 'AUM', value: user.aum, icon: '💰' });
    }
    if (hasValue(user.investment_size)) {
      metrics.push({ label: 'Check', value: user.investment_size, icon: '💳' });
    }
    if (hasValue(user.fund_size)) {
      metrics.push({ label: 'Fund', value: user.fund_size, icon: '🏦' });
    }
  } else if (user.buyer_type === 'strategic' || user.buyer_type.includes('strategic')) {
    // Corporate - Company Revenue, Target Company Size
    if (hasValue(user.estimated_revenue)) {
      metrics.push({ label: 'Revenue', value: user.estimated_revenue, icon: '📈' });
    }
    if (hasValue(user.target_company_size)) {
      metrics.push({ label: 'Target Size', value: user.target_company_size, icon: '🎯' });
    }
  } else if (user.buyer_type === 'searchFund' || user.buyer_type.includes('searchFund')) {
    // Search Fund - Funding Status, Fund Size, Target Size
    if (user.is_funded === 'yes' && hasValue(user.funded_by)) {
      metrics.push({ label: 'Funded', value: user.funded_by, icon: '✅' });
    } else if (user.is_funded === 'no') {
      metrics.push({ label: 'Status', value: 'Unfunded', icon: '🔍' });
    }
    if (hasValue(user.fund_size)) {
      metrics.push({ label: 'Fund', value: user.fund_size, icon: '🏦' });
    }
    if (hasValue(user.target_company_size)) {
      metrics.push({ label: 'Target Size', value: user.target_company_size, icon: '🎯' });
    }
  } else if (user.buyer_type === 'individual' || user.buyer_type.includes('individual')) {
    // Individual - Funding Source, Loan Needs, Revenue
    if (hasValue(user.funding_source)) {
      metrics.push({ label: 'Funding', value: user.funding_source, icon: '💳' });
    }
    if (hasValue(user.needs_loan)) {
      metrics.push({ label: 'SBA/Loan', value: user.needs_loan, icon: '🏛️' });
    }
    if (hasValue(user.estimated_revenue)) {
      metrics.push({ label: 'Revenue', value: user.estimated_revenue, icon: '📈' });
    }
  }

  // Add revenue range if available and not PE (since they don't have revenue ranges)
  if (!user.buyer_type.includes('privateEquity') && (user.revenue_range_min || user.revenue_range_max)) {
    const min = user.revenue_range_min ? `$${Number(user.revenue_range_min).toLocaleString()}` : '';
    const max = user.revenue_range_max ? `$${Number(user.revenue_range_max).toLocaleString()}` : '';
    
    if (min && max) {
      metrics.push({ label: 'Target Revenue', value: `${min} - ${max}`, icon: '💵' });
    } else if (min) {
      metrics.push({ label: 'Min Revenue', value: `${min}+`, icon: '💵' });
    } else if (max) {
      metrics.push({ label: 'Max Revenue', value: `<${max}`, icon: '💵' });
    }
  }

  // Limit to top 3 most important metrics to keep it clean
  return metrics.slice(0, 3);
};

// Format financial metrics for compact display
export const formatFinancialMetricValue = (value: string): string => {
  // Try to parse and format numbers
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
  if (!isNaN(numericValue) && numericValue > 0) {
    if (numericValue >= 1000000000) {
      return `$${(numericValue / 1000000000).toFixed(1)}B`;
    } else if (numericValue >= 1000000) {
      return `$${(numericValue / 1000000).toFixed(1)}M`;
    } else if (numericValue >= 1000) {
      return `$${(numericValue / 1000).toFixed(0)}K`;
    } else {
      return `$${numericValue.toFixed(0)}`;
    }
  }
  
  // Return original value if not a number or for text values
  return value;
};
