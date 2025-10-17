import { Building2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserFirm } from '@/hooks/admin/use-user-firm';

interface DealFirmInfoProps {
  userId: string | null;
  signedByName?: string | null;
  compact?: boolean;
}

export function DealFirmInfo({ userId, signedByName, compact = false }: DealFirmInfoProps) {
  const { data: firmInfo, isLoading } = useUserFirm(userId);

  if (isLoading || !firmInfo) {
    return signedByName ? <span className="text-xs text-muted-foreground">by {signedByName}</span> : null;
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs cursor-help">
              <Building2 className="h-3 w-3 mr-1" />
              {firmInfo.firm_name}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <p className="font-semibold">{firmInfo.firm_name}</p>
              <p>{firmInfo.member_count} firm {firmInfo.member_count === 1 ? 'member' : 'members'}</p>
              {signedByName && <p>Signed by: {signedByName}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Building2 className="h-3 w-3" />
      <span>{firmInfo.firm_name}</span>
      <span className="text-muted-foreground/60">·</span>
      <Users className="h-3 w-3" />
      <span>{firmInfo.member_count} {firmInfo.member_count === 1 ? 'member' : 'members'}</span>
      {signedByName && (
        <>
          <span className="text-muted-foreground/60">·</span>
          <span>by {signedByName}</span>
        </>
      )}
    </div>
  );
}
