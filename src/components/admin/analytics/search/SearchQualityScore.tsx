import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { Target, Clock, Award } from "lucide-react";

interface SearchQualityScoreProps {
  timeRangeDays: number;
}

export function SearchQualityScore({ timeRangeDays }: SearchQualityScoreProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['search-quality', timeRangeDays],
    queryFn: async () => {
      const startDate = subDays(new Date(), timeRangeDays);
      
      const { data: searches, error } = await supabase
        .from('search_analytics')
        .select('time_to_click, position_clicked, results_count')
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      
      const searchData = searches || [];
      
      // Calculate position distribution
      const positionCounts: Record<number, number> = {};
      let totalTimeToClick = 0;
      let timeToClickCount = 0;
      let clickedSearches = 0;
      let top3Clicks = 0;
      
      searchData.forEach(s => {
        if (s.position_clicked !== null && s.position_clicked !== undefined) {
          const pos = Math.min(s.position_clicked, 10); // Cap at 10+
          positionCounts[pos] = (positionCounts[pos] || 0) + 1;
          clickedSearches++;
          
          if (s.position_clicked <= 3) {
            top3Clicks++;
          }
        }
        
        if (s.time_to_click !== null && s.time_to_click !== undefined) {
          totalTimeToClick += s.time_to_click;
          timeToClickCount++;
        }
      });
      
      // Position distribution for chart
      const positionDistribution = Array.from({ length: 10 }, (_, i) => ({
        position: i + 1,
        label: i === 9 ? '10+' : `#${i + 1}`,
        count: positionCounts[i + 1] || 0,
      }));
      
      // Calculate quality score (0-100)
      // Based on: % clicking top 3 results + speed of click
      const top3Rate = clickedSearches > 0 ? (top3Clicks / clickedSearches) : 0;
      const avgTimeToClick = timeToClickCount > 0 ? totalTimeToClick / timeToClickCount : 0;
      
      // Score formula: 60% from top3 rate, 40% from speed (faster = better, capped at 30s)
      const speedScore = avgTimeToClick > 0 
        ? Math.max(0, 1 - (avgTimeToClick / 30)) // 0-30 seconds maps to 1-0
        : 0.5;
      
      const qualityScore = Math.round((top3Rate * 60) + (speedScore * 40));
      
      return {
        qualityScore,
        avgTimeToClick: timeToClickCount > 0 ? Math.round(avgTimeToClick) : null,
        top3Rate: Math.round(top3Rate * 100),
        clickThroughRate: searchData.length > 0 
          ? Math.round((clickedSearches / searchData.length) * 100) 
          : 0,
        positionDistribution,
        totalSearches: searchData.length,
        clickedSearches,
      };
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return <Skeleton className="h-[380px] rounded-2xl" />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-card border border-border/50 p-6 text-center">
        <p className="text-muted-foreground">Unable to load search quality data</p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Work';
  };

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Search Quality Score
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          How well users find what they're looking for
        </p>
      </div>

      {/* Quality Score Hero */}
      <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-muted/30">
        <div className="flex items-center gap-4">
          <div className={cn(
            "h-16 w-16 rounded-full flex items-center justify-center",
            "bg-gradient-to-br from-coral-500/20 to-peach-500/20 border-2",
            data.qualityScore >= 70 ? "border-green-500" : 
            data.qualityScore >= 50 ? "border-yellow-500" : "border-red-500"
          )}>
            <span className={cn("text-2xl font-bold tabular-nums", getScoreColor(data.qualityScore))}>
              {data.qualityScore}
            </span>
          </div>
          <div>
            <p className={cn("text-lg font-semibold", getScoreColor(data.qualityScore))}>
              {getScoreLabel(data.qualityScore)}
            </p>
            <p className="text-xs text-muted-foreground">
              Based on click position & speed
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Target className="h-3 w-3" />
              <span className="text-[10px] uppercase">Top 3</span>
            </div>
            <p className="text-lg font-light tabular-nums">{data.top3Rate}%</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] uppercase">Avg Time</span>
            </div>
            <p className="text-lg font-light tabular-nums">
              {data.avgTimeToClick !== null ? `${data.avgTimeToClick}s` : '—'}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Award className="h-3 w-3" />
              <span className="text-[10px] uppercase">CTR</span>
            </div>
            <p className="text-lg font-light tabular-nums">{data.clickThroughRate}%</p>
          </div>
        </div>
      </div>

      {/* Position Distribution */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Click Position Distribution
        </p>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.positionDistribution} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value} clicks`, 'Clicks']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.positionDistribution.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index < 3 ? 'hsl(var(--coral-500))' : 'hsl(var(--muted-foreground) / 0.3)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          {data.clickedSearches} of {data.totalSearches} searches resulted in a click
        </p>
      </div>
    </div>
  );
}
