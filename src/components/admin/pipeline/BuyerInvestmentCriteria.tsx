import React from 'react';
import { DollarSign, MapPin, Building2, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuyerInvestmentCriteriaProps {
  buyerProfile: any;
  className?: string;
}

export function BuyerInvestmentCriteria({ buyerProfile, className }: BuyerInvestmentCriteriaProps) {
  if (!buyerProfile) return null;

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseInt(value) : value;
    if (isNaN(num)) return value;
    
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toLocaleString()}`;
  };

  const formatArray = (value: any) => {
    if (!value) return 'Not specified';
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'Not specified';
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.join(', ') : value;
      } catch {
        return value;
      }
    }
    return 'Not specified';
  };

  const getInvestmentSize = () => {
    if (buyerProfile.investment_size) {
      return formatArray(buyerProfile.investment_size);
    }
    if (buyerProfile.revenue_range_min || buyerProfile.revenue_range_max) {
      const min = buyerProfile.revenue_range_min ? formatCurrency(buyerProfile.revenue_range_min) : '';
      const max = buyerProfile.revenue_range_max ? formatCurrency(buyerProfile.revenue_range_max) : '';
      if (min && max) return `${min} - ${max}`;
      if (min) return `${min}+`;
      if (max) return `Up to ${max}`;
    }
    return 'Not specified';
  };

  const criteriaItems = [
    {
      icon: DollarSign,
      label: 'Investment Size',
      value: getInvestmentSize(),
      priority: 'high'
    },
    {
      icon: Building2,
      label: 'Industries',
      value: formatArray(buyerProfile.business_categories),
      priority: 'high'
    },
    {
      icon: MapPin,
      label: 'Geography',
      value: formatArray(buyerProfile.target_locations),
      priority: 'medium'
    },
    {
      icon: Target,
      label: 'Ideal Target',
      value: buyerProfile.ideal_target_description || buyerProfile.ideal_target || 'Not specified',
      priority: 'medium'
    },
    {
      icon: TrendingUp,
      label: 'Fund Size',
      value: buyerProfile.fund_size || buyerProfile.aum || 'Not specified',
      priority: 'low'
    }
  ].filter(item => item.value !== 'Not specified');

  if (criteriaItems.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-foreground">Investment Criteria</h4>
      </div>
      
      <div className="space-y-2">
        {criteriaItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={index} className="flex items-start gap-3 py-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {item.label}
                </div>
                <div className="text-sm text-foreground leading-relaxed">
                  {item.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}