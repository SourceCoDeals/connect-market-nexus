import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BuyerPriorityScore } from './BuyerPriorityScore';
import { BuyerMessageHero } from './BuyerMessageHero';

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

export function BuyerProfileSection({ 
  buyerProfile, 
  selectedDeal, 
  className,
  onEmailContact,
  onPhoneContact,
  onLogNote 
}: BuyerProfileSectionProps) {
  
  // Apple/Stripe Level Restructure - Phase 1-5 Implementation
  if (selectedDeal) {
    return (
      <div className={cn("space-y-8", className)}>
        {/* Phase 1: Hero Message Architecture */}
        <BuyerMessageHero 
          message={selectedDeal?.buyer_message}
          buyerName={buyerProfile?.buyerInfo?.name || selectedDeal?.buyer_name}
          isLoading={!buyerProfile && !selectedDeal}
        />

        {/* Phase 3: Minimal Buyer Profile Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-foreground truncate">
                {buyerProfile?.buyerInfo?.name || selectedDeal?.buyer_name || 'Unknown Buyer'}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {buyerProfile?.buyerInfo?.company || selectedDeal?.buyer_company || 'No company specified'}
              </p>
            </div>
            <BuyerPriorityScore 
              buyerType={buyerProfile?.buyerInfo?.buyer_type || selectedDeal?.buyer_type}
            />
          </div>

          {/* Essential Contact Information Grid */}
          <div className="grid grid-cols-2 gap-6 text-sm mb-6">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Email</span>
              <p className="text-foreground font-medium truncate">
                {buyerProfile?.buyerInfo?.email || selectedDeal?.buyer_email || 'Not provided'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Type</span>
              <p className="text-foreground font-medium">
                {getBuyerTypeLabel(buyerProfile?.buyerInfo?.buyer_type || selectedDeal?.buyer_type)}
              </p>
            </div>
            {buyerProfile?.buyerInfo?.phone_number && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Phone</span>
                <p className="text-foreground font-medium">{buyerProfile.buyerInfo.phone_number}</p>
              </div>
            )}
            {(buyerProfile?.criteriaData?.fund_size_range || buyerProfile?.criteriaData?.investment_range) && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Investment Range</span>
                <p className="text-foreground font-medium text-xs">
                  {buyerProfile.criteriaData.investment_range || buyerProfile.criteriaData.fund_size_range}
                </p>
              </div>
            )}
          </div>

          {/* Phase 2: Unified Actions Interface */}
          <div className="border-t border-border pt-6">
            <div className="flex items-center justify-between">
              {/* Primary Actions */}
              <div className="flex items-center gap-3">
                <Button
                  variant="default"
                  size="sm"
                  onClick={onEmailContact}
                  className="h-9 px-4 shadow-sm"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                
                {buyerProfile?.buyerInfo?.phone_number && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPhoneContact}
                    className="h-9 px-4"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogNote}
                  className="h-9 px-4"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Note
                </Button>
              </div>

              {/* Document Status Indicators */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">NDA</span>
                  <Badge 
                    variant={selectedDeal?.nda_status === 'signed' ? 'default' : 'outline'} 
                    className="text-xs px-2 py-0.5"
                  >
                    {selectedDeal?.nda_status === 'signed' ? 'Signed' : 
                     selectedDeal?.nda_status === 'sent' ? 'Sent' : 'Pending'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Fee Agreement</span>
                  <Badge 
                    variant={selectedDeal?.fee_agreement_status === 'signed' ? 'default' : 'outline'} 
                    className="text-xs px-2 py-0.5"
                  >
                    {selectedDeal?.fee_agreement_status === 'signed' ? 'Signed' : 
                     selectedDeal?.fee_agreement_status === 'sent' ? 'Sent' : 'Pending'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}