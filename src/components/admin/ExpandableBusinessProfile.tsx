import React, { useState } from "react";
import { User } from "@/types/admin-users";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Target, Building2, MapPin, DollarSign } from "lucide-react";
import { BusinessCategoriesDisplay } from "./BuyerProfileHoverCard";
import { formatFinancialRange } from "@/lib/buyer-metrics";

interface ExpandableBusinessProfileProps {
  user: User | null | undefined;
  className?: string;
}

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
        
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="pl-6 space-y-3">
            {/* Target Description */}
            {businessDescription && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Target Description</span>
                </div>
                <p className="text-xs text-card-foreground leading-relaxed pl-5">
                  "{businessDescription}"
                </p>
              </div>
            )}

            {/* Business Categories */}
            {user.business_categories?.length && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Business Categories</span>
                <div className="pl-0">
                  <BusinessCategoriesDisplay 
                    categories={user.business_categories} 
                    maxVisible={10} // Show more in expanded view
                  />
                </div>
              </div>
            )}

            {/* Financial Information */}
            <div className="grid grid-cols-1 gap-2">
              {investmentSize && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Investment Size:</span>
                  <span className="text-xs text-card-foreground">{investmentSize}</span>
                </div>
              )}
              
              {revenueRange && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Revenue Target:</span>
                  <span className="text-xs text-card-foreground">{revenueRange}</span>
                </div>
              )}
            </div>

            {/* Target Locations */}
            {user.target_locations && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Target Locations:</span>
                <span className="text-xs text-card-foreground">{user.target_locations}</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};