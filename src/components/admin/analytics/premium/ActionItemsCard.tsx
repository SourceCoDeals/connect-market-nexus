import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  Clock, 
  UserPlus, 
  Pause, 
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface ActionItemsCardProps {
  items: {
    pendingRequests: number;
    newSignupsToReview: number;
    requestsOnHold: number;
    staleListings: number;
  };
}

export function ActionItemsCard({ items }: ActionItemsCardProps) {
  const navigate = useNavigate();
  
  const actionItems = [
    {
      label: 'Pending Requests',
      count: items.pendingRequests,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      priority: items.pendingRequests > 50 ? 'high' : items.pendingRequests > 10 ? 'medium' : 'low',
      action: () => navigate('/admin'),
    },
    {
      label: 'New Signups to Review',
      count: items.newSignupsToReview,
      icon: UserPlus,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      priority: items.newSignupsToReview > 20 ? 'high' : items.newSignupsToReview > 5 ? 'medium' : 'low',
      action: () => navigate('/admin'),
    },
    {
      label: 'Requests On Hold',
      count: items.requestsOnHold,
      icon: Pause,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      priority: items.requestsOnHold > 10 ? 'high' : items.requestsOnHold > 3 ? 'medium' : 'low',
      action: () => navigate('/admin'),
    },
  ].filter(item => item.count > 0);

  const totalItems = actionItems.reduce((sum, item) => sum + item.count, 0);
  const hasHighPriority = actionItems.some(item => item.priority === 'high');

  return (
    <Card className={cn(
      "border-border/50 transition-all",
      hasHighPriority && "border-amber-500/50 shadow-amber-500/10"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className={cn(
              "h-5 w-5",
              hasHighPriority ? "text-amber-500" : "text-muted-foreground"
            )} />
            <CardTitle className="text-lg font-semibold">Action Items</CardTitle>
          </div>
          {totalItems > 0 && (
            <span className={cn(
              "text-xs font-bold px-2 py-1 rounded-full",
              hasHighPriority 
                ? "bg-amber-500/10 text-amber-500" 
                : "bg-muted text-muted-foreground"
            )}>
              {totalItems} pending
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {actionItems.length > 0 ? (
          <div className="space-y-3 mt-2">
            {actionItems.map((item) => {
              const Icon = item.icon;
              
              return (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full group flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all text-left"
                >
                  <div className={cn("rounded-lg p-2", item.bgColor)}>
                    <Icon className={cn("h-4 w-4", item.color)} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.priority === 'high' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          URGENT
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.count} item{item.count !== 1 ? 's' : ''} need attention
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold tabular-nums">
                      {item.count}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 mb-3">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <p className="font-medium text-success">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No pending action items
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
