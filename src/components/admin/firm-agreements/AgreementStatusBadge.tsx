import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Check, X, Send, AlertTriangle, Clock, Ban, Timer,
} from 'lucide-react';
import type { AgreementStatus } from '@/hooks/admin/use-firm-agreements';

const STATUS_CONFIG: Record<AgreementStatus, {
  label: string;
  icon: typeof Check;
  className: string;
}> = {
  not_started: {
    label: 'Not Started',
    icon: X,
    className: 'border-border/40 bg-muted/30 text-muted-foreground',
  },
  sent: {
    label: 'Sent',
    icon: Send,
    className: 'border-blue-500/20 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400',
  },
  redlined: {
    label: 'Redlined',
    icon: AlertTriangle,
    className: 'border-orange-500/20 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400',
  },
  under_review: {
    label: 'Under Review',
    icon: Clock,
    className: 'border-yellow-500/20 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400',
  },
  signed: {
    label: 'Signed',
    icon: Check,
    className: 'border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400',
  },
  expired: {
    label: 'Expired',
    icon: Timer,
    className: 'border-red-500/20 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400',
  },
  declined: {
    label: 'Declined',
    icon: Ban,
    className: 'border-red-500/20 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400',
  },
};

interface AgreementStatusBadgeProps {
  status: AgreementStatus;
  size?: 'sm' | 'default';
  className?: string;
}

export function AgreementStatusBadge({ status, size = 'default', className }: AgreementStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-xs',
        config.className,
        className,
      )}
    >
      <Icon className={cn('mr-1', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      {config.label}
    </Badge>
  );
}

export { STATUS_CONFIG };
