import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { User } from '@/types';
import { DollarSign, TrendingUp, Building, Users } from 'lucide-react';

interface BusinessIntelligenceProps {
  users: User[];
}

export function BusinessIntelligence({ users }: BusinessIntelligenceProps) {
  const intelligence = useMemo(() => {
    // Deal size analysis
    const dealSizeCategories = {
      'Under $1M': users.filter(u => {
        const size = Number(u.target_deal_size_max || u.investment_size || 0);
        return size < 1000000;
      }).length,
      '$1M - $5M': users.filter(u => {
        const size = Number(u.target_deal_size_max || u.investment_size || 0);
        return size >= 1000000 && size < 5000000;
      }).length,
      '$5M - $10M': users.filter(u => {
        const size = Number(u.target_deal_size_max || u.investment_size || 0);
        return size >= 5000000 && size < 10000000;
      }).length,
      'Over $10M': users.filter(u => {
        const size = Number(u.target_deal_size_max || u.investment_size || 0);
        return size >= 10000000;
      }).length,
    };

    // Investment capacity
    const totalInvestmentCapacity = users.reduce((sum, u) => {
      return sum + Number(u.fund_size || u.aum || u.investment_size || 0);
    }, 0);

    // Industry expertise breakdown
    const industries = users.reduce((acc, user) => {
      if (user.industry_expertise) {
        const expertise = Array.isArray(user.industry_expertise) 
          ? user.industry_expertise 
          : [user.industry_expertise];
        
        expertise.forEach(ind => {
          acc[ind] = (acc[ind] || 0) + 1;
        });
      }
      return acc;
    }, {} as Record<string, number>);

    const topIndustries = Object.entries(industries)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Funding sources
    const fundingSources = users.reduce((acc, user) => {
      if (user.funding_source) {
        acc[user.funding_source] = (acc[user.funding_source] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      dealSizeCategories,
      totalInvestmentCapacity,
      topIndustries,
      fundingSources,
    };
  }, [users]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="space-y-6">
      {/* Investment Capacity Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Total Investment Capacity
          </CardTitle>
          <CardDescription>
            Combined buying power across all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary tabular-nums">
            {formatCurrency(intelligence.totalInvestmentCapacity)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Across {users.length} registered buyers
          </p>
        </CardContent>
      </Card>

      {/* Deal Size Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deal Size Distribution</CardTitle>
          <CardDescription>
            Target deal sizes across buyer base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(intelligence.dealSizeCategories).map(([range, count]) => {
              const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
              return (
                <div key={range} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{range}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {count} buyers
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(percentage)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Industries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="h-4 w-4" />
            Top Industry Expertise
          </CardTitle>
          <CardDescription>
            Most common industry focuses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {intelligence.topIndustries.map(([industry, count], index) => (
              <div key={industry} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                  <p className="font-medium capitalize">{industry}</p>
                </div>
                <Badge variant="secondary">{count} buyers</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Funding Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Funding Source Breakdown
          </CardTitle>
          <CardDescription>
            How buyers are financing deals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(intelligence.fundingSources)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => {
                const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
                return (
                  <div key={source} className="flex items-center justify-between p-3 border rounded-lg">
                    <p className="font-medium capitalize">{source.replace(/_/g, ' ')}</p>
                    <div className="flex items-center gap-3">
                      <Progress value={percentage} className="w-24 h-2" />
                      <span className="text-sm font-semibold tabular-nums w-16 text-right">
                        {Math.round(percentage)}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
