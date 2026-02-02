import { useState } from "react";
import { AnalyticsCard } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { ArrowRight, User, Building2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversionCardProps {
  funnel: {
    stages: Array<{ name: string; count: number; dropoff: number }>;
    overallConversion: number;
  };
  topUsers: Array<{
    id: string;
    name: string;
    company: string;
    sessions: number;
    pagesViewed: number;
    connections: number;
  }>;
}

function FunnelVisualization({ stages, overallConversion }: ConversionCardProps['funnel']) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  
  return (
    <div className="space-y-4">
      {/* Overall conversion badge */}
      <div className="flex justify-end">
        <div className="px-3 py-1.5 bg-[hsl(12_95%_77%)/0.1] rounded-full">
          <span className="text-sm font-medium text-[hsl(12_95%_60%)]">
            {overallConversion.toFixed(2)}% overall conversion
          </span>
        </div>
      </div>
      
      {/* Funnel bars */}
      <div className="flex items-end gap-3">
        {stages.map((stage, index) => {
          const widthPercent = (stage.count / maxCount) * 100;
          const isLast = index === stages.length - 1;
          
          return (
            <div key={stage.name} className="flex-1 space-y-2">
              <AnalyticsTooltip
                title={stage.name}
                rows={[
                  { label: 'Count', value: stage.count.toLocaleString() },
                  { label: 'Drop-off', value: `${stage.dropoff.toFixed(0)}%` },
                ]}
              >
                <div 
                  className="relative cursor-pointer group"
                  style={{ height: `${Math.max(widthPercent * 1.5, 40)}px` }}
                >
                  <div 
                    className={cn(
                      "absolute inset-0 rounded-lg transition-all group-hover:opacity-80",
                      isLast 
                        ? "bg-gradient-to-t from-[hsl(145_60%_45%)] to-[hsl(145_60%_55%)]"
                        : "bg-gradient-to-t from-[hsl(12_95%_70%)] to-[hsl(12_95%_77%)]"
                    )}
                  />
                </div>
              </AnalyticsTooltip>
              
              <div className="text-center space-y-1">
                <div className="text-lg font-medium tabular-nums">
                  {stage.count.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {stage.name}
                </div>
                {stage.dropoff > 0 && (
                  <div className="text-xs text-red-500 tabular-nums">
                    -{stage.dropoff.toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Flow arrows */}
      <div className="flex justify-center gap-8 pt-2">
        {stages.slice(0, -1).map((_, i) => (
          <ArrowRight key={i} className="h-4 w-4 text-muted-foreground" />
        ))}
      </div>
    </div>
  );
}

function TopUsersTable({ users }: { users: ConversionCardProps['topUsers'] }) {
  if (users.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No user activity data yet
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {users.slice(0, 6).map((user) => (
        <AnalyticsTooltip
          key={user.id}
          title={user.name}
          rows={[
            { label: 'Company', value: user.company || 'N/A' },
            { label: 'Sessions', value: user.sessions },
            { label: 'Connections', value: user.connections, highlight: true },
          ]}
        >
          <div className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md hover:bg-muted/30 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(12_95%_77%)] to-[hsl(12_95%_60%)] flex items-center justify-center text-white text-xs font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium">{user.name}</div>
                {user.company && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {user.company}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium tabular-nums">{user.sessions}</div>
                <div className="text-[10px] text-muted-foreground uppercase">sessions</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium tabular-nums text-[hsl(12_95%_60%)]">{user.connections}</div>
                <div className="text-[10px] text-muted-foreground uppercase">connections</div>
              </div>
            </div>
          </div>
        </AnalyticsTooltip>
      ))}
    </div>
  );
}

export function ConversionCard({ funnel, topUsers }: ConversionCardProps) {
  const tabs = [
    { id: 'funnel', label: 'Funnel' },
    { id: 'users', label: 'Top Users' },
  ];

  return (
    <AnalyticsCard
      tabs={tabs}
      defaultTab="funnel"
      className="col-span-full"
    >
      {(activeTab) => (
        <div>
          {activeTab === 'funnel' && (
            <FunnelVisualization stages={funnel.stages} overallConversion={funnel.overallConversion} />
          )}
          
          {activeTab === 'users' && (
            <TopUsersTable users={topUsers} />
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}
