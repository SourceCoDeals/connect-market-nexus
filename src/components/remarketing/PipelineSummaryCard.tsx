import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Mail,
  Calendar,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineStage {
  key: string;
  label: string;
  icon: React.ElementType;
  count: number;
  color: string;
}

interface PipelineSummaryCardProps {
  scored: number;
  approved: number;
  contacted: number;
  meetingScheduled: number;
  closedWon: number;
  className?: string;
}

export const PipelineSummaryCard = ({
  scored,
  approved,
  contacted,
  meetingScheduled,
  closedWon,
  className,
}: PipelineSummaryCardProps) => {
  const stages: PipelineStage[] = useMemo(() => [
    { key: 'scored', label: 'Scored', icon: Target, count: scored, color: 'bg-slate-500' },
    { key: 'approved', label: 'Approved', icon: Target, count: approved, color: 'bg-emerald-500' },
    { key: 'contacted', label: 'Contacted', icon: Mail, count: contacted, color: 'bg-blue-500' },
    { key: 'meeting', label: 'Meeting', icon: Calendar, count: meetingScheduled, color: 'bg-purple-500' },
    { key: 'won', label: 'Won', icon: Trophy, count: closedWon, color: 'bg-amber-500' },
  ], [scored, approved, contacted, meetingScheduled, closedWon]);

  // Calculate conversion rates
  const conversionRates = useMemo(() => ({
    approvedToContacted: approved > 0 ? Math.round((contacted / approved) * 100) : 0,
    contactedToMeeting: contacted > 0 ? Math.round((meetingScheduled / contacted) * 100) : 0,
    meetingToWon: meetingScheduled > 0 ? Math.round((closedWon / meetingScheduled) * 100) : 0,
    overallConversion: scored > 0 ? Math.round((closedWon / scored) * 100) : 0,
  }), [scored, approved, contacted, meetingScheduled, closedWon]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Pipeline Summary</span>
          {closedWon > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              {conversionRates.overallConversion}% overall
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Funnel Visualization */}
        <div className="flex items-center justify-between gap-2">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            const isActive = stage.count > 0;
            
            return (
              <div key={stage.key} className="flex items-center gap-2">
                <div className="text-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center mb-1",
                    isActive ? stage.color : "bg-muted"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5",
                      isActive ? "text-white" : "text-muted-foreground"
                    )} />
                  </div>
                  <p className="text-lg font-bold">{stage.count}</p>
                  <p className="text-xs text-muted-foreground">{stage.label}</p>
                </div>
                {i < stages.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 mt-[-20px]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Conversion Rates */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Approved → Contacted</span>
            <div className="flex items-center gap-2">
              <Progress value={conversionRates.approvedToContacted} className="w-16 h-1.5" />
              <span className="font-medium w-10 text-right">{conversionRates.approvedToContacted}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Contacted → Meeting</span>
            <div className="flex items-center gap-2">
              <Progress value={conversionRates.contactedToMeeting} className="w-16 h-1.5" />
              <span className="font-medium w-10 text-right">{conversionRates.contactedToMeeting}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Meeting → Won</span>
            <div className="flex items-center gap-2">
              <Progress value={conversionRates.meetingToWon} className="w-16 h-1.5" />
              <span className="font-medium w-10 text-right">{conversionRates.meetingToWon}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PipelineSummaryCard;
