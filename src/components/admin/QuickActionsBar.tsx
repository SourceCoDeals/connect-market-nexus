import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Users, 
  Mail, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  FileText,
  Shield,
  Send
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { EmailTestButton } from "./EmailTestButton";

interface QuickActionsBarProps {
  requests: AdminConnectionRequest[];
  onBulkAction?: (action: string, requestIds: string[]) => void;
}

export function QuickActionsBar({ requests, onBulkAction }: QuickActionsBarProps) {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);

  // Calculate quick stats
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    needingNDA: requests.filter(r => !r.user?.nda_signed && r.status === 'pending').length,
    needingFee: requests.filter(r => !r.user?.fee_agreement_signed && r.status === 'pending').length,
    needingFollowup: requests.filter(r => !r.followed_up && r.status === 'approved').length
  };

  const quickActions = [
    {
      id: 'send-all-ndas',
      label: 'Send NDAs',
      count: stats.needingNDA,
      icon: Shield,
      variant: 'default' as const,
      disabled: stats.needingNDA === 0
    },
    {
      id: 'send-all-fees',
      label: 'Send Fee Agreements',
      count: stats.needingFee,
      icon: FileText,
      variant: 'default' as const,
      disabled: stats.needingFee === 0
    },
    {
      id: 'follow-up-all',
      label: 'Follow Up',
      count: stats.needingFollowup,
      icon: Mail,
      variant: 'secondary' as const,
      disabled: stats.needingFollowup === 0
    }
  ];

  return (
    <Card className="p-4 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Quick Actions</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {stats.pending} pending
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {quickActions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant}
            size="sm"
            disabled={action.disabled}
            onClick={() => onBulkAction?.(action.id, [])}
            className="flex items-center justify-between h-12 px-4 transition-all hover:scale-105 disabled:hover:scale-100"
          >
            <div className="flex items-center gap-2">
              <action.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{action.label}</span>
            </div>
            {action.count > 0 && (
              <div className="flex items-center gap-1">
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-background/80 text-foreground border-border/50"
                >
                  {action.count}
                </Badge>
                <ArrowRight className="h-3 w-3" />
              </div>
            )}
          </Button>
        ))}
      </div>

      {/* Quick stats row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{stats.total} total</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{stats.pending} pending</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>{stats.total - stats.pending} processed</span>
        </div>
        <EmailTestButton />
      </div>
      </div>
    </Card>
  );
}