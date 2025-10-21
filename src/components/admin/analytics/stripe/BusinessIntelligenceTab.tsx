import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User } from "@/types";
import { DollarSign, TrendingUp, Target, Building2 } from "lucide-react";
import { CohortAnalysis } from "../CohortAnalysis";
import { parseCurrency } from "@/lib/currency-utils";

interface BusinessIntelligenceTabProps {
  users: User[];
}

export function BusinessIntelligenceTab({ users }: BusinessIntelligenceTabProps) {
  const businessMetrics = useMemo(() => {
    // Calculate total investment capacity
    const totalInvestmentCapacity = users.reduce((sum, user) => {
      const capacity = parseCurrency(user.investment_size as string);
      return sum + capacity;
    }, 0);

    // Deal size distribution
    const dealSizeCategories = {
      '<$1M': 0,
      '$1-5M': 0,
      '$5-10M': 0,
      '$10-25M': 0,
      '$25M+': 0,
    };

    users.forEach(user => {
      const size = parseCurrency(user.investment_size as string);
      if (size < 1000000) dealSizeCategories['<$1M']++;
      else if (size < 5000000) dealSizeCategories['$1-5M']++;
      else if (size < 10000000) dealSizeCategories['$5-10M']++;
      else if (size < 25000000) dealSizeCategories['$10-25M']++;
      else dealSizeCategories['$25M+']++;
    });

    // Top industries
    const industryCount: Record<string, number> = {};
    users.forEach(user => {
      if (user.industry_expertise && Array.isArray(user.industry_expertise)) {
        user.industry_expertise.forEach(industry => {
          industryCount[industry] = (industryCount[industry] || 0) + 1;
        });
      }
    });

    const topIndustries = Object.entries(industryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([industry, count]) => ({
        industry,
        count,
        percentage: users.length > 0 ? (count / users.length) * 100 : 0,
      }));

    // Funding sources
    const fundingSources: Record<string, number> = {};
    users.forEach(user => {
      if (user.funding_source) {
        fundingSources[user.funding_source] = (fundingSources[user.funding_source] || 0) + 1;
      }
      if (user.equity_source && Array.isArray(user.equity_source)) {
        user.equity_source.forEach(source => {
          fundingSources[source] = (fundingSources[source] || 0) + 1;
        });
      }
    });

    const topFundingSources = Object.entries(fundingSources)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([source, count]) => ({
        source,
        count,
        percentage: users.length > 0 ? (count / users.length) * 100 : 0,
      }));

    return {
      totalInvestmentCapacity,
      dealSizeCategories,
      topIndustries,
      topFundingSources,
    };
  }, [users]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="space-y-6">
      {/* Investment Capacity Hero */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Total Investment Capacity</p>
              <p className="text-5xl font-bold tabular-nums">
                {formatCurrency(businessMetrics.totalInvestmentCapacity)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Across all registered buyers
              </p>
            </div>
            <div className="p-4 rounded-full bg-primary/10">
              <DollarSign className="h-12 w-12 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Deal Size Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Deal Size Distribution
            </CardTitle>
            <CardDescription>Users by target deal size</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(businessMetrics.dealSizeCategories).map(([range, count]) => {
              const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
              return (
                <div key={range}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm">{range}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">{count} users</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {percentage.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Top Industries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Top Industry Expertise
            </CardTitle>
            <CardDescription>Most common industries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {businessMetrics.topIndustries.length > 0 ? (
              businessMetrics.topIndustries.map((industry, index) => (
                <div key={industry.industry} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium">{industry.industry}</span>
                  </div>
                  <Badge variant="secondary" className="tabular-nums">
                    {industry.count}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No industry data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Funding Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Funding Source Breakdown
            </CardTitle>
            <CardDescription>Capital sources by frequency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {businessMetrics.topFundingSources.length > 0 ? (
              businessMetrics.topFundingSources.map(source => (
                <div key={source.source}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm">{source.source}</span>
                    <Badge variant="secondary" className="tabular-nums">
                      {source.count}
                    </Badge>
                  </div>
                  <Progress value={source.percentage} className="h-2" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No funding source data
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cohort Analysis */}
      <CohortAnalysis users={users} />
    </div>
  );
}
