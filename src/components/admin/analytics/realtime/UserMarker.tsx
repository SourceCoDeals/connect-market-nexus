import { getAvatarColor, getInitials } from "@/lib/anonymousNames";
import { cn } from "@/lib/utils";
import type { EnhancedActiveUser } from "@/hooks/useEnhancedRealTimeAnalytics";

interface UserMarkerProps {
  user: EnhancedActiveUser;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  onHover?: (user: EnhancedActiveUser | null) => void;
  onClick?: (user: EnhancedActiveUser) => void;
}

export function UserMarker({ 
  user, 
  size = 'md', 
  showPulse = true,
  onHover,
  onClick 
}: UserMarkerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[8px]',
    md: 'w-8 h-8 text-[10px]',
    lg: 'w-10 h-10 text-xs',
  };
  
  const pulseSize = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-18 h-18',
  };
  
  const avatarColor = user.isAnonymous 
    ? getAvatarColor(user.displayName)
    : getBuyerTypeColor(user.buyerType);
  
  const initials = getInitials(user.displayName);
  
  return (
    <div 
      className="relative cursor-pointer group"
      onMouseEnter={() => onHover?.(user)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(user)}
    >
      {/* Pulse animation */}
      {showPulse && (
        <>
          <div className={cn(
            "absolute inset-0 rounded-full bg-coral-500/30 animate-ping",
            pulseSize[size]
          )} style={{ 
            animationDuration: '2s',
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
          }} />
          <div className={cn(
            "absolute inset-0 rounded-full bg-coral-500/20",
            pulseSize[size]
          )} style={{ 
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
          }} />
        </>
      )}
      
      {/* Avatar */}
      <div className={cn(
        "relative rounded-full flex items-center justify-center font-semibold text-white shadow-lg ring-2 ring-white/20 transition-transform group-hover:scale-110",
        sizeClasses[size],
        avatarColor
      )}>
        {initials}
      </div>
    </div>
  );
}

function getBuyerTypeColor(buyerType: string | null): string {
  const colorMap: Record<string, string> = {
    'privateEquity': 'bg-violet-500',
    'familyOffice': 'bg-emerald-500',
    'corporate': 'bg-blue-500',
    'searchFund': 'bg-amber-500',
    'independentSponsor': 'bg-cyan-500',
    'individual': 'bg-rose-500',
  };
  
  return colorMap[buyerType || ''] || 'bg-slate-500';
}

// Inline avatar for lists
export function InlineUserAvatar({ user, size = 'sm' }: { user: EnhancedActiveUser; size?: 'sm' | 'md' }) {
  const sizeClasses = {
    sm: 'w-5 h-5 text-[8px]',
    md: 'w-6 h-6 text-[9px]',
  };
  
  const avatarColor = user.isAnonymous 
    ? getAvatarColor(user.displayName)
    : getBuyerTypeColor(user.buyerType);
  
  const initials = getInitials(user.displayName);
  
  return (
    <div className={cn(
      "rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0",
      sizeClasses[size],
      avatarColor
    )}>
      {initials}
    </div>
  );
}
