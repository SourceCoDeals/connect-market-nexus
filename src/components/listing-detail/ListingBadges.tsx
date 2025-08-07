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
      className: 'bg-blue-100 text-blue-800 border-blue-200'
    });
  }
  
  // High Margin badge (EBITDA margin > 20%)
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
  if (ebitdaMargin >= 20) {
    badges.push({
      text: 'High Margin',
      icon: TrendingUp,
      className: 'bg-green-100 text-green-800 border-green-200'
    });
  }
  
  // Profitable badge (positive EBITDA)
  if (ebitda > 0) {
    badges.push({
      text: 'Profitable',
      icon: Award,
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    });
  }
  
  // Scale badge (revenue > $10M)
  if (revenue >= 10000000) {
    badges.push({
      text: 'Enterprise Scale',
      icon: TrendingUp,
      className: 'bg-purple-100 text-purple-800 border-purple-200'
    });
  }
  
  // Growth Stage badge (revenue $1M-$10M)
  if (revenue >= 1000000 && revenue < 10000000) {
    badges.push({
      text: 'Growth Stage',
      icon: TrendingUp,
      className: 'bg-orange-100 text-orange-800 border-orange-200'
    });
  }
  
  // Loss-making badge (negative EBITDA but > $500k revenue)
  if (ebitda < 0 && revenue >= 500000) {
    badges.push({
      text: 'Growth Focus',
      icon: AlertTriangle,
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
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