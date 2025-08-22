import React from "react";
import { User } from "@/types/admin-users";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Building2, Target, DollarSign } from "lucide-react";
import { getBuyerTier, formatFinancialRange } from "@/lib/buyer-metrics";

interface BuyerProfileHoverCardProps {
  user: User | null | undefined;
  children: React.ReactNode;
}

interface BusinessCategoriesDisplayProps {
  categories: string[] | null | undefined;
  maxVisible?: number;
  className?: string;
}

export const BusinessCategoriesDisplay: React.FC<BusinessCategoriesDisplayProps> = ({
  categories,
  maxVisible = 5,
  className = ""
}) => {
  if (!categories?.length) return null;

  const visible = categories.slice(0, maxVisible);
  const remaining = categories.length - maxVisible;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visible.map((cat, index) => (
        <Badge key={index} variant="secondary" className="text-xs">
          {cat}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          +{remaining} more
        </Badge>
      )}
    </div>
  );
};

const formatInvestmentSize = (investmentSize?: string | null) => {
  if (!investmentSize) return null;
  return investmentSize.replace(/\$/g, '').replace(/,/g, '');
};

export const BuyerProfileHoverCard: React.FC<BuyerProfileHoverCardProps> = ({
  user,
  children,
}) => {
  if (!user) {
    return <>{children}</>;
  }

  const tierInfo = getBuyerTier(user as any); // Type conversion for buyer-metrics compatibility
  const investmentSize = formatInvestmentSize(user.investment_size);
  const revenueRange = formatFinancialRange(user.revenue_range_min, user.revenue_range_max);
  
  // Truncate description for hover preview
  const truncateText = (text: string, maxLength = 200) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const businessDescription = user.ideal_target_description || user.specific_business_search;
  const hasBusinessInfo = businessDescription || user.business_categories?.length;

  if (!hasBusinessInfo) {
    return <>{children}</>;
  }

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-80 max-h-96 overflow-y-auto p-4 bg-card border border-border shadow-lg"
        side="right"
        align="start"
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">
                {user.first_name} {user.last_name}
              </h4>
              <Badge variant="outline" className="text-xs">
                {tierInfo.badge}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {user.company && (
                <>
                  <Building2 className="h-3 w-3" />
                  <span>{user.company}</span>
                </>
              )}
              {investmentSize && (
                <>
                  {user.company && <span>•</span>}
                  <DollarSign className="h-3 w-3" />
                  <span>{investmentSize}</span>
                </>
              )}
            </div>
          </div>

          {/* Business Description */}
          {businessDescription && (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Target Description</span>
              </div>
              <p className="text-xs text-card-foreground leading-relaxed">
                "{truncateText(businessDescription)}"
              </p>
            </div>
          )}

          {/* Business Categories */}
          {user.business_categories?.length && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Focus Areas</span>
              <BusinessCategoriesDisplay 
                categories={user.business_categories} 
                maxVisible={5}
              />
            </div>
          )}

          {/* Revenue Target */}
          {revenueRange && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Revenue Target</span>
              <p className="text-xs text-card-foreground">{revenueRange}</p>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};