import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, FileCheck, FileSignature } from 'lucide-react';
import { useInboundLeadFirm } from '@/hooks/admin/use-inbound-lead-firm';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';

interface LeadFirmBadgeProps {
  leadId: string;
  compact?: boolean;
}

export function LeadFirmBadge({ leadId, compact = false }: LeadFirmBadgeProps) {
  const { data: firmInfo, isLoading } = useInboundLeadFirm(leadId);

  if (isLoading) {
    return (
      <Badge variant="outline" className="text-xs">
        <Building2 className="h-3 w-3 mr-1 animate-pulse" />
        Loading...
      </Badge>
    );
  }

  if (!firmInfo || !firmInfo.firm_id) {
    return null;
  }

  const hasSignedAgreements = firmInfo.fee_agreement_signed || firmInfo.nda_signed;

  const content = (
    <Badge 
      variant="outline" 
      className={`text-xs font-medium ${
        hasSignedAgreements 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
          : 'bg-slate-50 text-slate-700 border-slate-200'
      }`}
    >
      <Building2 className="h-3 w-3 mr-1" />
      {firmInfo.firm_name}
      {hasSignedAgreements && (
        <FileCheck className="h-3 w-3 ml-1" />
      )}
    </Badge>
  );

  if (compact) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold text-sm">{firmInfo.firm_name}</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="h-3 w-3" />
                <span>Fee Agreement: {firmInfo.fee_agreement_signed ? '✓ Signed' : '✗ Not Signed'}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileSignature className="h-3 w-3" />
                <span>NDA: {firmInfo.nda_signed ? '✓ Signed' : '✗ Not Signed'}</span>
              </div>
            </div>
            <Link 
              to="/admin/firm-agreements" 
              className="text-xs text-primary hover:underline inline-block mt-2"
            >
              View Firm Details →
            </Link>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
