import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, Target, Users, User, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuyerPriorityScoreProps {
  buyerType?: string;
  className?: string;
}

export function BuyerPriorityScore({ buyerType, className }: BuyerPriorityScoreProps) {
  const getActualScore = (buyerType?: string): number => {
    if (!buyerType) return 1;
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity':
        return 5;
      case 'corporate':
      case 'familyoffice':
        return 4;
      case 'independentsponsor':
        return 3;
      case 'searchfund':
        return 2;
      case 'individual':
        return 1;
      default:
        return 1;
    }
  };

  const actualScore = getActualScore(buyerType);

  const getScoreConfig = (score: number) => {
    switch (score) {
      case 5:
        return {
          label: "PE",
          color: "text-purple-600",
          bg: "bg-purple-50",
          border: "border-purple-200",
          icon: Crown,
          description: "Private Equity"
        };
      case 4:
        return {
          label: "Corporate",
          color: "text-blue-600",
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: TrendingUp,
          description: "Corporate/Family Office"
        };
      case 3:
        return {
          label: "Sponsor",
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          icon: Target,
          description: "Independent Sponsor"
        };
      case 2:
        return {
          label: "Search Fund",
          color: "text-orange-600",
          bg: "bg-orange-50",
          border: "border-orange-200",
          icon: Users,
          description: "Search Fund"
        };
      case 1:
        return {
          label: "Individual",
          color: "text-muted-foreground",
          bg: "bg-muted/50",
          border: "border-border",
          icon: User,
          description: "Individual Investor"
        };
      default:
        return {
          label: "Unknown",
          color: "text-muted-foreground",
          bg: "bg-muted/50",
          border: "border-border",
          icon: User,
          description: "Classification pending"
        };
    }
  };

  const config = getScoreConfig(actualScore);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs",
        config.bg,
        config.border
      )}>
        <config.icon className={cn("w-3.5 h-3.5", config.color)} />
        <span className={cn("font-semibold", config.color)}>
          {config.label} {actualScore}/5
        </span>
      </div>
    </div>
  );
}