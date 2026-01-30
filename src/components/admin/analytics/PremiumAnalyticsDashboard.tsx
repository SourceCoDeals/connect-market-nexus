import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Users, Target, TrendingUp } from "lucide-react";
import { usePremiumAnalytics } from "@/hooks/usePremiumAnalytics";
import { HeroStatCard } from "./premium/HeroStatCard";
import { ConnectionVelocityChart } from "./premium/ConnectionVelocityChart";
import { BuyerTypeBreakdown } from "./premium/BuyerTypeBreakdown";
import { ListingPerformanceChart } from "./premium/ListingPerformanceChart";
import { DealFlowFunnel } from "./premium/DealFlowFunnel";
import { TopListingsCard } from "./premium/TopListingsCard";
import { ActionItemsCard } from "./premium/ActionItemsCard";

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
          <h2 className="text-2xl font-semibold tracking-tight">Deal Intelligence</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time insights into marketplace performance
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <HeroStatCard
          title="Connection Requests"
          value={data.connectionRequestsCount}
          subtitle={`Last ${timeRangeDays} days`}
          trend={{
            value: data.connectionRequestsTrend,
            direction: data.connectionRequestsTrend >= 0 ? 'up' : 'down',
          }}
          sparklineData={data.connectionRequestsSparkline}
          icon={MessageSquare}
          accentColor="blue"
        />
        <HeroStatCard
          title="Deal Activity"
          value={data.dealActivityCount}
          subtitle="Total requests"
          trend={{
            value: data.dealActivityTrend,
            direction: data.dealActivityTrend >= 0 ? 'up' : 'down',
          }}
          sparklineData={data.dealActivitySparkline}
          icon={TrendingUp}
          accentColor="emerald"
        />
        <HeroStatCard
          title="Buyer Pipeline"
          value={data.approvedBuyersCount}
          subtitle="Approved buyers"
          trend={{
            value: data.approvedBuyersTrend,
            direction: data.approvedBuyersTrend >= 0 ? 'up' : 'down',
          }}
          sparklineData={data.approvedBuyersSparkline}
          icon={Users}
          accentColor="violet"
        />
        <HeroStatCard
          title="Conversion Rate"
          value={`${data.conversionRate.toFixed(1)}%`}
          subtitle="Request → Approved"
          trend={{
            value: data.conversionRateTrend,
            direction: data.conversionRateTrend >= 0 ? 'up' : 'neutral',
          }}
          sparklineData={data.conversionRateSparkline}
          icon={Target}
          accentColor="amber"
        />
      </div>

      {/* Primary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConnectionVelocityChart data={data.connectionVelocity} />
        <BuyerTypeBreakdown data={data.buyerTypeBreakdown} />
      </div>

      {/* Deal Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListingPerformanceChart data={data.listingPerformance} />
        <DealFlowFunnel data={data.funnelData} />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <Skeleton className="h-9 w-[140px]" />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[160px] rounded-lg" />
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[360px] rounded-lg" />
        <Skeleton className="h-[360px] rounded-lg" />
      </div>
    </div>
  );
}
