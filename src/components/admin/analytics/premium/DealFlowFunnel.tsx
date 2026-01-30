import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Users, UserCheck, MessageSquare, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";

interface DealFlowFunnelProps {
  data: {
    totalSignups: number;
    approvedBuyers: number;
    connectionRequests: number;
    introductionsMade: number;
  };
}

export function DealFlowFunnel({ data }: DealFlowFunnelProps) {
  const stages = [
    {
      label: 'Total Signups',
      value: data.totalSignups,
      icon: Users,
      color: 'bg-blue-500',
      textColor: 'text-blue-500',
    },
    {
      label: 'Approved Buyers',
      value: data.approvedBuyers,
      icon: UserCheck,
      color: 'bg-violet-500',
      textColor: 'text-violet-500',
      conversion: data.totalSignups > 0 
        ? ((data.approvedBuyers / data.totalSignups) * 100).toFixed(1) 
        : '0',
    },
    {
      label: 'Connection Requests',
      value: data.connectionRequests,
      icon: MessageSquare,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-500',
      conversion: data.approvedBuyers > 0 
        ? ((data.connectionRequests / data.approvedBuyers) * 100).toFixed(1) 
        : '0',
    },
    {
      label: 'Introductions Made',
      value: data.introductionsMade,
      icon: Handshake,
      color: 'bg-amber-500',
      textColor: 'text-amber-500',
      conversion: data.connectionRequests > 0 
        ? ((data.introductionsMade / data.connectionRequests) * 100).toFixed(1) 
        : '0',
    },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg font-semibold">Deal Flow Funnel</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Conversion through pipeline stages
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 mt-4">
          {stages.map((stage, index) => {
            const widthPercentage = Math.max((stage.value / maxValue) * 100, 8);
            const Icon = stage.icon;
            
            return (
              <div key={stage.label} className="relative">
                {/* Connector arrow */}
                {index > 0 && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="flex flex-col items-center">
                      <ArrowRight className="h-3 w-3 text-muted-foreground/50 rotate-90" />
                      {stage.conversion && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          {stage.conversion}%
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "shrink-0 rounded-lg p-2",
                    stage.color.replace('bg-', 'bg-') + '/10'
                  )}>
                    <Icon className={cn("h-4 w-4", stage.textColor)} />
                  </div>

                  {/* Bar and label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{stage.label}</span>
                      <span className="text-lg font-bold tabular-nums">
                        {stage.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="relative h-3 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                          stage.color
                        )}
                        style={{ width: `${widthPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall conversion */}
        <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Overall Conversion</span>
          <span className="text-lg font-bold text-success">
            {data.totalSignups > 0 
              ? ((data.introductionsMade / data.totalSignups) * 100).toFixed(1) 
              : '0'}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
