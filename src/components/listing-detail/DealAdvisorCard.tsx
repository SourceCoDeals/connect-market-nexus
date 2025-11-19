import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useConnectionStatus } from '@/hooks/marketplace/use-connections';
import { getAdminProfile } from '@/lib/admin-profiles';

interface DealAdvisorCardProps {
  presentedByAdminId: string | null | undefined;
  listingId: string;
  onContactClick: () => void;
}

export function DealAdvisorCard({ presentedByAdminId, listingId, onContactClick }: DealAdvisorCardProps) {
  const { data: adminProfiles } = useAdminProfiles();
  const { data: connectionStatus } = useConnectionStatus(listingId);
  
  // Get the advisor profile from database admin profiles
  let advisorProfile = {
    displayName: 'Tomos Mughan',
    title: 'CEO',
    email: 'tomos.mughan@sourceco.com',
  };

  if (presentedByAdminId) {
    // Try to get from admin profiles hook first (database)
    if (adminProfiles?.[presentedByAdminId]) {
      const dbProfile = adminProfiles[presentedByAdminId];
      const staticProfile = getAdminProfile(dbProfile.email);
      advisorProfile = {
        displayName: `${dbProfile.first_name} ${dbProfile.last_name}`.trim() || dbProfile.email,
        title: staticProfile?.title || 'Advisor',
        email: dbProfile.email,
      };
    } else {
      // Try to get from static admin profiles (using email as ID)
      const staticProfile = getAdminProfile(presentedByAdminId);
      if (staticProfile) {
        advisorProfile = {
          displayName: staticProfile.name,
          title: staticProfile.title,
          email: staticProfile.email,
        };
      }
    }
  }

  const hasActiveConnection = connectionStatus?.status === 'approved';

  return (
    <div className="bg-white/40 border border-slate-200/60 rounded-lg p-6 shadow-sm">
      <h4 className="text-xs font-medium text-foreground mb-4 uppercase tracking-wider">
        Deal Presented By
      </h4>
      
      <div className="flex items-start gap-3 mb-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-6 w-6 text-primary" />
        </div>
        
        {/* Info */}
        <div>
          <div className="font-medium text-sm text-foreground">
            {advisorProfile.displayName}
          </div>
          <div className="text-xs text-muted-foreground">
            {advisorProfile.title}
          </div>
        </div>
      </div>

      <Button
        onClick={onContactClick}
        disabled={!hasActiveConnection}
        className="w-full text-xs h-9 bg-[#D7B65C] hover:bg-[#D7B65C]/90 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {hasActiveConnection ? `Contact ${advisorProfile.displayName.split(' ')[0]}` : 'Request Connection to Contact'}
      </Button>
      
      {!hasActiveConnection && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Submit a connection request to unlock direct communication
        </p>
      )}
    </div>
  );
}
