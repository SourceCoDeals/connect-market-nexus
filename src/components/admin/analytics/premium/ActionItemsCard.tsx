import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface ActionItems {
  pendingRequests: number;
  newSignupsToReview: number;
  requestsOnHold: number;
  staleListings: number;
}

interface ActionItemsCardProps {
  items: ActionItems;
  className?: string;
}

export function ActionItemsCard({ items, className }: ActionItemsCardProps) {
  const navigate = useNavigate();
  
  const actionItems = [
    { 
      label: 'Pending Requests', 
      value: items.pendingRequests,
      priority: items.pendingRequests > 10 ? 'high' : items.pendingRequests > 0 ? 'medium' : 'low',
      action: () => navigate('/admin'),
    },
    { 
      label: 'New Signups', 
      value: items.newSignupsToReview,
      priority: items.newSignupsToReview > 5 ? 'high' : items.newSignupsToReview > 0 ? 'medium' : 'low',
      action: () => navigate('/admin'),
    },
    { 
      label: 'On Hold', 
      value: items.requestsOnHold,
      priority: items.requestsOnHold > 5 ? 'medium' : 'low',
      action: () => navigate('/admin'),
    },
  ].filter(item => item.value > 0);

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-coral-500/10 text-coral-500 border-coral-500/20 hover:bg-coral-500/15';
      case 'medium':
        return 'bg-peach-400/10 text-peach-500 border-peach-400/20 hover:bg-peach-400/15';
      default:
        return 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted/70';
    }
  };

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Action Items
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Tasks requiring attention
        </p>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {actionItems.map((item) => (
          <button 
            key={item.label}
            onClick={item.action}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
              "hover:scale-[1.01] cursor-pointer",
              getPriorityStyles(item.priority)
            )}
          >
            <span className="text-sm font-medium">{item.label}</span>
            <span className="text-lg font-semibold tabular-nums">
              {item.value}
            </span>
          </button>
        ))}

        {actionItems.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground/60 mt-1">No pending actions</p>
          </div>
        )}
      </div>
    </div>
  );
}
