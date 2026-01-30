import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumAnalyticsDashboard } from "./PremiumAnalyticsDashboard";
import { TrafficIntelligenceDashboard } from "./traffic/TrafficIntelligenceDashboard";
import { EngagementDashboard } from "./engagement/EngagementDashboard";
import { SearchIntelligenceDashboard } from "./search/SearchIntelligenceDashboard";
import { UserActivityFeed } from "../UserActivityFeed";

export function AnalyticsTabContainer() {
  const [timeRange, setTimeRange] = useState("30");
  const timeRangeDays = parseInt(timeRange);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight text-foreground">
            Intelligence Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive marketplace analytics and insights
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[160px] h-10 rounded-xl border-border/50 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="h-12 p-1 bg-muted/50 rounded-xl border border-border/30">
          <TabsTrigger 
            value="overview" 
            className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="traffic"
            className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Traffic
          </TabsTrigger>
          <TabsTrigger 
            value="engagement"
            className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Engagement
          </TabsTrigger>
          <TabsTrigger 
            value="search"
            className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Search
          </TabsTrigger>
          <TabsTrigger 
            value="activity"
            className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Live Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <PremiumAnalyticsDashboard timeRangeDays={timeRangeDays} />
        </TabsContent>

        <TabsContent value="traffic" className="mt-0">
          <TrafficIntelligenceDashboard timeRangeDays={timeRangeDays} />
        </TabsContent>

        <TabsContent value="engagement" className="mt-0">
          <EngagementDashboard timeRangeDays={timeRangeDays} />
        </TabsContent>

        <TabsContent value="search" className="mt-0">
          <SearchIntelligenceDashboard timeRangeDays={timeRangeDays} />
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <UserActivityFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}
