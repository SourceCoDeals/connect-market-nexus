import React from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MessageSquare, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuyerProfileSectionProps {
  buyerProfile?: any;
  selectedDeal?: any;
  className?: string;
  onEmailContact?: () => void;
  onPhoneContact?: () => void;
  onLogNote?: () => void;
}

function getBuyerTypeLabel(buyerType?: string) {
  if (!buyerType) return 'Individual';
  
  const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
  switch (type) {
    case 'privateequity': return 'Private Equity';
    case 'familyoffice': return 'Family Office';
    case 'searchfund': return 'Search Fund';
    case 'corporate': return 'Corporate';
    case 'individual': return 'Individual';
    case 'independentsponsor': return 'Independent Sponsor';
    default: return 'Individual';
  }
}

function getPriorityScore(buyerType?: string) {
  if (!buyerType) return 1;
  const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
  switch (type) {
    case 'privateequity': return 5;
    case 'familyoffice': return 4;
    case 'searchfund': return 4;
    case 'corporate': return 3;
    case 'independentsponsor': return 3;
    case 'individual': return 1;
    default: return 1;
  }
}

export function BuyerProfileSection({ 
  buyerProfile, 
  selectedDeal, 
  className,
  onEmailContact,
  onPhoneContact,
  onLogNote 
}: BuyerProfileSectionProps) {
  
  if (!selectedDeal) return null;

  const buyerName = buyerProfile?.buyerInfo?.name || selectedDeal?.buyer_name || 'Unknown Buyer';
  const company = buyerProfile?.buyerInfo?.company || selectedDeal?.buyer_company;
  const email = buyerProfile?.buyerInfo?.email || selectedDeal?.buyer_email;
  const phone = buyerProfile?.buyerInfo?.phone_number;
  const buyerType = buyerProfile?.buyerInfo?.buyer_type || selectedDeal?.buyer_type;
  const investment = buyerProfile?.criteriaData?.investment_range || buyerProfile?.criteriaData?.fund_size_range;
  const message = selectedDeal?.buyer_message;
  const priorityScore = getPriorityScore(buyerType);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with essential buyer info */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium text-foreground truncate">{buyerName}</h3>
          {company && (
            <p className="text-sm text-muted-foreground truncate">{company}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {getBuyerTypeLabel(buyerType)}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-xs font-medium text-foreground">{priorityScore}</span>
        </div>
      </div>

      {/* Interest message if available */}
      {message && (
        <div className="border-l-2 border-primary/20 pl-4 py-2">
          <p className="text-sm text-foreground/80 italic">"{message}"</p>
        </div>
      )}

      {/* Investment criteria if available */}
      {investment && (
        <div className="text-xs text-muted-foreground">
          Investment Range: {investment}
        </div>
      )}

      {/* Unified Action Bar */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEmailContact}
            className="h-8 px-3 text-xs"
            disabled={!email}
          >
            <Mail className="w-3 h-3 mr-1.5" />
            Email
          </Button>
          
          {phone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPhoneContact}
              className="h-8 px-3 text-xs"
            >
              <Phone className="w-3 h-3 mr-1.5" />
              Call
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogNote}
            className="h-8 px-3 text-xs"
          >
            <MessageSquare className="w-3 h-3 mr-1.5" />
            Note
          </Button>
        </div>

        {/* Document status - minimal indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">NDA</span>
            <div className={cn(
              "w-2 h-2 rounded-full",
              selectedDeal?.nda_status === 'signed' ? 'bg-green-500' :
              selectedDeal?.nda_status === 'sent' ? 'bg-yellow-500' : 'bg-muted'
            )} />
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Fee</span>
            <div className={cn(
              "w-2 h-2 rounded-full",
              selectedDeal?.fee_agreement_status === 'signed' ? 'bg-green-500' :
              selectedDeal?.fee_agreement_status === 'sent' ? 'bg-yellow-500' : 'bg-muted'
            )} />
          </div>
        </div>
      </div>
    </div>
  );
}