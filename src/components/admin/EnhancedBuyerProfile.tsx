import React from 'react';
import { User, ExternalLink, Linkedin, Trophy, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { User as UserType } from '@/types';
import { getBuyerTier, getPrimaryMetrics, getProfileCompletionDetails, BuyerMetric } from '@/lib/buyer-metrics';
import { formatInvestmentSize } from '@/lib/currency-utils';
import { Badge } from '@/components/ui/badge';

interface EnhancedBuyerProfileProps {
  user: UserType | null | undefined;
  className?: string;
}

const MetricRow: React.FC<{ metric: BuyerMetric }> = ({ metric }) => {
  const content = (
    <div className="flex items-center justify-between group">
      <span className="text-xs text-muted-foreground">{metric.label}</span>
      <div className="flex items-center gap-1">
        <span className={`text-xs font-medium ${metric.isPrimary ? 'text-foreground text-sm' : 'text-foreground'}`}>
          {metric.value}
        </span>
        {metric.isClickable && (
          <ExternalLink className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );

  if (metric.isClickable && metric.href) {
    return (
      <a
        href={metric.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:bg-accent/20 -mx-1 px-1 py-0.5 rounded transition-colors"
      >
        {content}
      </a>
    );
  }

  return <div className="py-0.5">{content}</div>;
};

const CompletenessIndicator: React.FC<{ score: number }> = ({ score }) => {
  if (score >= 80) {
    return <CheckCircle className="h-3 w-3 text-emerald-500" />;
  } else if (score >= 50) {
    return <AlertCircle className="h-3 w-3 text-amber-500" />;
  } else {
    return <XCircle className="h-3 w-3 text-red-500" />;
  }
};

export const EnhancedBuyerProfile: React.FC<EnhancedBuyerProfileProps> = ({ 
  user, 
  className = "" 
}) => {
  if (!user) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-card-foreground">Buyer Information</span>
        </div>
        <div className="text-xs text-muted-foreground pl-1">No buyer information available</div>
      </div>
    );
  }

  const tierInfo = getBuyerTier(user);
  const metrics = getPrimaryMetrics(user);
  const completionDetails = getProfileCompletionDetails(user);
  const completeness = completionDetails.percentage;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with tier and completeness */}
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-card-foreground">Buyer Information</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CompletenessIndicator score={completeness} />
          <Badge 
            variant="outline" 
            className={`text-xs px-1.5 py-0.5 ${tierInfo.color} border-current/20`}
          >
            {tierInfo.badge}
          </Badge>
        </div>
      </div>

      {/* Enhanced metrics display */}
      <div className="space-y-2 pl-1">
        {/* Buyer type and tier description */}
        <div className="flex items-center justify-between py-0.5">
          <span className="text-xs text-muted-foreground">Type</span>
          <span className={`text-xs font-medium ${tierInfo.color}`}>
            {tierInfo.description}
          </span>
        </div>

        {/* Email (always show) */}
        <div className="flex items-center justify-between py-0.5">
          <span className="text-xs text-muted-foreground">Email</span>
          <span className="text-xs font-medium text-foreground">{user.email}</span>
        </div>

        {/* Dynamic metrics based on buyer type */}
        {metrics.map((metric, index) => (
          <MetricRow key={`${metric.label}-${index}`} metric={metric} />
        ))}

        {/* Data restoration indicator for restored fields */}
        {user.updated_at && new Date(user.updated_at) > new Date('2025-01-20') && (
          <div className="flex items-center gap-1.5 py-1 mt-2 pt-2 border-t border-border/20">
            <CheckCircle className="h-3 w-3 text-emerald-500" />
            <span className="text-[10px] text-emerald-600 font-medium">Data recovered from backup</span>
          </div>
        )}

        {/* Investment size if not already shown as primary metric */}
        {!metrics.some(m => m.label === 'Investment Size') && user.investment_size && (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-xs text-muted-foreground">Investment Size</span>
            <span className="text-xs font-medium text-foreground">{Array.isArray(user.investment_size) ? user.investment_size.join(', ') : formatInvestmentSize(user.investment_size)}</span>
          </div>
        )}

        {/* Show data completeness score for low scores */}
        {completeness < 70 && (
          <div className="flex items-center justify-between py-0.5 mt-2 pt-2 border-t border-border/20">
            <span className="text-xs text-muted-foreground">Profile Completeness</span>
            <span className="text-xs font-medium text-amber-600">{completeness}%</span>
          </div>
        )}
      </div>
    </div>
  );
};