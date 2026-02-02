import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnifiedAnalytics } from "@/hooks/useUnifiedAnalytics";
import { KPIStrip } from "./KPIStrip";
import { DailyVisitorsChart } from "./DailyVisitorsChart";
import { SourcesCard } from "./SourcesCard";
import { GeographyCard } from "./GeographyCard";
import { PagesCard } from "./PagesCard";
import { TechStackCard } from "./TechStackCard";
import { ConversionCard } from "./ConversionCard";
import { FloatingGlobeToggle } from "./FloatingGlobeToggle";
import { cn } from "@/lib/utils";

export function DatafastAnalyticsDashboard() {
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

  const timeRangeDays = customDateRange 
    ? Math.ceil((customDateRange.to.getTime() - customDateRange.from.getTime()) / (1000 * 60 * 60 * 24))
    : parseInt(timeRange);

  const { data, isLoading, refetch, isRefetching } = useUnifiedAnalytics(timeRangeDays);

  return (
    <div className="space-y-6 pb-24">
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

          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl border-border/50 bg-card"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          {/* KPI Strip */}
          <KPIStrip data={data.kpis} />
          
          {/* Daily Chart */}
          <DailyVisitorsChart data={data.dailyMetrics} />
          
          {/* Sources & Geography Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SourcesCard 
              channels={data.channels}
              referrers={data.referrers}
              campaigns={data.campaigns}
              keywords={data.keywords}
              selfReportedSources={data.selfReportedSources}
            />
            <GeographyCard 
              countries={data.countries}
              regions={data.regions}
              cities={data.cities}
            />
          </div>
          
          {/* Pages & Tech Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PagesCard 
              topPages={data.topPages}
              entryPages={data.entryPages}
              exitPages={data.exitPages}
            />
            <TechStackCard 
              browsers={data.browsers}
              operatingSystems={data.operatingSystems}
              devices={data.devices}
            />
          </div>
          
          {/* Conversion Card */}
          <ConversionCard 
            funnel={data.funnel}
            topUsers={data.topUsers}
          />
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No data available
        </div>
      )}

      {/* Floating Globe Toggle */}
      <FloatingGlobeToggle />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI Strip Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 p-6 bg-card rounded-2xl border border-border/50">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      
      {/* Chart Skeleton */}
      <Skeleton className="h-[340px] rounded-2xl" />
      
      {/* Two Column Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px] rounded-2xl" />
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[280px] rounded-2xl" />
        <Skeleton className="h-[280px] rounded-2xl" />
      </div>
      
      <Skeleton className="h-[250px] rounded-2xl" />
    </div>
  );
}
