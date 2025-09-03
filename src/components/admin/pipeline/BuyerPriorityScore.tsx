import React from 'react';
import { Star, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuyerPriorityScoreProps {
  score: number;
  buyerType?: string;
  className?: string;
}

export function BuyerPriorityScore({ score, buyerType, className }: BuyerPriorityScoreProps) {
  // Calculate priority score based on buyer type (1-5 scale)
  const getActualScore = (buyerType?: string) => {
    if (!buyerType) return 1; // Individual/Unknown = lowest score
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity':
      case 'pe':
        return 5;
      case 'corporate':
      case 'strategic':
        return 4;
      case 'familyoffice':
      case 'independentsponsor':
        return 3;
      case 'searchfund':
        return 2;
      case 'individual':
      default:
        return 1;
    }
  };

  const actualScore = getActualScore(buyerType);

  const getScoreConfig = (score: number) => {
    if (score === 5) {
      return {
        label: 'Premium',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        icon: Star,
        description: 'Private Equity - Highest value buyer'
      };
    }
    if (score === 4) {
      return {
        label: 'High Priority',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: TrendingUp,
        description: 'Corporate/Strategic buyer'
      };
    }
    if (score === 3) {
      return {
        label: 'Medium Priority',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        icon: TrendingUp,
        description: 'Family Office/Independent Sponsor'
      };
    }
    if (score === 2) {
      return {
        label: 'Lower Priority',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: AlertCircle,
        description: 'Search Fund buyer'
      };
    }
    return {
      label: 'Individual',
      color: 'text-gray-500',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      icon: AlertCircle,
      description: 'Individual buyer - requires qualification'
    };
  };

  const config = getScoreConfig(actualScore);
  const Icon = config.icon;

  const getScoreExplanation = () => {
    const explanations = [];
    
    if (buyerType) {
      const type = buyerType.toLowerCase();
      if (type.includes('pe') || type.includes('private equity')) {
        explanations.push('Private Equity (5 points)');
      } else if (type.includes('corporate') || type.includes('strategic')) {
        explanations.push('Corporate/Strategic (4 points)');
      } else if (type.includes('family office') || type.includes('independent sponsor')) {
        explanations.push('Family Office/Independent (3 points)');
      } else if (type.includes('search fund')) {
        explanations.push('Search Fund (2 points)');
      } else {
        explanations.push('Individual Buyer (1 point)');
      }
    }

    return explanations;
  };

  return (
    <div className={cn("", className)}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border",
          config.bgColor,
          config.borderColor
        )}>
          <Icon className={cn("w-4 h-4", config.color)} />
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-medium", config.color)}>
              {config.label}
            </span>
            <span className="text-xs font-mono bg-white/50 px-1.5 py-0.5 rounded">
              {actualScore}/5
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-2">
        <p className="text-xs text-muted-foreground">
          {config.description}
        </p>
        
        {getScoreExplanation().length > 0 && (
          <div className="mt-1">
            <p className="text-xs text-muted-foreground">
              Based on: {getScoreExplanation().join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}