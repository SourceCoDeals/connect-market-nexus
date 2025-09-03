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
      {/* TEST ELEMENT - VISIBLE CHANGES CONFIRMATION */}
      <div className="bg-red-500 text-white p-4 rounded-lg font-bold text-center">
        🔥 CHANGES ARE WORKING - BUYER MESSAGE AND PROFILE REMOVED 🔥
      </div>
    </div>
  );
}