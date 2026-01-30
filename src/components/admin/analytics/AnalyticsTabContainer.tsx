import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Activity, Globe, TrendingUp, Brain, DollarSign, Target, Megaphone, Heart, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PremiumAnalyticsDashboard } from "./PremiumAnalyticsDashboard";
import { TrafficIntelligenceDashboard } from "./traffic/TrafficIntelligenceDashboard";
import { EngagementDashboard } from "./engagement/EngagementDashboard";
import { SearchIntelligenceDashboard } from "./search/SearchIntelligenceDashboard";
import { RealTimeTab } from "./realtime/RealTimeTab";
import { HistoricalTrendsDashboard } from "./historical/HistoricalTrendsDashboard";
import { WorldGeographyMap } from "./geographic/WorldGeographyMap";
import { UserActivityFeed } from "../UserActivityFeed";
import { PredictiveIntelligenceTab } from "../PredictiveIntelligenceTab";
import { MarketIntelligenceTab } from "../MarketIntelligenceTab";
import { RevenueOptimizationTab } from "../RevenueOptimizationTab";
import { BuyerIntentDashboard } from "./buyer-intent/BuyerIntentDashboard";
import { CampaignAttributionPanel } from "./campaigns/CampaignAttributionPanel";
import { ListingHealthDashboard } from "./listings/ListingHealthDashboard";
import { ExitAnalysisPanel } from "./exit/ExitAnalysisPanel";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function AnalyticsTabContainer() {
  const [timeRange, setTimeRange] = useState("30");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  
  const handleTimeRangeChange = (value: string) => {
    if (value === "custom") {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      setCustomDateRange(null);
      setTimeRange(value);
    }
  };

  // Calculate timeRangeDays based on selection or custom range
  const timeRangeDays = customDateRange 
    ? Math.ceil((customDateRange.to.getTime() - customDateRange.from.getTime()) / (1000 * 60 * 60 * 24))
    : parseInt(timeRange);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight text-foreground">
            Intelligence Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive marketplace analytics and buyer intelligence
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={isCustomMode ? "custom" : timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-[140px] h-10 rounded-xl border-border/50 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>

          {isCustomMode && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-10 px-3 rounded-xl border-border/50 bg-card justify-start text-left font-normal",
                    !customDateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateRange?.from ? (
                    customDateRange.to ? (
                      <>
                        {format(customDateRange.from, "MMM d")} - {format(customDateRange.to, "MMM d")}
                      </>
                    ) : (
                      format(customDateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    <span>Pick dates</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={customDateRange?.from}
                  selected={customDateRange ? { from: customDateRange.from, to: customDateRange.to } : undefined}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setCustomDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="h-auto p-1 bg-muted/50 rounded-xl border border-border/30 inline-flex w-max">
            <TabsTrigger 
              value="overview" 
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="realtime"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Real-Time
            </TabsTrigger>
            <TabsTrigger 
              value="buyer-intent"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Target className="h-3.5 w-3.5 mr-1.5" />
              Buyer Intent
            </TabsTrigger>
            <TabsTrigger 
              value="traffic"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Traffic
            </TabsTrigger>
            <TabsTrigger 
              value="engagement"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Engagement
            </TabsTrigger>
            <TabsTrigger 
              value="search"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Search
            </TabsTrigger>
            <TabsTrigger 
              value="geography"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Geography
            </TabsTrigger>
            <TabsTrigger 
              value="historical"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Historical
            </TabsTrigger>
            <TabsTrigger 
              value="predictive"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Brain className="h-3.5 w-3.5 mr-1.5" />
              Predictive
            </TabsTrigger>
            <TabsTrigger 
              value="market"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Market
            </TabsTrigger>
            <TabsTrigger 
              value="revenue"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <DollarSign className="h-3.5 w-3.5 mr-1.5" />
              Revenue
            </TabsTrigger>
            <TabsTrigger 
              value="listings"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Heart className="h-3.5 w-3.5 mr-1.5" />
              Listing Health
            </TabsTrigger>
            <TabsTrigger 
              value="activity"
              className="rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Live Feed
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="overview" className="mt-0">
          <PremiumAnalyticsDashboard timeRangeDays={timeRangeDays} />
        </TabsContent>

        <TabsContent value="realtime" className="mt-0">
          <RealTimeTab />
        </TabsContent>

        <TabsContent value="buyer-intent" className="mt-0">
          <BuyerIntentDashboard timeRangeDays={timeRangeDays} />
        </TabsContent>

        <TabsContent value="traffic" className="mt-0">
          <div className="space-y-8">
            <TrafficIntelligenceDashboard timeRangeDays={timeRangeDays} />
            
            {/* Campaign Attribution */}
            <div className="border-t border-border/30 pt-8">
              <CampaignAttributionPanel timeRangeDays={timeRangeDays} />
            </div>
            
            {/* Exit Analysis */}
            <div className="border-t border-border/30 pt-8">
              <ExitAnalysisPanel timeRangeDays={timeRangeDays} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="mt-0">
          <div className="space-y-8">
            <EngagementDashboard timeRangeDays={timeRangeDays} />
            
            {/* Listing Health */}
            <div className="border-t border-border/30 pt-8">
              <ListingHealthDashboard />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="search" className="mt-0">
          <SearchIntelligenceDashboard timeRangeDays={timeRangeDays} />
        </TabsContent>

        <TabsContent value="geography" className="mt-0">
          <WorldGeographyMap timeRangeDays={timeRangeDays} />
        </TabsContent>

        <TabsContent value="historical" className="mt-0">
          <HistoricalTrendsDashboard timeRangeDays={timeRangeDays} />
        </TabsContent>

        <TabsContent value="predictive" className="mt-0">
          <PredictiveIntelligenceTab />
        </TabsContent>

        <TabsContent value="market" className="mt-0">
          <MarketIntelligenceTab />
        </TabsContent>

        <TabsContent value="revenue" className="mt-0">
          <RevenueOptimizationTab />
        </TabsContent>

        <TabsContent value="listings" className="mt-0">
          <ListingHealthDashboard />
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <UserActivityFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}
