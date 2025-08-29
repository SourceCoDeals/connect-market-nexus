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
  Shield
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";

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

  return null;
}