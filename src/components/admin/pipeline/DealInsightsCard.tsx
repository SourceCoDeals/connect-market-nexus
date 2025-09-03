import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  Target,
  Clock,
  BarChart3,
  Zap
} from 'lucide-react';
import { useDealAnalytics, useDealInsights } from '@/hooks/admin/use-deal-analytics';
import { cn } from '@/lib/utils';

interface DealInsightsCardProps {
  dealId: string;
  className?: string;
}

export function DealInsightsCard({ dealId, className }: DealInsightsCardProps) {
  const { data: analytics } = useDealAnalytics(dealId);
  const { data: insights } = useDealInsights(dealId);

  if (!analytics || !insights) {
    return (
      <Card className={cn("border-gray-200/60 shadow-sm bg-white/60 rounded-lg", className)}>
        <CardContent className="p-4 flex items-center justify-center text-gray-500">
          <div className="animate-pulse">Loading insights...</div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="w-3 h-3 text-emerald-600" />;
      case 'decreasing': return <TrendingDown className="w-3 h-3 text-red-600" />;
      default: return <Minus className="w-3 h-3 text-gray-600" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'medium': return 'bg-yellow-50 text-yellow-700 border-yellow-200/60';
      case 'high': return 'bg-red-50 text-red-700 border-red-200/60';
      default: return 'bg-gray-50 text-gray-700 border-gray-200/60';
    }
  };

  const getCompetitivePressureColor = (pressure: string) => {
    switch (pressure) {
      case 'low': return 'text-emerald-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card className={cn("border-gray-200/60 shadow-sm bg-white/60 rounded-lg", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-600" />
          Deal Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Engagement Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Engagement Score</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-gray-900">{analytics.engagement_score}</span>
              {getTrendIcon(analytics.probability_trend)}
            </div>
          </div>
          <Progress value={analytics.engagement_score} className="h-2" />
        </div>

        {/* Risk Assessment */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">Risk Level</span>
          <Badge className={cn("px-2 py-0.5 text-xs border rounded-md font-medium", getRiskColor(analytics.risk_level))}>
            <AlertTriangle className="w-3 h-3 mr-1" />
            {analytics.risk_level}
          </Badge>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Days in Stage</p>
            <p className="text-sm font-semibold text-gray-900">{analytics.days_in_current_stage}d</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Avg Close Time</p>
            <p className="text-sm font-semibold text-gray-900">{analytics.average_close_time}d</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Response Rate</p>
            <p className="text-sm font-semibold text-gray-900">{insights.response_rate}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Budget Confidence</p>
            <p className="text-sm font-semibold text-gray-900">{insights.budget_confidence}%</p>
          </div>
        </div>

        {/* Competitive Pressure */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">Competition</span>
          <span className={cn("text-sm font-semibold capitalize", getCompetitivePressureColor(insights.competitive_pressure))}>
            {insights.competitive_pressure}
          </span>
        </div>

        {/* Urgency Indicators */}
        {insights.urgency_indicators.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Urgency Signals</p>
            <div className="space-y-1">
              {insights.urgency_indicators.slice(0, 2).map((indicator, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Zap className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-gray-700">{indicator}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Action */}
        <div className="pt-2 border-t border-gray-200/60">
          <p className="text-xs font-medium text-gray-500 mb-2">Suggested Next Action</p>
          <div className="flex items-start gap-2">
            <Target className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-700 leading-relaxed">{analytics.next_action_suggestion}</p>
          </div>
        </div>

        {/* Conversion Likelihood */}
        <div className="bg-gradient-to-r from-blue-50/80 to-purple-50/80 rounded-lg p-3 border border-blue-200/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Conversion Likelihood</span>
            <span className="text-sm font-bold text-blue-700">{analytics.conversion_likelihood}%</span>
          </div>
          <Progress value={analytics.conversion_likelihood} className="h-2" />
          <p className="text-xs text-gray-600 mt-2">
            Based on {analytics.similar_deals_closed} similar deals
          </p>
        </div>
      </CardContent>
    </Card>
  );
}