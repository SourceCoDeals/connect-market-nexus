import { useMemo } from "react";
import { useUserJourneys } from "@/hooks/useUserJourneys";
import { 
  calculatePathAnalysis, 
  calculateSourceCohorts, 
  calculateMilestoneTimings 
} from "@/hooks/useJourneyTimeline";
import { JourneyStageFunnel } from "./JourneyStageFunnel";
import { JourneyLiveFeed } from "./JourneyLiveFeed";
import { AttributionTable } from "./AttributionTable";
import { TopLandingPages } from "./TopLandingPages";
import { PathAnalysisChart } from "./PathAnalysisChart";
import { MilestoneVelocityChart } from "./MilestoneVelocityChart";
import { SourceCohortAnalysis } from "./SourceCohortAnalysis";
import { Skeleton } from "@/components/ui/skeleton";

interface UserJourneysDashboardProps {
  timeRangeDays: number;
}

export function UserJourneysDashboard({ timeRangeDays }: UserJourneysDashboardProps) {
  const { journeys, stats, isLoading, error } = useUserJourneys(timeRangeDays);

  // Calculate derived analytics
  const sourceCohorts = useMemo(() => 
    calculateSourceCohorts(journeys), 
    [journeys]
  );

  const milestoneTimings = useMemo(() => 
    calculateMilestoneTimings(journeys),
    [journeys]
  );

  const pathAnalysis = useMemo(() => {
    // Build a simple path map from first landing page
    const pageViewsBySession = new Map<string, string[]>();
    journeys.forEach(j => {
      if (j.last_session_id && j.first_landing_page) {
        pageViewsBySession.set(j.last_session_id, [j.first_landing_page, j.last_page_path || '/'].filter(Boolean));
      }
    });
    return calculatePathAnalysis(journeys, pageViewsBySession);
  }, [journeys]);

  if (error) {
    return (
      <div className="rounded-2xl bg-card border border-border/50 p-6">
        <p className="text-destructive">Error loading journeys: {error.message}</p>
      </div>
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
      {/* Hero Stats - Premium 3-column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Journeys */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Total Journeys
          </p>
          {isLoading ? (
            <Skeleton className="h-12 w-24 mt-2" />
          ) : (
            <p className="text-4xl md:text-5xl font-light tracking-tight tabular-nums mt-2">
              {stats.totalJourneys.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-1">
            Last {timeRangeDays} days
          </p>
        </div>

        {/* Registration Rate */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Registration Rate
          </p>
          {isLoading ? (
            <Skeleton className="h-12 w-24 mt-2" />
          ) : (
            <p className="text-4xl md:text-5xl font-light tracking-tight tabular-nums mt-2">
              {registrationRate}%
            </p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-1">
            Visitor → Registered
          </p>
        </div>

        {/* Conversion Rate */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Conversion Rate
          </p>
          {isLoading ? (
            <Skeleton className="h-12 w-24 mt-2" />
          ) : (
            <p className="text-4xl md:text-5xl font-light tracking-tight tabular-nums mt-2 text-coral-500">
              {conversionRate}%
            </p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-1">
            Visitor → Connection
          </p>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Avg Sessions to Convert
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : (
            <p className="text-2xl font-light tracking-tight tabular-nums mt-2">
              {stats.avgSessionsToConvert || '-'}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Avg Hours to Register
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : (
            <p className="text-2xl font-light tracking-tight tabular-nums mt-2">
              {stats.avgTimeToRegister || '-'}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Qualified Leads
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : (
            <p className="text-2xl font-light tracking-tight tabular-nums mt-2">
              {stats.qualified}
            </p>
          )}
        </div>
      </div>

      {/* Row 1: Funnel + Source Cohort Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JourneyStageFunnel stats={stats} isLoading={isLoading} />
        <SourceCohortAnalysis cohorts={sourceCohorts} isLoading={isLoading} />
      </div>

      {/* Row 2: Milestone Velocity + Attribution Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MilestoneVelocityChart timings={milestoneTimings} isLoading={isLoading} />
        <AttributionTable sources={stats.topSources} isLoading={isLoading} />
      </div>

      {/* Row 3: Path Analysis + Top Landing Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PathAnalysisChart paths={pathAnalysis} isLoading={isLoading} />
        <TopLandingPages pages={stats.topLandingPages} isLoading={isLoading} />
      </div>

      {/* Row 4: Live Journey Feed (full width, clickable) */}
      <JourneyLiveFeed journeys={journeys.slice(0, 15)} isLoading={isLoading} />
    </div>
  );
}
