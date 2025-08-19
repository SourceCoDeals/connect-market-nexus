import { AdminConnectionRequest } from '@/types/admin';

export interface FinancialMetric {
  label: string;
  value: string;
  icon?: string;
}

// Get the most relevant financial metrics for each buyer type
export const getFinancialMetricsForBuyerType = (user: any): FinancialMetric[] => {
  if (!user?.buyer_type) return [];

  const metrics: FinancialMetric[] = [];
  
  if (user.buyer_type.includes('Private')) {
    // Private Equity - AUM, Fund Size, Check Size
    if (user.aum) {
      metrics.push({ label: 'AUM', value: user.aum, icon: '💰' });
    }
    if (user.fund_size) {
      metrics.push({ label: 'Fund', value: user.fund_size, icon: '🏦' });
    }
    if (user.investment_size) {
      metrics.push({ label: 'Check', value: user.investment_size, icon: '💳' });
    }
  } else if (user.buyer_type.includes('Family')) {
    // Family Office - AUM, Check Size, Fund Size
    if (user.aum) {
      metrics.push({ label: 'AUM', value: user.aum, icon: '💰' });
    }
    if (user.investment_size) {
      metrics.push({ label: 'Check', value: user.investment_size, icon: '💳' });
    }
    if (user.fund_size) {
      metrics.push({ label: 'Fund', value: user.fund_size, icon: '🏦' });
    }
  } else if (user.buyer_type.includes('Strategic')) {
    // Corporate - Company Revenue, Target Company Size
    if (user.estimated_revenue) {
      metrics.push({ label: 'Revenue', value: user.estimated_revenue, icon: '📈' });
    }
    if (user.target_company_size) {
      metrics.push({ label: 'Target Size', value: user.target_company_size, icon: '🎯' });
    }
  } else if (user.buyer_type.includes('Search')) {
    // Search Fund - Funding Status, Fund Size, Target Size
    if (user.is_funded === 'yes' && user.funded_by) {
      metrics.push({ label: 'Funded', value: user.funded_by, icon: '✅' });
    } else if (user.is_funded === 'no') {
      metrics.push({ label: 'Status', value: 'Unfunded', icon: '🔍' });
    }
    if (user.fund_size) {
      metrics.push({ label: 'Fund', value: user.fund_size, icon: '🏦' });
    }
    if (user.target_company_size) {
      metrics.push({ label: 'Target Size', value: user.target_company_size, icon: '🎯' });
    }
  } else if (user.buyer_type.includes('Individual')) {
    // Individual - Funding Source, Loan Needs, Revenue
    if (user.funding_source) {
      metrics.push({ label: 'Funding', value: user.funding_source, icon: '💳' });
    }
    if (user.needs_loan) {
      metrics.push({ label: 'SBA/Loan', value: user.needs_loan, icon: '🏛️' });
    }
    if (user.estimated_revenue) {
      metrics.push({ label: 'Revenue', value: user.estimated_revenue, icon: '📈' });
    }
  }

  // Add revenue range if available and not PE (since they don't have revenue ranges)
  if (!user.buyer_type.includes('Private') && (user.revenue_range_min || user.revenue_range_max)) {
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
