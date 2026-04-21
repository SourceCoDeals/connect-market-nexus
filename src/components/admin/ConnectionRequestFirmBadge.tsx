import { Users, FileCheck, FileSignature } from 'lucide-react';
import { useConnectionRequestFirm } from '@/hooks/admin/use-connection-request-firm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ConnectionRequestFirmBadgeProps {
  requestId: string;
  compact?: boolean;
}

export function ConnectionRequestFirmBadge({
  requestId,
  compact = false,
}: ConnectionRequestFirmBadgeProps) {
  const { data: firmInfo, isLoading } = useConnectionRequestFirm(requestId);

  if (isLoading || !firmInfo || !firmInfo.firm_id) {
    return null;
  }

  const memberCount = firmInfo.member_count || 0;

  const content = (
    <Link
      to={`/admin/buyers/pe-firms/${firmInfo.firm_id}`}
      className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="font-medium">{firmInfo.firm_name}</span>
      {memberCount > 1 && <span className="text-muted-foreground">({memberCount})</span>}
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
          firmInfo.fee_agreement_signed
            ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            : 'border-border text-muted-foreground',
        )}
      >
        {firmInfo.fee_agreement_signed ? '✓' : '✗'} Fee
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
          firmInfo.nda_signed
            ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            : 'border-border text-muted-foreground',
        )}
      >
        {firmInfo.nda_signed ? '✓' : '✗'} NDA
      </span>
    </Link>
  );

  if (compact) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold text-sm">{firmInfo.firm_name}</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                <span>
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck className="h-3 w-3" />
                <span>
                  Fee Agreement: {firmInfo.fee_agreement_signed ? '✓ Signed' : '✗ Not Signed'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileSignature className="h-3 w-3" />
                <span>NDA: {firmInfo.nda_signed ? '✓ Signed' : '✗ Not Signed'}</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
