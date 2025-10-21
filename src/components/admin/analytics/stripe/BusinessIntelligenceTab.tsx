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
    <div className="space-y-section">
      {/* Investment Capacity Hero */}
      <Card className="border-border/50 shadow-xl bg-gradient-card overflow-hidden group">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Total Investment Capacity
              </p>
              <p className="text-hero-2xl font-bold tabular-nums mb-2 bg-gradient-primary bg-clip-text text-transparent">
                {formatCurrency(businessMetrics.totalInvestmentCapacity)}
              </p>
              <p className="text-sm text-muted-foreground font-medium">
                Across all registered buyers
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-primary/10 shadow-glow-lg group-hover:scale-110 transition-transform duration-300">
              <DollarSign className="h-16 w-16 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-section md:grid-cols-3">
        {/* Deal Size Distribution */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5" />
              Deal Size Distribution
            </CardTitle>
            <CardDescription>Users by target deal size</CardDescription>
          </CardHeader>
          <CardContent className="space-y-compact">
            {Object.entries(businessMetrics.dealSizeCategories).map(([range, count]) => {
              const percentage = users.length > 0 ? (count / users.length) * 100 : 0;
              return (
                <div key={range} className="p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{range}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums font-medium">{count} users</span>
                      <Badge variant="secondary" className="tabular-nums font-bold">
                        {percentage.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Top Industries */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Top Industry Expertise
            </CardTitle>
            <CardDescription>Most common industries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {businessMetrics.topIndustries.length > 0 ? (
              businessMetrics.topIndustries.map((industry, index) => (
                <div 
                  key={industry.industry} 
                  className="flex items-center justify-between p-3 bg-gradient-subtle rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shadow-sm">
                      {index + 1}
                    </div>
                    <span className="text-sm font-semibold">{industry.industry}</span>
                  </div>
                  <Badge variant="secondary" className="tabular-nums font-bold">
                    {industry.count}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No industry data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Funding Sources */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Funding Source Breakdown
            </CardTitle>
            <CardDescription>Capital sources by frequency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-compact">
            {businessMetrics.topFundingSources.length > 0 ? (
              businessMetrics.topFundingSources.map(source => (
                <div key={source.source} className="p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{source.source}</span>
                    <Badge variant="secondary" className="tabular-nums font-bold">
                      {source.count}
                    </Badge>
                  </div>
                  <Progress value={source.percentage} className="h-2.5" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
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
