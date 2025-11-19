import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useConnectionStatus } from '@/hooks/marketplace/use-connections';

interface DealAdvisorCardProps {
  presentedByAdminId: string | null | undefined;
  listingId: string;
  onContactClick: () => void;
}

export function DealAdvisorCard({ presentedByAdminId, listingId, onContactClick }: DealAdvisorCardProps) {
  const { data: adminProfiles } = useAdminProfiles();
  const { data: connectionStatus } = useConnectionStatus(listingId);
  
  // Default to Tomos Mughan for now
  const advisorProfile = presentedByAdminId && adminProfiles?.[presentedByAdminId]
    ? adminProfiles[presentedByAdminId]
    : {
        displayName: 'Tomos Mughan',
        email: 'tomos.mughan@sourceco.com',
      };

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
            CEO, SourceCo
          </div>
        </div>
      </div>

      <Button
        onClick={onContactClick}
        disabled={!hasActiveConnection}
        className="w-full text-xs h-9 bg-[#D7B65C] hover:bg-[#D7B65C]/90 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {hasActiveConnection ? 'Contact Tomos' : 'Request Connection to Contact'}
      </Button>
      
      {!hasActiveConnection && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Submit a connection request to unlock direct communication
        </p>
      )}
    </div>
  );
}
