import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, Award, AlertTriangle } from 'lucide-react';

interface ListingBadgesProps {
  createdAt: string;
  revenue: number;
  ebitda: number;
  category: string;
}

export const ListingBadges: React.FC<ListingBadgesProps> = ({
  createdAt,
  revenue,
  ebitda,
  category
}) => {
  const badges = [];
  
  // Just Listed badge (less than 14 days)
  const daysSinceCreation = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceCreation < 14) {
    badges.push({
      text: 'Just Listed',
      icon: Clock,
      className: 'bg-sourceco-muted text-sourceco-accent border-sourceco-accent/30'
    });
  }
  
  // High Margin badge (EBITDA margin > 20%)
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
  if (ebitdaMargin >= 20) {
    badges.push({
      text: 'High Margin',
      icon: TrendingUp,
      className: 'bg-success/10 text-success border-success/30'
    });
  }
  
  // Profitable badge (positive EBITDA)
  if (ebitda > 0) {
    badges.push({
      text: 'Profitable',
      icon: Award,
      className: 'bg-success/10 text-success border-success/30'
    });
  }
  
  // Scale badge (revenue > $10M)
  if (revenue >= 10000000) {
    badges.push({
      text: 'Enterprise Scale',
      icon: TrendingUp,
      className: 'bg-sourceco-accent/10 text-sourceco-accent border-sourceco-accent/30'
    });
  }
  
  // Growth Stage badge (revenue $1M-$10M)
  if (revenue >= 1000000 && revenue < 10000000) {
    badges.push({
      text: 'Growth Stage',
      icon: TrendingUp,
      className: 'bg-warning/10 text-warning border-warning/30'
    });
  }
  
  // Loss-making badge (negative EBITDA but > $500k revenue)
  if (ebitda < 0 && revenue >= 500000) {
    badges.push({
      text: 'Growth Focus',
      icon: AlertTriangle,
      className: 'bg-warning/10 text-warning border-warning/30'
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {badges.map((badge, index) => (
        <Badge
          key={index}
          variant="outline"
          className={`text-xs flex items-center gap-1 ${badge.className}`}
        >
          <badge.icon className="h-3 w-3" />
          {badge.text}
        </Badge>
      ))}
    </div>
  );
};