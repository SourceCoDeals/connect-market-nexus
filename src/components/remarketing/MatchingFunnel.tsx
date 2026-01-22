import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FunnelStage } from '@/hooks/useReMarketingAnalytics';
import { ArrowDown, Target, Users, Mail, FileCheck, Calendar, Trophy } from 'lucide-react';

interface MatchingFunnelProps {
  data: FunnelStage[];
  className?: string;
}

const stageConfig: Record<string, { icon: typeof Target; color: string }> = {
  'Scored': { icon: Target, color: 'bg-slate-500' },
  'Tier A/B': { icon: Users, color: 'bg-blue-500' },
  'Contacted': { icon: Mail, color: 'bg-purple-500' },
  'NDA Signed': { icon: FileCheck, color: 'bg-indigo-500' },
  'Meeting': { icon: Calendar, color: 'bg-emerald-500' },
  'Won': { icon: Trophy, color: 'bg-amber-500' }
};

export function MatchingFunnel({ data, className }: MatchingFunnelProps) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Matching Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((stage, index) => {
            const config = stageConfig[stage.stage] || stageConfig['Scored'];
            const Icon = config.icon;
            const widthPercentage = (stage.count / maxCount) * 100;
            const isLast = index === data.length - 1;
            
            return (
              <React.Fragment key={stage.stage}>
                <div className="relative">
                  {/* Stage bar */}
                  <div 
                    className={cn(
                      "relative rounded-lg p-3 transition-all duration-300",
                      config.color,
                      "text-white"
                    )}
                    style={{ 
                      width: `${Math.max(widthPercentage, 20)}%`,
                      marginLeft: `${(100 - Math.max(widthPercentage, 20)) / 2}%`
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium text-sm">{stage.stage}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{stage.count.toLocaleString()}</span>
                        <span className="text-xs opacity-75">
                          ({stage.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Conversion rate arrow */}
                  {!isLast && stage.conversionRate !== undefined && (
                    <div className="flex items-center justify-center py-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowDown className="h-3 w-3" />
                        <span>{stage.conversionRate.toFixed(1)}% conversion</span>
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Summary */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">
                {data[0]?.count > 0 
                  ? ((data[data.length - 1]?.count / data[0].count) * 100).toFixed(1)
                  : 0}%
              </p>
              <p className="text-xs text-muted-foreground">Overall Conversion</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">
                {data.find(d => d.stage === 'Tier A/B')?.percentage.toFixed(1) || 0}%
              </p>
              <p className="text-xs text-muted-foreground">Quality Match Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-500">
                {data.find(d => d.stage === 'Meeting')?.count || 0}
              </p>
              <p className="text-xs text-muted-foreground">Active Meetings</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
