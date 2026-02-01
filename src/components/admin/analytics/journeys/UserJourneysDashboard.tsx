import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserJourneys } from "@/hooks/useUserJourneys";
import { JourneyStageFunnel } from "./JourneyStageFunnel";
import { JourneyLiveFeed } from "./JourneyLiveFeed";
import { AttributionTable } from "./AttributionTable";
import { TopLandingPages } from "./TopLandingPages";
import { Users, UserCheck, Target, TrendingUp, Clock, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UserJourneysDashboardProps {
  timeRangeDays: number;
}

export function UserJourneysDashboard({ timeRangeDays }: UserJourneysDashboardProps) {
  const { journeys, stats, isLoading, error } = useUserJourneys(timeRangeDays);

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-destructive">Error loading journeys: {error.message}</p>
      </Card>
    );
  }

  const conversionRate = stats.totalJourneys > 0 
    ? ((stats.converted / stats.totalJourneys) * 100).toFixed(1)
    : '0';

  const registrationRate = stats.totalJourneys > 0
    ? ((stats.registered + stats.engaged + stats.qualified + stats.converted) / stats.totalJourneys * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Journeys</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <p className="text-xl font-semibold">{stats.totalJourneys}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <UserCheck className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registered</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <p className="text-xl font-semibold">{registrationRate}%</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Target className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Converted</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <p className="text-xl font-semibold">{conversionRate}%</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Layers className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Sessions to Convert</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <p className="text-xl font-semibold">{stats.avgSessionsToConvert || '-'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Hours to Register</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <p className="text-xl font-semibold">{stats.avgTimeToRegister || '-'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Qualified</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <p className="text-xl font-semibold">{stats.qualified}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel - Takes 2 columns */}
        <div className="lg:col-span-2">
          <JourneyStageFunnel stats={stats} isLoading={isLoading} />
        </div>

        {/* Attribution Table */}
        <div>
          <AttributionTable sources={stats.topSources} isLoading={isLoading} />
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Landing Pages */}
        <TopLandingPages pages={stats.topLandingPages} isLoading={isLoading} />

        {/* Live Journey Feed */}
        <JourneyLiveFeed journeys={journeys.slice(0, 10)} isLoading={isLoading} />
      </div>
    </div>
  );
}
