import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Flame, Sun, Clock, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, differenceInHours, formatDistanceToNow } from 'date-fns';

export type EngagementLevel = 'hot' | 'warm' | 'stale' | 'cold' | 'new';

interface EngagementIndicatorProps {
  lastViewedAt: string | null;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
  className?: string;
}

const getEngagementLevel = (lastViewedAt: string | null): EngagementLevel => {
  if (!lastViewedAt) return 'new';
  
  const viewedDate = new Date(lastViewedAt);
  const now = new Date();
  const hoursSince = differenceInHours(now, viewedDate);
  const daysSince = differenceInDays(now, viewedDate);
  
  if (hoursSince < 24) return 'hot';
  if (daysSince <= 7) return 'warm';
  if (daysSince <= 14) return 'stale';
  return 'cold';
};

const config: Record<EngagementLevel, {
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Flame;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  hot: {
    label: 'Hot',
    shortLabel: '🔥',
    description: 'Viewed in the last 24 hours',
    icon: Flame,
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-500/30',
  },
  warm: {
    label: 'Warm',
    shortLabel: '☀️',
    description: 'Viewed in the last 7 days',
    icon: Sun,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/30',
  },
  stale: {
    label: 'Getting Stale',
    shortLabel: '⏰',
    description: 'Not viewed in 7-14 days',
    icon: Clock,
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-500/30',
  },
  cold: {
    label: 'Cold',
    shortLabel: '❄️',
    description: 'Not viewed in 14+ days',
    icon: Snowflake,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/30',
  },
  new: {
    label: 'New',
    shortLabel: '✨',
    description: 'Never viewed',
    icon: Sun,
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-500/30',
  },
};

const sizeConfig = {
  sm: 'text-xs px-1.5 py-0.5 gap-1',
  md: 'text-sm px-2 py-1 gap-1.5',
};

export const EngagementIndicator = ({
  lastViewedAt,
  size = 'sm',
  showTooltip = true,
  className,
}: EngagementIndicatorProps) => {
  const level = getEngagementLevel(lastViewedAt);
  const levelConfig = config[level];
  const Icon = levelConfig.icon;
  
  const timeAgo = lastViewedAt 
    ? formatDistanceToNow(new Date(lastViewedAt), { addSuffix: true })
    : 'Never viewed';

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'font-medium border inline-flex items-center',
        levelConfig.bgColor,
        levelConfig.textColor,
        levelConfig.borderColor,
        sizeConfig[size],
        className
      )}
    >
      <Icon className={cn('shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
      <span>{levelConfig.label}</span>
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{levelConfig.description}</p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export { getEngagementLevel };
export default EngagementIndicator;
