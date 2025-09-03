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
          color: "text-purple-700",
          bg: "bg-purple-50",
          border: "border-purple-200/60",
          icon: Crown,
          description: "Private Equity"
        };
      case 4:
        return {
          label: "Corporate",
          color: "text-blue-700",
          bg: "bg-blue-50",
          border: "border-blue-200/60",
          icon: TrendingUp,
          description: "Corporate/Family Office"
        };
      case 3:
        return {
          label: "Sponsor",
          color: "text-emerald-700",
          bg: "bg-emerald-50",
          border: "border-emerald-200/60",
          icon: Target,
          description: "Independent Sponsor"
        };
      case 2:
        return {
          label: "Search Fund",
          color: "text-orange-700",
          bg: "bg-orange-50",
          border: "border-orange-200/60",
          icon: Users,
          description: "Search Fund"
        };
      case 1:
        return {
          label: "Individual",
          color: "text-slate-600",
          bg: "bg-slate-50",
          border: "border-slate-200/60",
          icon: User,
          description: "Individual Investor"
        };
      default:
        return {
          label: "Unknown",
          color: "text-slate-500",
          bg: "bg-slate-50",
          border: "border-slate-200/60",
          icon: User,
          description: "Classification pending"
        };
    }
  };

  const config = getScoreConfig(actualScore);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
        config.bg,
        config.border
      )}>
        <config.icon className={cn("w-3.5 h-3.5", config.color)} />
        <div className="flex items-center gap-1.5">
          <span className={cn("text-xs font-semibold", config.color)}>
            {config.label}
          </span>
          <span className={cn("text-xs font-medium opacity-75", config.color)}>
            {actualScore}/5
          </span>
        </div>
      </div>
    </div>
  );
}