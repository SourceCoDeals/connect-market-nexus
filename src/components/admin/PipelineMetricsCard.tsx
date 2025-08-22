import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Target, 
  Users, 
  CheckCircle2,
  Clock,
  ArrowUpRight,
  DollarSign
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { formatCurrency } from "@/lib/currency-utils";

interface PipelineMetricsCardProps {
  requests: AdminConnectionRequest[];
}

export function PipelineMetricsCard({ requests }: PipelineMetricsCardProps) {
  // Calculate pipeline metrics
  const totalRequests = requests.length;
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');
  
  const approvalRate = totalRequests > 0 ? (approvedRequests.length / totalRequests) * 100 : 0;
  
  // Calculate this week's approvals
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const thisWeekApprovals = approvedRequests.filter(r => 
    r.approved_at && new Date(r.approved_at) >= oneWeekAgo
  ).length;

  // Calculate deal exposure value (sum of approved deals' revenue)
  const pipelineValue = approvedRequests.reduce((sum, request) => {
    const revenue = request.listing?.revenue || 0;
    return sum + revenue;
  }, 0);

  // Buyer type breakdown for approved requests
  const buyerTypeBreakdown = approvedRequests.reduce((acc, request) => {
    const buyerType = request.user?.buyer_type || 'unknown';
    acc[buyerType] = (acc[buyerType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const metrics = [
    {
      label: "Deal Approvals Issued",
      value: approvedRequests.length,
      icon: CheckCircle2,
      trend: thisWeekApprovals > 0 ? `+${thisWeekApprovals} this week` : "No approvals this week",
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      label: "Pipeline Exposure",
      value: formatCurrency(pipelineValue),
      icon: DollarSign,
      trend: `${approvedRequests.length} deals`,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      label: "Approval Rate",
      value: `${approvalRate.toFixed(1)}%`,
      icon: TrendingUp,
      trend: `${totalRequests} total requests`,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10"
    },
    {
      label: "Pending Review",
      value: pendingRequests.length,
      icon: Clock,
      trend: "Awaiting decision",
      color: "text-warning",
      bgColor: "bg-warning/10"
    }
  ];

  const topBuyerTypes = Object.entries(buyerTypeBreakdown)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  return (
    <Card className="bg-gradient-to-r from-primary/5 via-secondary/5 to-chart-2/5 border-primary/10 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Pipeline Metrics
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Track deal approval exposure and buyer engagement
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {totalRequests} requests
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Main Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border border-border/40 bg-background/60 backdrop-blur-sm hover:bg-accent/20 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-md ${metric.bgColor}`}>
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xl font-bold text-foreground">
                  {metric.value}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {metric.trend}
                  {index === 0 && thisWeekApprovals > 0 && (
                    <ArrowUpRight className="h-3 w-3 text-success" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Buyer Type Breakdown */}
        {topBuyerTypes.length > 0 && (
          <div className="pt-4 border-t border-border/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">Top Approved Buyer Types</h4>
              <span className="text-xs text-muted-foreground">{approvedRequests.length} total approvals</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {topBuyerTypes.map(([type, count]) => {
                const percentage = approvedRequests.length > 0 ? (count / approvedRequests.length) * 100 : 0;
                const displayType = type === 'privateEquity' ? 'PE' : 
                                   type === 'familyOffice' ? 'Family Office' :
                                   type === 'searchFund' ? 'Search Fund' :
                                   type === 'corporate' ? 'Corporate' :
                                   type === 'individual' ? 'Individual' : 'Other';
                
                return (
                  <Badge 
                    key={type} 
                    variant="secondary" 
                    className="text-xs bg-background/80 text-foreground border-border/50 hover:bg-accent/50 transition-colors"
                  >
                    {displayType}: {count} ({percentage.toFixed(0)}%)
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}