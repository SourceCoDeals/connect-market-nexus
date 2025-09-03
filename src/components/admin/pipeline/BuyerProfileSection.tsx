import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  Linkedin, 
  MapPin,
  DollarSign,
  Target,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BuyerPriorityScore } from './BuyerPriorityScore';
import { BuyerMessageHero } from './BuyerMessageHero';

interface BuyerProfileSectionProps {
  buyerProfile: any;
  selectedDeal: any;
  className?: string;
}

function getBuyerTypeLabel(buyerType?: string) {
  if (!buyerType) return 'Individual';
  
  const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
  switch (type) {
    case 'privateequity': return 'Private Equity';
    case 'familyoffice': return 'Family Office';
    case 'searchfund': return 'Search Fund';
    case 'corporate': return 'Corporate Buyer';
    case 'individual': return 'Individual Investor';
    case 'independentsponsor': return 'Independent Sponsor';
    default: return 'Individual';
  }
}

function formatCurrency(value: number | string) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'Not specified';
  
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(0)}K`;
  }
  return `$${num.toLocaleString()}`;
}

export function BuyerProfileSection({ buyerProfile, selectedDeal, className }: BuyerProfileSectionProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  // Extract buyer information from either buyerProfile.buyerInfo or selectedDeal
  const buyer = buyerProfile?.buyerInfo;
  
  // Show loading state while data is being fetched
  if (!buyerProfile && !selectedDeal.buyer_name) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="bg-muted/50 border border-border/60 rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-6 bg-muted rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!buyer && !selectedDeal.buyer_name) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <User className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No Buyer Information</p>
        <p className="text-xs text-muted-foreground mt-1">Buyer details are not available for this deal</p>
      </div>
    );
  }

  const buyerName = buyer?.name || 
                   (buyer?.first_name && buyer?.last_name ? `${buyer.first_name} ${buyer.last_name}` : '') || 
                   selectedDeal.contact_name || 
                   'Name not available';
  const buyerCompany = buyer?.company || selectedDeal.contact_company || 'Company not specified';
  const buyerEmail = buyer?.email || selectedDeal.contact_email;
  const buyerPhone = buyer?.phone_number || selectedDeal.contact_phone;
  const buyerType = buyer?.buyer_type || selectedDeal.buyer_type;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Hero Buyer Message */}
      <BuyerMessageHero 
        message={buyerProfile?.originalMessage} 
        buyerName={buyerName}
      />

      {/* Clean Buyer Identity */}
      <div className="bg-background border border-border rounded-lg p-6 space-y-6">
        <div className="flex items-start gap-4">
          <Avatar className="w-12 h-12 border border-border">
            <AvatarImage src="" />
            <AvatarFallback className="bg-muted text-foreground text-sm font-medium">
              {buyerName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground leading-tight">{buyerName}</h2>
                <p className="text-sm text-muted-foreground font-medium">{buyerCompany}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs font-medium">
                    {getBuyerTypeLabel(buyerType)}
                  </Badge>
                </div>
              </div>
              
              {/* Buyer Priority Score */}
              <BuyerPriorityScore 
                buyerType={buyerType}
                className="flex-shrink-0"
              />
            </div>

            {/* Essential Contact Info */}
            <div className="grid grid-cols-2 gap-3">
              {buyerEmail && (
                <div className="flex items-center gap-2.5 p-3 bg-muted/50 rounded-lg">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">Email</p>
                    <p className="text-sm font-medium text-foreground truncate">{buyerEmail}</p>
                  </div>
                </div>
              )}
              
              {buyerPhone && (
                <div className="flex items-center gap-2.5 p-3 bg-muted/50 rounded-lg">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">Phone</p>
                    <p className="text-sm font-medium text-foreground truncate">{buyerPhone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Progressive Disclosure for Detailed Info */}
        {buyer && (buyer.fund_size || buyer.target_deal_size_min || buyer.bio) && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
            >
              {showDetails ? 'Hide Details' : 'View Investment Profile'}
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {showDetails && (
              <div className="space-y-4 pt-4 border-t border-border">
                {/* Investment Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {buyer.fund_size && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fund Size</p>
                      <p className="text-sm font-medium text-foreground">{buyer.fund_size}</p>
                    </div>
                  )}
                  
                  {(buyer.target_deal_size_min || buyer.target_deal_size_max) && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Deal Size</p>
                      <p className="text-sm font-medium text-foreground">
                        {buyer.target_deal_size_min && buyer.target_deal_size_max
                          ? `${formatCurrency(buyer.target_deal_size_min)} - ${formatCurrency(buyer.target_deal_size_max)}`
                          : buyer.target_deal_size_min
                          ? `${formatCurrency(buyer.target_deal_size_min)}+`
                          : buyer.target_deal_size_max
                          ? `Up to ${formatCurrency(buyer.target_deal_size_max)}`
                          : 'Not specified'
                        }
                      </p>
                    </div>
                  )}
                  
                  {buyer.job_title && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</p>
                      <p className="text-sm font-medium text-foreground">{buyer.job_title}</p>
                    </div>
                  )}
                  
                  {buyer.deployment_timing && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deployment Timeline</p>
                      <p className="text-sm font-medium text-foreground">{buyer.deployment_timing}</p>
                    </div>
                  )}
                </div>
                
                {/* External Links */}
                {(buyer.website || buyer.linkedin_profile) && (
                  <div className="flex gap-2">
                    {buyer.website && (
                      <a
                        href={buyer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        Website
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {buyer.linkedin_profile && (
                      <a
                        href={buyer.linkedin_profile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                      >
                        <Linkedin className="w-3.5 h-3.5" />
                        LinkedIn
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
                
                {/* Bio */}
                {buyer.bio && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{buyer.bio}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}