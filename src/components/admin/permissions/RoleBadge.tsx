import { Crown, Shield, Eye, User } from 'lucide-react';
import { AppRole } from '@/hooks/permissions/usePermissions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RoleBadgeProps {
  role: AppRole;
  showTooltip?: boolean;
}

const roleConfig: Record<AppRole, {
  label: string;
  icon: typeof Crown;
  gradient: string;
  description: string;
}> = {
  owner: {
    label: 'Owner',
    icon: Crown,
    gradient: 'from-amber-500 to-orange-500',
    description: 'Full system access and permission management',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    gradient: 'from-primary to-primary/70',
    description: 'Administrative access to manage users and content',
  },
  moderator: {
    label: 'Moderator',
    icon: Eye,
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Can review and moderate content',
  },
  user: {
    label: 'User',
    icon: User,
    gradient: 'from-muted-foreground to-muted',
    description: 'Standard user access',
  },
};

export const RoleBadge = ({ role, showTooltip = true }: RoleBadgeProps) => {
  const config = roleConfig[role];
  const Icon = config.icon;

  const badge = (
    <div className={`
      inline-flex items-center gap-1.5 px-3 py-1
      rounded-full text-xs font-medium
      bg-gradient-to-r ${config.gradient}
      text-white shadow-sm
      transition-all duration-200
      hover:shadow-md hover:scale-105
    `}>
      <Icon className="h-3 w-3" />
      {config.label}
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
