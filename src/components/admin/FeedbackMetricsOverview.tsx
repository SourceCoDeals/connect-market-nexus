import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, MessageSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface FeedbackMetricsOverviewProps {
  totalFeedback: number;
  unreadCount: number;
  responseRate: number;
  averageResponseTime: number;
  categoryBreakdown: { [key: string]: number };
  priorityBreakdown: { [key: string]: number };
}

export function FeedbackMetricsOverview({
  totalFeedback,
  unreadCount,
  responseRate,
  averageResponseTime,
  categoryBreakdown,
  priorityBreakdown
}: FeedbackMetricsOverviewProps) {
  const responseRateChange = responseRate > 75 ? 'positive' : responseRate > 50 ? 'neutral' : 'negative';
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalFeedback}</div>
          <p className="text-xs text-muted-foreground">
            {unreadCount} unread messages
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
          {responseRateChange === 'positive' ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : responseRateChange === 'negative' ? (
            <TrendingDown className="h-4 w-4 text-red-600" />
          ) : (
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{responseRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            of messages responded to
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {averageResponseTime < 60 ? 
              `${averageResponseTime}m` : 
              `${Math.round(averageResponseTime / 60)}h`
            }
          </div>
          <p className="text-xs text-muted-foreground">
            average response time
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Priority Breakdown</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(priorityBreakdown).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between">
                <Badge 
                  variant={
                    priority === 'urgent' ? 'destructive' :
                    priority === 'high' ? 'secondary' :
                    'outline'
                  }
                  className="text-xs"
                >
                  {priority}
                </Badge>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}