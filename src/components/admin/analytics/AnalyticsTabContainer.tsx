import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PremiumAnalyticsDashboard } from "./PremiumAnalyticsDashboard";
import { TrafficIntelligenceDashboard } from "./traffic/TrafficIntelligenceDashboard";
import { EngagementDashboard } from "./engagement/EngagementDashboard";
import { SearchIntelligenceDashboard } from "./search/SearchIntelligenceDashboard";
import { UserActivityFeed } from "../UserActivityFeed";
import { cn } from "@/lib/utils";

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
            Comprehensive marketplace analytics and insights
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
