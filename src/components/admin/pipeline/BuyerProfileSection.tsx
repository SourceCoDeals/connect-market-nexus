import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  ExternalLink,
  MapPin,
  DollarSign,
  Briefcase,
  Calendar,
  Target,
  TrendingUp,
  Globe
} from 'lucide-react';
import { BuyerPriorityScore } from './BuyerPriorityScore';
import { cn } from '@/lib/utils';

interface BuyerProfileSectionProps {
  buyerProfile: any;
  selectedDeal: any;
  className?: string;
}

export function BuyerProfileSection({ buyerProfile, selectedDeal, className }: BuyerProfileSectionProps) {
  const getBuyerTypeLabel = (buyerType?: string) => {
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
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'Not specified';
    
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toLocaleString()}`;
  };

  const buyer = buyerProfile?.buyerInfo;
  const isLead = !buyerProfile?.isRegisteredUser;

  if (!buyer && !selectedDeal.buyer_name) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <User className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-900">No Buyer Information</p>
        <p className="text-xs text-gray-500 mt-1">Buyer details are not available for this deal</p>
      </div>
    );
  }

  const buyerName = buyer?.name || buyer?.first_name + ' ' + buyer?.last_name || selectedDeal.buyer_name;
  const buyerCompany = buyer?.company || buyer?.company_name || selectedDeal.buyer_company;
  const buyerEmail = buyer?.email || selectedDeal.buyer_email;
  const buyerPhone = buyer?.phone_number || selectedDeal.buyer_phone;
  const buyerType = buyer?.buyer_type || selectedDeal.buyer_type;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Original Buyer Message - Hero Content */}
      {(buyerProfile?.user_message && buyerProfile.user_message.trim()) ? (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-sm font-semibold text-blue-900">Original Interest Message</h4>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  Why they're interested
                </span>
              </div>
              <blockquote className="text-sm text-blue-800 leading-relaxed font-medium border-l-3 border-blue-300 pl-4 italic">
                "{buyerProfile.user_message}"
              </blockquote>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Mail className="w-4 h-4" />
            <span className="text-sm">No original message available</span>
          </div>
        </div>
      )}

      {/* Buyer Identity & Core Info */}
      <div className="flex items-start gap-4">
        <Avatar className="w-12 h-12 border border-gray-200">
          <AvatarImage src="" />
          <AvatarFallback className="bg-gray-50 text-gray-700 text-sm font-medium">
            {buyerName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {buyerName || 'Name not available'}
            </h3>
            {isLead && (
              <Badge variant="secondary" className="text-xs">
                Lead
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{buyerCompany || 'Company not specified'}</p>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="font-medium">{getBuyerTypeLabel(buyerType)}</span>
            {buyer?.job_title && (
              <>
                <span>•</span>
                <span>{buyer.job_title}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Buyer Priority Score */}
      <div className="border border-gray-200 rounded-lg p-4">
        <BuyerPriorityScore 
          score={selectedDeal.buyer_priority_score || 0}
          buyerType={buyerType}
        />
      </div>

      {/* Contact Information */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-900">Contact Information</h4>
        <div className="space-y-2">
          {buyerEmail && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900">{buyerEmail}</span>
            </div>
          )}
          {buyerPhone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900">{buyerPhone}</span>
            </div>
          )}
          {buyer?.website && (
            <div className="flex items-center gap-3 text-sm">
              <Globe className="w-4 h-4 text-gray-400" />
              <a 
                href={buyer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {buyer.website}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {buyer?.linkedin_profile && (
            <div className="flex items-center gap-3 text-sm">
              <ExternalLink className="w-4 h-4 text-gray-400" />
              <a 
                href={buyer.linkedin_profile}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700"
              >
                LinkedIn Profile
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Investment Profile */}
      {buyer && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-900">Investment Profile</h4>
          
          {/* Deal Size Preferences */}
          {(buyer.target_deal_size_min || buyer.target_deal_size_max) && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">Target Deal Size</span>
              </div>
              <p className="text-sm text-gray-900">
                {formatCurrency(buyer.target_deal_size_min || 0)} - {formatCurrency(buyer.target_deal_size_max || 0)}
              </p>
            </div>
          )}

          {/* Geographic Focus */}
          {buyer.geographic_focus && Array.isArray(buyer.geographic_focus) && buyer.geographic_focus.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">Geographic Focus</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.geographic_focus.map((location: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {location}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Fund Information */}
          {(buyer.fund_size || buyer.aum) && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">Fund Information</span>
              </div>
              <div className="space-y-1">
                {buyer.fund_size && (
                  <p className="text-sm text-gray-900">Fund Size: {buyer.fund_size}</p>
                )}
                {buyer.aum && (
                  <p className="text-sm text-gray-900">AUM: {buyer.aum}</p>
                )}
              </div>
            </div>
          )}

          {/* Business Categories */}
          {buyer.business_categories && Array.isArray(buyer.business_categories) && buyer.business_categories.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">Industry Focus</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {buyer.business_categories.map((category: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {buyer.bio && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">Background</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{buyer.bio}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}