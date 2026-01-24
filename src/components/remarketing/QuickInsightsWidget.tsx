import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Lightbulb,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Target,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickInsightsWidgetProps {
  passReasons: Array<{ category: string; count: number }>;
  approvalRate: number;
  totalDecisions: number;
  averageScore: number;
  className?: string;
}

export const QuickInsightsWidget = ({
  passReasons,
  approvalRate,
  totalDecisions,
  averageScore,
  className,
}: QuickInsightsWidgetProps) => {
  // Generate insights based on data
  const insights = useMemo(() => {
    const result: Array<{
      type: 'suggestion' | 'warning' | 'info';
      icon: React.ElementType;
      message: string;
    }> = [];
    
    // Top pass reason insight
    if (passReasons.length > 0) {
      const topReason = passReasons[0];
      if (topReason.count >= 3) {
        if (topReason.category === 'geography' || topReason.category === 'no nearby presence') {
          result.push({
            type: 'suggestion',
            icon: AlertCircle,
            message: `${topReason.count} buyers passed for geography - consider relaxing geography weight`,
          });
        } else if (topReason.category === 'size' || topReason.category === 'size mismatch') {
          result.push({
            type: 'suggestion',
            icon: AlertCircle,
            message: `${topReason.count} buyers passed for size mismatch - review size criteria`,
          });
        } else {
          result.push({
            type: 'info',
            icon: Target,
            message: `Top pass reason: "${topReason.category}" (${topReason.count} buyers)`,
          });
        }
      }
    }
    
    // Approval rate insight
    if (totalDecisions >= 5) {
      if (approvalRate >= 80) {
        result.push({
          type: 'info',
          icon: TrendingUp,
          message: `High approval rate (${approvalRate}%) - scoring is well-calibrated`,
        });
      } else if (approvalRate <= 30) {
        result.push({
          type: 'warning',
          icon: TrendingDown,
          message: `Low approval rate (${approvalRate}%) - consider adjusting criteria`,
        });
      }
    }
    
    // Average score insight
    if (averageScore > 0) {
      if (averageScore >= 75) {
        result.push({
          type: 'info',
          icon: Target,
          message: `Strong average score (${averageScore}%) - quality buyer pool`,
        });
      } else if (averageScore <= 50) {
        result.push({
          type: 'warning',
          icon: AlertCircle,
          message: `Low average score (${averageScore}%) - may need broader universe`,
        });
      }
    }
    
    return result;
  }, [passReasons, approvalRate, totalDecisions, averageScore]);

  if (insights.length === 0 || totalDecisions < 3) {
    return null;
  }

  return (
    <Collapsible className={cn("rounded-lg border bg-muted/30", className)}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-sm">Quick Insights</span>
          <Badge variant="secondary" className="text-xs">
            {insights.length}
          </Badge>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-2">
          {insights.map((insight, i) => {
            const Icon = insight.icon;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 text-sm p-2 rounded-md",
                  insight.type === 'warning' && "bg-amber-50 text-amber-800",
                  insight.type === 'suggestion' && "bg-blue-50 text-blue-800",
                  insight.type === 'info' && "bg-muted"
                )}
              >
                <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{insight.message}</span>
              </div>
            );
          })}
          
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
              <Link to="/admin/remarketing/analytics">
                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                View Full Analytics
              </Link>
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default QuickInsightsWidget;
