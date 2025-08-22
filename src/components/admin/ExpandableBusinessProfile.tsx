import React, { useState } from "react";
import { User } from "@/types/admin-users";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronUp, 
  Target, 
  Building2, 
  MapPin, 
  DollarSign,
  ExternalLink,
  Check,
  X,
  Mail,
  TrendingUp
} from "lucide-react";
import { BusinessCategoriesDisplay } from "./BuyerProfileHoverCard";
import { formatFinancialRange, getPrimaryMetrics, getDataCompleteness, getBuyerTier } from "@/lib/buyer-metrics";

interface ExpandableBusinessProfileProps {
  user: User | null | undefined;
  className?: string;
}

const getEmailDomainStatus = (email?: string | null) => {
  if (!email) return { status: 'missing', color: 'text-amber-500' };
  if (email.includes('@gmail.com') || email.includes('@yahoo.com') || email.includes('@hotmail.com')) {
    return { status: 'personal', color: 'text-red-500' };
  }
  return { status: 'company', color: 'text-green-500' };
};

const CredibilitySection: React.FC<{ user: User }> = ({ user }) => {
  const emailStatus = getEmailDomainStatus(user.email);
  const hasLinkedIn = !!user.linkedin_profile;
  const hasWebsite = !!user.website;
  const dataCompleteness = getDataCompleteness(user as any);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Credibility Assessment</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Email:</span>
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            <span className={emailStatus.color}>
              {emailStatus.status === 'company' ? 'Company' : 
               emailStatus.status === 'personal' ? 'Personal' : 'Missing'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Data:</span>
          <Badge variant={dataCompleteness >= 80 ? "default" : dataCompleteness >= 60 ? "secondary" : "destructive"} className="text-xs">
            {Math.round(dataCompleteness)}%
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">LinkedIn:</span>
          <div className="flex items-center gap-1">
            {hasLinkedIn ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <a 
                  href={user.linkedin_profile!} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  View
                </a>
              </>
            ) : (
              <>
                <X className="h-3 w-3 text-red-500" />
                <span className="text-red-500">Missing</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Website:</span>
          <div className="flex items-center gap-1">
            {hasWebsite ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <a 
                  href={user.website!} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  Visit <ExternalLink className="h-3 w-3" />
                </a>
              </>
            ) : (
              <>
                <X className="h-3 w-3 text-red-500" />
                <span className="text-red-500">Missing</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ExpandableBusinessProfile: React.FC<ExpandableBusinessProfileProps> = ({
  user,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const businessDescription = user.ideal_target_description || user.specific_business_search;
  const hasBusinessInfo = businessDescription || 
    user.business_categories?.length || 
    user.target_locations ||
    user.revenue_range_min ||
    user.revenue_range_max;

  if (!hasBusinessInfo) return null;

  const revenueRange = formatFinancialRange(user.revenue_range_min, user.revenue_range_max);
  const investmentSize = user.investment_size?.replace(/\$/g, '').replace(/,/g, '');
  const primaryMetrics = getPrimaryMetrics(user as any);
  const tierInfo = getBuyerTier(user as any);

  return (
    <div className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between p-2 h-auto text-left hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Business Profile</span>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4 pt-2">
          <div className="pl-6 space-y-4">
            {/* Financial Profile Section */}
            {primaryMetrics.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Financial Profile</span>
                  <Badge variant="outline" className="text-xs">{tierInfo.badge}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {primaryMetrics.map((metric, index) => (
                    <div key={index} className="flex items-center justify-between text-xs bg-muted/30 p-2 rounded">
                      <span className="text-muted-foreground">{metric.label}:</span>
                      <span className="font-medium">{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Target Description */}
            {businessDescription && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Target Thesis</span>
                </div>
                <p className="text-xs text-card-foreground leading-relaxed bg-muted/50 p-2 rounded">
                  "{businessDescription}"
                </p>
              </div>
            )}

            {/* Business Categories */}
            {user.business_categories?.length && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Focus Areas</span>
                <div className="pl-0">
                  <BusinessCategoriesDisplay 
                    categories={user.business_categories} 
                    maxVisible={15} // Show more in expanded view
                  />
                </div>
              </div>
            )}

            {/* Revenue Target */}
            {revenueRange && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Revenue Target:</span>
                <span className="text-xs text-card-foreground">{revenueRange}</span>
              </div>
            )}

            {/* Target Locations */}
            {user.target_locations && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Target Geography:</span>
                <span className="text-xs text-card-foreground">{user.target_locations}</span>
              </div>
            )}

            {/* Credibility Assessment */}
            <CredibilitySection user={user} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};