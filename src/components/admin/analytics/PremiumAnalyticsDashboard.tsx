import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePremiumAnalytics } from "@/hooks/usePremiumAnalytics";
import { PremiumStatCard } from "./premium/PremiumStatCard";
import { MultiSeriesVelocityChart } from "./premium/MultiSeriesVelocityChart";
import { USAGeographyMap } from "./premium/USAGeographyMap";
import { TransactionActivityPanel } from "./premium/TransactionActivityPanel";
import { RecentActivityFeed } from "./premium/RecentActivityFeed";
import { DealFlowFunnel } from "./premium/DealFlowFunnel";
import { TopListingsCard } from "./premium/TopListingsCard";
import { ActionItemsCard } from "./premium/ActionItemsCard";

const VELOCITY_SERIES = [
  { key: 'pe', name: 'Private Equity', color: 'hsl(0 65% 67%)' },
  { key: 'individual', name: 'Individual', color: 'hsl(20 100% 70%)' },
  { key: 'searchFund', name: 'Search Fund', color: 'hsl(220 55% 50%)' },
  { key: 'other', name: 'Other', color: 'hsl(160 60% 50%)' },
];

export function PremiumAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState("30");
  const timeRangeDays = parseInt(timeRange);
  
  const { data, isLoading, error } = usePremiumAnalytics(timeRangeDays);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light tracking-tight text-foreground">Deal Intelligence</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time marketplace performance
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px] h-9 rounded-xl border-border/50 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hero Stats - 3 columns for cleaner impact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <PremiumStatCard
          title="Connection Requests"
          value={data.connectionRequestsCount}
          subtitle={`Last ${timeRangeDays} days`}
          trend={{
            value: data.connectionRequestsTrend,
            direction: data.connectionRequestsTrend >= 0 ? 'up' : 'down',
          }}
          sparklineData={data.connectionRequestsSparkline}
        />
        <PremiumStatCard
          title="Buyer Pipeline"
          value={data.approvedBuyersCount}
          subtitle="Approved buyers"
          trend={{
            value: data.approvedBuyersTrend,
            direction: data.approvedBuyersTrend >= 0 ? 'up' : 'down',
          }}
          sparklineData={data.approvedBuyersSparkline}
        />
        <PremiumStatCard
          title="Conversion Rate"
          value={`${data.conversionRate.toFixed(1)}%`}
          subtitle="Request → Approved"
          trend={{
            value: data.conversionRateTrend,
            direction: data.conversionRateTrend >= 0 ? 'up' : 'neutral',
          }}
          sparklineData={data.conversionRateSparkline}
        />
      </div>

      {/* Velocity Chart + Geography Map */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <MultiSeriesVelocityChart 
            data={data.velocityByBuyerType} 
            series={VELOCITY_SERIES}
          />
        </div>
        <div className="lg:col-span-2">
          <USAGeographyMap data={data.buyerGeography} />
        </div>
      </div>

      {/* Transaction Activity + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <TransactionActivityPanel data={data.transactionActivity} />
        </div>
        <div className="lg:col-span-2">
          <RecentActivityFeed activities={data.recentActivity} />
        </div>
      </div>

      {/* Deal Flow + Top Listings + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DealFlowFunnel data={data.funnelData} />
        <TopListingsCard listings={data.topListings} />
        <ActionItemsCard items={data.actionItems} />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-9 w-[140px] rounded-xl" />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[140px] rounded-2xl" />
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Skeleton className="h-[360px] rounded-2xl lg:col-span-3" />
        <Skeleton className="h-[360px] rounded-2xl lg:col-span-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Skeleton className="h-[320px] rounded-2xl lg:col-span-3" />
        <Skeleton className="h-[320px] rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}
