import { useRevenueOptimization } from '@/hooks/use-revenue-optimization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Target, 
  BarChart3,
  Zap,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function RevenueOptimizationTab() {
  const { data, isLoading } = useRevenueOptimization(90);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  const { 
    revenueOptimizations = [], 
    dealVelocityMetrics = [], 
    pipelineAnalysis = [], 
    marketTiming = [],
    competitiveIntelligence = []
  } = data || {};

  const getMarketTempColor = (temp: string) => {
    switch (temp) {
      case 'hot': return 'text-red-500';
      case 'warm': return 'text-yellow-500';
      case 'cold': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getSupplyLevelColor = (level: string) => {
    switch (level) {
      case 'undersupplied': return 'text-green-600';
      case 'balanced': return 'text-yellow-600';
      case 'oversupplied': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getVelocityColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Revenue Optimization</h2>
          <p className="text-muted-foreground">AI-powered revenue and pricing intelligence</p>
        </div>
      </div>

      <Tabs defaultValue="revenue-optimization" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="revenue-optimization">Revenue</TabsTrigger>
          <TabsTrigger value="deal-velocity">Deal Velocity</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="market-timing">Timing</TabsTrigger>
          <TabsTrigger value="competitive">Competitive</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue-optimization" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Revenue Opportunity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${revenueOptimizations.reduce((sum, opt) => sum + opt.potential_revenue_increase, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Potential additional revenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">High-Impact Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {revenueOptimizations.filter(opt => opt.potential_revenue_increase > 50000).length}
                </div>
                <p className="text-xs text-muted-foreground">Categories with $50K+ opportunity</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Avg Confidence Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(revenueOptimizations.reduce((sum, opt) => sum + opt.confidence_level, 0) / revenueOptimizations.length || 0)}%
                </div>
                <p className="text-xs text-muted-foreground">Prediction confidence</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            {revenueOptimizations.map((optimization, index) => (
              <Card key={optimization.category}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      {optimization.category}
                    </span>
                    <Badge variant={optimization.potential_revenue_increase > 0 ? 'default' : 'secondary'}>
                      ${optimization.potential_revenue_increase.toLocaleString()} opportunity
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Market Demand: {optimization.market_demand} | 
                    Supply: {optimization.supply_level} | 
                    Confidence: {optimization.confidence_level}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm font-medium mb-1">Current Commission</div>
                        <div className="text-lg font-semibold">${optimization.current_avg_commission.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium mb-1">Optimal Commission</div>
                        <div className="text-lg font-semibold text-green-600">
                          ${optimization.optimal_commission.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium mb-1">Market Conditions</div>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            <span className={getSupplyLevelColor(optimization.supply_level)}>
                              {optimization.supply_level}
                            </span>
                          </Badge>
                          <Badge variant="outline">{optimization.market_demand} demand</Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium mb-2">Pricing Recommendation</div>
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        {optimization.pricing_recommendation}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Progress value={optimization.confidence_level} className="flex-1 mr-4" />
                      <span className="text-sm font-medium">{optimization.confidence_level}% confidence</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deal-velocity" className="space-y-6">
          <div className="grid gap-4">
            {dealVelocityMetrics.map((deal) => (
              <Card key={deal.listing_id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      {deal.listing_title}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{deal.days_on_market} days</Badge>
                      <Badge 
                        variant={deal.velocity_score >= 70 ? 'default' : deal.velocity_score >= 40 ? 'secondary' : 'outline'}
                      >
                        {deal.velocity_score} velocity
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Predicted Sale: {new Date(deal.predicted_sale_date).toLocaleDateString()} | 
                    Confidence: {deal.confidence_level}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Velocity Score</div>
                        <div className={`text-2xl font-bold ${getVelocityColor(deal.velocity_score)}`}>
                          {deal.velocity_score}/100
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">Days on Market</div>
                        <div className="text-2xl font-bold">{deal.days_on_market}</div>
                      </div>
                    </div>

                    {deal.acceleration_opportunities.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Acceleration Opportunities
                        </h4>
                        <ul className="space-y-1">
                          {deal.acceleration_opportunities.map((opportunity, idx) => (
                            <li key={idx} className="text-sm flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              {opportunity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {deal.bottlenecks.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          Bottlenecks
                        </h4>
                        <ul className="space-y-1">
                          {deal.bottlenecks.map((bottleneck, idx) => (
                            <li key={idx} className="text-sm flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              {bottleneck}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-6">
          <div className="grid gap-6">
            {pipelineAnalysis.map((stage) => (
              <Card key={stage.stage}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      {stage.stage.toUpperCase()} Stage
                    </span>
                    <Badge variant="outline">{stage.user_count} users</Badge>
                  </CardTitle>
                  <CardDescription>
                    Conversion Rate: {stage.conversion_rate}% | 
                    Avg Time: {stage.avg_time_in_stage} days | 
                    Revenue Potential: ${stage.revenue_potential.toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{stage.user_count}</div>
                        <div className="text-sm text-muted-foreground">Users</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stage.conversion_rate}%</div>
                        <div className="text-sm text-muted-foreground">Conversion</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stage.avg_time_in_stage}</div>
                        <div className="text-sm text-muted-foreground">Days</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          ${(stage.revenue_potential / 1000).toFixed(0)}K
                        </div>
                        <div className="text-sm text-muted-foreground">Revenue</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Optimization Recommendations</h4>
                      <ul className="space-y-1">
                        {stage.optimization_recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-3 w-3 text-blue-500" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Progress value={stage.conversion_rate} className="w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="market-timing" className="space-y-6">
          <div className="grid gap-6">
            {marketTiming.map((timing) => (
              <Card key={timing.category}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {timing.category}
                    </span>
                    <Badge 
                      variant="outline"
                      className={getMarketTempColor(timing.market_temperature)}
                    >
                      {timing.market_temperature} market
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Seasonality: {timing.seasonality_factor}x | 
                    Demand Forecast: {timing.demand_forecast} | 
                    Optimal Timing: {timing.optimal_listing_time}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm font-medium">Market Temperature</div>
                        <div className={`text-lg font-semibold ${getMarketTempColor(timing.market_temperature)}`}>
                          {timing.market_temperature.toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Seasonality Factor</div>
                        <div className="text-lg font-semibold">{timing.seasonality_factor}x</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Demand Forecast</div>
                        <div className="text-lg font-semibold">{timing.demand_forecast}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2">Pricing Strategy</div>
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        {timing.suggested_pricing_strategy}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2">Optimal Listing Time</div>
                      <div className="text-lg font-semibold text-primary">
                        {timing.optimal_listing_time}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="competitive" className="space-y-6">
          <div className="grid gap-6">
            {competitiveIntelligence.map((intel) => (
              <Card key={intel.category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {intel.category} - Competitive Analysis
                  </CardTitle>
                  <CardDescription>
                    Market Share: {intel.our_market_share.toFixed(1)}% | 
                    Avg Sale Time: {intel.avg_time_to_sale} days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm font-medium">Our Market Share</div>
                        <div className="text-2xl font-bold">{intel.our_market_share.toFixed(1)}%</div>
                        <Progress value={intel.our_market_share} className="mt-1" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Avg Time to Sale</div>
                        <div className="text-2xl font-bold">{intel.avg_time_to_sale} days</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Competitor Pricing</div>
                        <div className="text-2xl font-bold">
                          ${(intel.competitor_pricing / 1000000).toFixed(1)}M
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <h4 className="font-medium mb-2 text-green-600">Competitive Advantages</h4>
                        <ul className="space-y-1">
                          {intel.our_competitive_advantage.map((advantage, idx) => (
                            <li key={idx} className="text-sm flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              {advantage}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2 text-red-600">Threats</h4>
                        <ul className="space-y-1">
                          {intel.threats.map((threat, idx) => (
                            <li key={idx} className="text-sm flex items-center gap-2">
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                              {threat}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2 text-blue-600">Opportunities</h4>
                        <ul className="space-y-1">
                          {intel.opportunities.map((opportunity, idx) => (
                            <li key={idx} className="text-sm flex items-center gap-2">
                              <TrendingUp className="h-3 w-3 text-blue-500" />
                              {opportunity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}