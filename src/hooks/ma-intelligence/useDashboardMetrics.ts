import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimeframeOption = '7d' | '30d' | '90d' | '1y' | 'all';

export interface PipelineStage {
  name: string;
  value: number;
  color: string;
}

export interface TimeSeriesDataPoint {
  week: string;
  dealsCreated: number;
  matchesScored: number;
  approvals: number;
  interested: number;
}

export interface ConversionRates {
  matchRate: number;
  approvalRate: number;
  interestRate: number;
  passRate: number;
}

export interface ScoreDistributionBucket {
  range: string;
  count: number;
  color: string;
}

export interface DashboardMetrics {
  pipeline: PipelineStage[];
  timeSeries: TimeSeriesDataPoint[];
  conversions: ConversionRates;
  scoreDistribution: ScoreDistributionBucket[];
  sparklines: {
    buyers: number[];
    deals: number[];
    scores: number[];
  };
  isLoading: boolean;
}

const PIPELINE_COLORS = {
  allMatches: "hsl(var(--accent))",
  strongFit: "hsl(262, 83%, 58%)",
  approved: "hsl(var(--success))",
  interested: "hsl(160, 84%, 39%)",
  passed: "hsl(var(--muted-foreground))",
};

const SCORE_DISTRIBUTION_COLORS = [
  "hsl(0, 72%, 51%)",      // 0-30: red
  "hsl(25, 95%, 53%)",     // 30-50: orange
  "hsl(47, 92%, 55%)",     // 50-70: yellow
  "hsl(142, 71%, 45%)",    // 70-85: light green
  "hsl(142, 76%, 36%)",    // 85-100: dark green
];

function getDateRange(timeframe: TimeframeOption): { start: Date | null } {
  const now = new Date();
  switch (timeframe) {
    case '7d':
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    case '30d':
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    case '90d':
      return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    case '1y':
      return { start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
    case 'all':
    default:
      return { start: null };
  }
}

export function useDashboardMetrics(timeframe: TimeframeOption): DashboardMetrics {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    pipeline: [],
    timeSeries: [],
    conversions: { matchRate: 0, approvalRate: 0, interestRate: 0, passRate: 0 },
    scoreDistribution: [],
    sparklines: { buyers: [], deals: [], scores: [] },
    isLoading: true,
  });

  const loadMetrics = useCallback(async () => {
    setMetrics(prev => ({ ...prev, isLoading: true }));

    try {
      const { start } = getDateRange(timeframe);
      const startDate = start?.toISOString();

      // Parallel queries for all metrics
      const [pipelineData, timeSeriesData, distributionData, sparklineData] = await Promise.all([
        fetchPipelineData(startDate),
        fetchTimeSeriesData(),
        fetchScoreDistribution(startDate),
        fetchSparklineData(),
      ]);

      // Calculate pipeline stages
      const pipeline: PipelineStage[] = [
        { name: "All Matches", value: pipelineData.totalMatches, color: PIPELINE_COLORS.allMatches },
        { name: "Strong Fit (70+)", value: pipelineData.strongFit, color: PIPELINE_COLORS.strongFit },
        { name: "Approved", value: pipelineData.approved, color: PIPELINE_COLORS.approved },
        { name: "Interested", value: pipelineData.interested, color: PIPELINE_COLORS.interested },
      ];

      // Calculate conversion rates
      const conversions: ConversionRates = {
        matchRate: pipelineData.totalMatches > 0
          ? Math.round((pipelineData.strongFit / pipelineData.totalMatches) * 100)
          : 0,
        approvalRate: pipelineData.strongFit > 0
          ? Math.round((pipelineData.approved / pipelineData.strongFit) * 100)
          : 0,
        interestRate: pipelineData.approved > 0
          ? Math.round((pipelineData.interested / pipelineData.approved) * 100)
          : 0,
        passRate: pipelineData.totalEngaged > 0
          ? Math.round((pipelineData.passed / pipelineData.totalEngaged) * 100)
          : 0,
      };

      // Format score distribution
      const scoreDistribution: ScoreDistributionBucket[] = [
        { range: "0-30", count: distributionData.bucket0to30, color: SCORE_DISTRIBUTION_COLORS[0] },
        { range: "30-50", count: distributionData.bucket30to50, color: SCORE_DISTRIBUTION_COLORS[1] },
        { range: "50-70", count: distributionData.bucket50to70, color: SCORE_DISTRIBUTION_COLORS[2] },
        { range: "70-85", count: distributionData.bucket70to85, color: SCORE_DISTRIBUTION_COLORS[3] },
        { range: "85-100", count: distributionData.bucket85to100, color: SCORE_DISTRIBUTION_COLORS[4] },
      ];

      setMetrics({
        pipeline,
        timeSeries: timeSeriesData,
        conversions,
        scoreDistribution,
        sparklines: sparklineData,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error loading dashboard metrics:", error);
      setMetrics(prev => ({ ...prev, isLoading: false }));
    }
  }, [timeframe]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return metrics;
}

async function fetchPipelineData(startDate?: string) {
  let query = supabase.from("buyer_deal_scores").select("composite_score, selected_for_outreach, interested, passed_on_deal");

  if (startDate) {
    query = query.gte("scored_at", startDate);
  }

  const { data, error } = await query;

  if (error) throw error;

  const scores = data || [];
  return {
    totalMatches: scores.length,
    strongFit: scores.filter(s => (s.composite_score || 0) >= 70).length,
    approved: scores.filter(s => s.selected_for_outreach === true).length,
    interested: scores.filter(s => s.interested === true).length,
    passed: scores.filter(s => s.passed_on_deal === true).length,
    totalEngaged: scores.filter(s => s.selected_for_outreach === true || s.passed_on_deal === true).length,
  };
}

async function fetchTimeSeriesData(): Promise<TimeSeriesDataPoint[]> {
  // Get data for last 8 weeks
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [scoresData, dealsData] = await Promise.all([
    supabase
      .from("buyer_deal_scores")
      .select("scored_at, selected_for_outreach, interested")
      .gte("scored_at", eightWeeksAgo.toISOString()),
    supabase
      .from("deals")
      .select("created_at")
      .gte("created_at", eightWeeksAgo.toISOString()),
  ]);

  // Group by week
  const weekMap = new Map<string, TimeSeriesDataPoint>();

  // Initialize last 8 weeks
  for (let i = 7; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - (i * 7));
    const weekKey = getWeekKey(date);
    weekMap.set(weekKey, {
      week: weekKey,
      dealsCreated: 0,
      matchesScored: 0,
      approvals: 0,
      interested: 0,
    });
  }

  // Aggregate scores
  (scoresData.data || []).forEach(score => {
    const weekKey = getWeekKey(new Date(score.scored_at));
    const entry = weekMap.get(weekKey);
    if (entry) {
      entry.matchesScored++;
      if (score.selected_for_outreach) entry.approvals++;
      if (score.interested) entry.interested++;
    }
  });

  // Aggregate deals
  (dealsData.data || []).forEach(deal => {
    const weekKey = getWeekKey(new Date(deal.created_at));
    const entry = weekMap.get(weekKey);
    if (entry) {
      entry.dealsCreated++;
    }
  });

  return Array.from(weekMap.values());
}

async function fetchScoreDistribution(startDate?: string) {
  let query = supabase.from("buyer_deal_scores").select("composite_score");

  if (startDate) {
    query = query.gte("scored_at", startDate);
  }

  const { data, error } = await query;

  if (error) throw error;

  const scores = data || [];
  return {
    bucket0to30: scores.filter(s => (s.composite_score || 0) < 30).length,
    bucket30to50: scores.filter(s => (s.composite_score || 0) >= 30 && (s.composite_score || 0) < 50).length,
    bucket50to70: scores.filter(s => (s.composite_score || 0) >= 50 && (s.composite_score || 0) < 70).length,
    bucket70to85: scores.filter(s => (s.composite_score || 0) >= 70 && (s.composite_score || 0) < 85).length,
    bucket85to100: scores.filter(s => (s.composite_score || 0) >= 85).length,
  };
}

async function fetchSparklineData() {
  // Get daily counts for last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [buyersData, dealsData, scoresData] = await Promise.all([
    supabase.from("buyers").select("created_at").gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("deals").select("created_at").gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("buyer_deal_scores").select("scored_at").gte("scored_at", sevenDaysAgo.toISOString()),
  ]);

  const buyers: number[] = [];
  const deals: number[] = [];
  const scores: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(date.setHours(23, 59, 59, 999));

    buyers.push(
      (buyersData.data || []).filter(b => {
        const created = new Date(b.created_at);
        return created >= dayStart && created <= dayEnd;
      }).length
    );

    deals.push(
      (dealsData.data || []).filter(d => {
        const created = new Date(d.created_at);
        return created >= dayStart && created <= dayEnd;
      }).length
    );

    scores.push(
      (scoresData.data || []).filter(s => {
        const scored = new Date(s.scored_at);
        return scored >= dayStart && scored <= dayEnd;
      }).length
    );
  }

  return { buyers, deals, scores };
}

function getWeekKey(date: Date): string {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  return `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()}`;
}
