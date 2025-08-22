import { BuyerType, User } from '@/types';
import { parseCurrency, formatCurrency, formatInvestmentSize, formatRevenueRange } from './currency-utils';
import { processUrl } from './url-utils';

// Buyer tier system (1-5, where 1 is highest priority)
export type BuyerTier = 1 | 2 | 3 | 4 | 5;

export interface BuyerMetric {
  label: string;
  value: string;
  isPrimary?: boolean;
  isClickable?: boolean;
  href?: string;
  completeness?: 'complete' | 'partial' | 'missing';
}

export interface BuyerTierInfo {
  tier: BuyerTier;
  badge: string;
  color: string;
  description: string;
}

/**
 * Determine buyer tier based on type and financial metrics
 */
export function getBuyerTier(user: User | null): BuyerTierInfo {
  if (!user?.buyer_type) {
    return { tier: 5, badge: '5', color: 'text-muted-foreground', description: 'No type specified' };
  }

  const buyerType = user.buyer_type as BuyerType;
  
  // Parse financial metrics for tier determination
  const aum = parseCurrency(user.aum || '0');
  const fundSize = parseCurrency(user.fund_size || '0');
  const maxFinancial = Math.max(aum, fundSize);

  switch (buyerType) {
    case 'privateEquity':
      if (maxFinancial >= 1000000000) { // $1B+
        return { tier: 1, badge: '🏆', color: 'text-emerald-600', description: 'Premier PE ($1B+)' };
      } else if (maxFinancial >= 200000000) { // $200M+
        return { tier: 1, badge: '1', color: 'text-emerald-600', description: 'Tier 1 PE' };
      }
      return { tier: 1, badge: '1', color: 'text-emerald-500', description: 'Private Equity' };
      
    case 'familyOffice':
      if (maxFinancial >= 1000000000) { // $1B+
        return { tier: 2, badge: '🏆', color: 'text-blue-600', description: 'Premier Family Office ($1B+)' };
      }
      return { tier: 2, badge: '2', color: 'text-blue-600', description: 'Family Office' };
      
    case 'corporate':
      return { tier: 3, badge: '3', color: 'text-amber-600', description: 'Corporate' };
      
    case 'searchFund':
      return { tier: 4, badge: '4', color: 'text-orange-600', description: 'Search Fund' };
      
    case 'individual':
      return { tier: 5, badge: '5', color: 'text-gray-600', description: 'Individual' };
      
    default:
      return { tier: 5, badge: '5', color: 'text-muted-foreground', description: 'Unknown' };
  }
}

/**
 * Get primary metrics to display for each buyer type
 */
export function getPrimaryMetrics(user: User | null): BuyerMetric[] {
  if (!user?.buyer_type) return [];

  const buyerType = user.buyer_type as BuyerType;
  const metrics: BuyerMetric[] = [];

  // Company name and website (always show if available)
  if (user.company) {
    const hasWebsite = user.website && user.website.trim() !== '';
    metrics.push({
      label: 'Company',
      value: user.company,
      isClickable: hasWebsite,
      href: hasWebsite ? processUrl(user.website) : undefined,
      completeness: 'complete'
    });
  }

  // LinkedIn (always valuable for validation)
  if (user.linkedin_profile) {
    const linkedinUrl = user.linkedin_profile.startsWith('http') 
      ? user.linkedin_profile 
      : `https://linkedin.com/in/${user.linkedin_profile}`;
    metrics.push({
      label: 'LinkedIn',
      value: 'Profile',
      isClickable: true,
      href: linkedinUrl,
      completeness: 'complete'
    });
  }

  // Type-specific metrics
  switch (buyerType) {
    case 'privateEquity':
      // Priority: AUM → Fund Size → Investment Size
      if (user.aum) {
        const aumValue = parseCurrency(user.aum);
        metrics.push({
          label: 'AUM',
          value: formatCurrency(aumValue),
          isPrimary: true,
          completeness: 'complete'
        });
      } else if (user.fund_size) {
        const fundValue = parseCurrency(user.fund_size);
        metrics.push({
          label: 'Fund Size',
          value: formatCurrency(fundValue),
          isPrimary: true,
          completeness: 'complete'
        });
      } else if (user.investment_size) {
        metrics.push({
          label: 'Investment Size',
          value: formatInvestmentSize(user.investment_size),
          isPrimary: true,
          completeness: 'partial'
        });
      }
      break;

    case 'familyOffice':
      // Show AUM → Investment Size → Revenue Targets
      if (user.aum) {
        const aumValue = parseCurrency(user.aum);
        metrics.push({
          label: 'AUM',
          value: formatCurrency(aumValue),
          isPrimary: true,
          completeness: 'complete'
        });
      } else if (user.fund_size) {
        const fundValue = parseCurrency(user.fund_size);
        metrics.push({
          label: 'Fund Size',
          value: formatCurrency(fundValue),
          isPrimary: true,
          completeness: 'complete'
        });
      }
      if (user.investment_size) {
        metrics.push({
          label: 'Investment Size',
          value: formatInvestmentSize(user.investment_size),
          completeness: 'complete'
        });
      }
      if (user.revenue_range_min || user.revenue_range_max) {
        metrics.push({
          label: 'Revenue Target',
          value: formatRevenueRange(user.revenue_range_min, user.revenue_range_max),
          completeness: 'complete'
        });
      }
      break;

    case 'corporate':
      // Display Company Revenue → Target Range → Company Link
      if (user.estimated_revenue) {
        const revenueValue = parseCurrency(user.estimated_revenue);
        metrics.push({
          label: 'Company Revenue',
          value: formatCurrency(revenueValue),
          isPrimary: true,
          completeness: 'complete'
        });
      }
      if (user.revenue_range_min || user.revenue_range_max) {
        metrics.push({
          label: 'Target Range',
          value: formatRevenueRange(user.revenue_range_min, user.revenue_range_max),
          completeness: 'complete'
        });
      }
      break;

    case 'searchFund':
      // Highlight Funding Status → Funded By → Target Size
      if (user.is_funded) {
        metrics.push({
          label: 'Funding Status',
          value: user.is_funded === 'yes' ? 'Funded' : 'Unfunded',
          isPrimary: true,
          completeness: 'complete'
        });
      }
      if (user.funded_by && user.is_funded === 'yes') {
        metrics.push({
          label: 'Funded By',
          value: user.funded_by,
          completeness: 'complete'
        });
      }
      if (user.target_company_size) {
        metrics.push({
          label: 'Target Size',
          value: user.target_company_size,
          completeness: 'complete'
        });
      }
      break;

    case 'individual':
      // Show Funding Source → SBA Needs → Target Range
      if (user.funding_source) {
        metrics.push({
          label: 'Funding Source',
          value: user.funding_source,
          isPrimary: true,
          completeness: 'complete'
        });
      }
      if (user.needs_loan) {
        metrics.push({
          label: 'SBA/Bank Loan',
          value: user.needs_loan === 'yes' ? 'Required' : 'Not needed',
          completeness: 'complete'
        });
      }
      if (user.revenue_range_min || user.revenue_range_max) {
        metrics.push({
          label: 'Target Range',
          value: formatRevenueRange(user.revenue_range_min, user.revenue_range_max),
          completeness: 'complete'
        });
      }
      break;
  }

  return metrics;
}

/**
 * Get data completeness score (0-100)
 */
export function getDataCompleteness(user: User | null): number {
  if (!user) return 0;

  const requiredFields = ['company', 'buyer_type'];
  const importantFields = ['linkedin_profile', 'website'];
  
  let score = 0;
  let total = requiredFields.length + importantFields.length;

  // Check required fields (weight: 2x)
  requiredFields.forEach(field => {
    if (user[field as keyof User]) {
      score += 2;
    }
    total += 1; // Add extra weight
  });

  // Check important fields (weight: 1x)
  importantFields.forEach(field => {
    if (user[field as keyof User]) {
      score += 1;
    }
  });

  // Check buyer-specific fields
  const buyerType = user.buyer_type as BuyerType;
  switch (buyerType) {
    case 'privateEquity':
    case 'familyOffice':
      if (user.aum || user.fund_size) score += 3;
      if (user.investment_size) score += 1;
      total += 4;
      break;
    case 'corporate':
      if (user.estimated_revenue) score += 2;
      total += 2;
      break;
    case 'searchFund':
      if (user.is_funded) score += 2;
      if (user.target_company_size) score += 1;
      total += 3;
      break;
    case 'individual':
      if (user.funding_source) score += 2;
      total += 2;
      break;
  }

  return Math.round((score / total) * 100);
}

/**
 * Handle missing data with consistent messaging
 */
export function handleMissingData(value: string | null | undefined, label: string): string {
  if (!value || value.trim() === '') {
    return 'Not disclosed';
  }
  return value;
}

/**
 * Format financial range for display
 */
export function formatFinancialRange(min?: string | number | null, max?: string | number | null): string {
  if (!min && !max) return 'Not specified';
  
  const formatValue = (val: string | number | null | undefined) => {
    if (!val) return 'Any';
    const parsed = typeof val === 'number' ? val : parseCurrency(val);
    return formatCurrency(parsed);
  };
  
  const minFormatted = formatValue(min);
  const maxFormatted = formatValue(max);
  
  if (min && max) {
    return `${minFormatted} - ${maxFormatted}`;
  } else if (min) {
    return `${minFormatted}+`;
  } else if (max) {
    return `Up to ${maxFormatted}`;
  }
  
  return 'Not specified';
}