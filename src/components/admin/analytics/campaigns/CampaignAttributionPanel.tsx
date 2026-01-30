import { useCampaignAttribution } from "@/hooks/useCampaignAttribution";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Megaphone, 
  ArrowRight,
  TrendingUp,
  Target,
  BarChart3
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Cell
} from "recharts";

interface CampaignAttributionPanelProps {
  timeRangeDays: number;
}

export function CampaignAttributionPanel({ timeRangeDays }: CampaignAttributionPanelProps) {
  const { data, isLoading, error } = useCampaignAttribution(timeRangeDays);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Unable to load campaign attribution data</p>
      </div>
    );
  }

  const COLORS = ['hsl(var(--coral-400))', 'hsl(var(--peach-400))', 'hsl(var(--primary))', 'hsl(var(--muted-foreground))'];

  const funnelData = [
    { name: 'Total Sessions', value: data.attributionFunnel.totalSessions, fill: 'hsl(var(--coral-200))' },
    { name: 'With UTM', value: data.attributionFunnel.withUtm, fill: 'hsl(var(--coral-300))' },
    { name: 'Registered Users', value: data.attributionFunnel.withViews, fill: 'hsl(var(--coral-400))' },
    { name: 'Conversions', value: data.attributionFunnel.withConversions, fill: 'hsl(var(--coral-500))' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Megaphone className="h-5 w-5 text-coral-500" />
        <div>
          <h3 className="text-lg font-medium">Campaign Attribution</h3>
          <p className="text-xs text-muted-foreground">UTM tracking and conversion attribution</p>
        </div>
      </div>

      {/* Attribution Funnel */}
      <div className="rounded-2xl bg-card border border-border/50 p-6">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Attribution Funnel
          </p>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {funnelData.map((stage, index) => (
            <div key={stage.name} className="text-center">
              <div className="text-2xl font-light tabular-nums text-foreground">
                {stage.value.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{stage.name}</div>
              {index < funnelData.length - 1 && (
                <div className="text-xs text-muted-foreground mt-2">
                  {stage.value > 0 
                    ? `${((funnelData[index + 1].value / stage.value) * 100).toFixed(1)}%`
                    : '—'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Source + Medium Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Performance */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Traffic Sources
            </p>
          </div>
          
          <div className="space-y-3">
            {data.sourcePerformance.slice(0, 6).map((source, index) => {
              const maxSessions = data.sourcePerformance[0]?.sessions || 1;
              
              return (
                <div key={source.source}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate max-w-[150px]">
                      {source.source}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        {source.sessions.toLocaleString()} sessions
                      </span>
                      <span className="font-medium text-coral-500">
                        {source.conversionRate.toFixed(1)}% conv
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-coral-400 to-coral-500 rounded-full transition-all"
                      style={{ width: `${(source.sessions / maxSessions) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            
            {data.sourcePerformance.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No UTM source data available
              </p>
            )}
          </div>
        </div>

        {/* Medium Performance */}
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Traffic Medium
            </p>
          </div>
          
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.mediumComparison.slice(0, 5)} layout="vertical">
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis 
                  type="category" 
                  dataKey="medium" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  width={80}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    value.toLocaleString(), 
                    name === 'sessions' ? 'Sessions' : 'Conversions'
                  ]}
                />
                <Bar dataKey="sessions" fill="hsl(var(--peach-400))" radius={[0, 4, 4, 0]} name="sessions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Campaign Performance Table */}
      {data.campaignPerformance.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Campaign Performance
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Source</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Sessions</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Conversions</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Conv Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.campaignPerformance.slice(0, 8).map((campaign, index) => (
                  <tr 
                    key={campaign.campaign} 
                    className={index % 2 === 0 ? 'bg-muted/20' : ''}
                  >
                    <td className="py-2 px-3 font-medium truncate max-w-[180px]">
                      {campaign.campaign}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {campaign.source}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {campaign.sessions.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium">
                      {campaign.conversions}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      <span className={campaign.conversionRate > 5 ? 'text-green-600' : ''}>
                        {campaign.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Combinations */}
      {data.topCombinations.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/50 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Target className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Top Converting Combinations
            </p>
          </div>
          
          <div className="space-y-3">
            {data.topCombinations.map((combo, index) => (
              <div 
                key={`${combo.source}-${combo.campaign}`}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-light text-muted-foreground">#{index + 1}</span>
                  <div>
                    <div className="text-sm font-medium">
                      {combo.source} <ArrowRight className="h-3 w-3 inline mx-1" /> {combo.medium}
                    </div>
                    <div className="text-xs text-muted-foreground">{combo.campaign}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-medium text-coral-500">{combo.conversions}</div>
                  <div className="text-xs text-muted-foreground">conversions</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[120px] rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[280px] rounded-2xl" />
        <Skeleton className="h-[280px] rounded-2xl" />
      </div>
      <Skeleton className="h-[200px] rounded-2xl" />
    </div>
  );
}
