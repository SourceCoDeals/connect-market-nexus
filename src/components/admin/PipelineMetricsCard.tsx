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

  return null;
}