import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Search, MapPin, DollarSign, AlertTriangle, Target } from "lucide-react";
import { useMarketIntelligence } from "@/hooks/use-market-intelligence";

export function MarketIntelligenceTab() {
  const { data: marketData, isLoading } = useMarketIntelligence(30);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { marketGaps = [], pricingInsights = [], categoryTrends = [], geographicInsights = [] } = marketData || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Market Intelligence</h2>
        <p className="text-muted-foreground">Strategic insights for business growth and market expansion</p>
      </div>

      {/* Key Insights Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High-Demand Gaps</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketGaps.filter(g => g.demand_score > 50).length}</div>
            <p className="text-xs text-muted-foreground">Opportunities to acquire</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category Opportunities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categoryTrends.filter(c => c.opportunity_score > 60).length}</div>
            <p className="text-xs text-muted-foreground">High-opportunity categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expansion Markets</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{geographicInsights.filter(g => g.expansion_opportunity === 'high').length}</div>
            <p className="text-xs text-muted-foreground">High-potential locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pricing Categories</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pricingInsights.length}</div>
            <p className="text-xs text-muted-foreground">With optimization data</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="gaps" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="gaps">Market Gaps</TabsTrigger>
          <TabsTrigger value="categories">Category Intelligence</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Intelligence</TabsTrigger>
          <TabsTrigger value="geographic">Geographic Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High-Demand Market Gaps</CardTitle>
              <CardDescription>Search terms with high volume but low/no results - acquisition opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {marketGaps.slice(0, 10).map((gap) => (
                  <div key={gap.search_query} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm capitalize">"{gap.search_query}"</h4>
                      </div>
                      <Badge variant={gap.demand_score > 70 ? "destructive" : gap.demand_score > 40 ? "default" : "secondary"}>
                        {gap.demand_score.toFixed(0)} demand score
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">{gap.search_count}</span> searches
                      </div>
                      <div>
                        <span className="font-medium">{gap.avg_results.toFixed(1)}</span> avg results
                      </div>
                      <div>
                        <span className="font-medium">{gap.no_results_rate.toFixed(1)}%</span> no results
                      </div>
                    </div>

                    {gap.demand_score > 50 && (
                      <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        <strong>High opportunity:</strong> Consider acquiring businesses in this category
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category Performance & Opportunities</CardTitle>
              <CardDescription>Market saturation and growth opportunities by business category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryTrends.map((category) => (
                  <div key={category.category} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{category.category}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant={category.market_saturation === 'low' ? "default" : 
                                       category.market_saturation === 'medium' ? "secondary" : "outline"}>
                          {category.market_saturation} saturation
                        </Badge>
                        <Badge variant={category.opportunity_score > 60 ? "default" : "secondary"}>
                          {category.opportunity_score.toFixed(0)} opportunity
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-xs text-muted-foreground mb-2">
                      <div>
                        <span className="font-medium">{category.current_listings}</span> listings
                      </div>
                      <div>
                        <span className="font-medium">{category.views_trend}</span> total views
                      </div>
                      <div>
                        <span className="font-medium">{category.saves_trend}</span> total saves
                      </div>
                      <div>
                        <span className="font-medium">{category.connections_trend}</span> connections
                      </div>
                    </div>

                    {category.opportunity_score > 60 && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <TrendingUp className="h-3 w-3 inline mr-1" />
                        <strong>High opportunity:</strong> Low competition, good demand - focus acquisition here
                      </div>
                    )}
                    
                    {category.market_saturation === 'high' && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        <TrendingDown className="h-3 w-3 inline mr-1" />
                        <strong>Saturated market:</strong> Many listings, low average performance
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Intelligence by Category</CardTitle>
              <CardDescription>Optimal pricing strategies based on market performance data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pricingInsights.map((insight) => (
                  <div key={insight.category} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{insight.category}</h4>
                      <Badge variant="outline">
                        {insight.listing_count} listings analyzed
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Market Range</p>
                        <p className="font-medium text-sm">{insight.revenue_range}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Optimal Sweet Spot</p>
                        <p className="font-medium text-sm text-green-600">
                          ${(insight.optimal_pricing.sweet_spot / 1000000).toFixed(1)}M
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground mb-2">
                      <div>
                        Optimal Range: ${(insight.optimal_pricing.min / 1000000).toFixed(1)}M - ${(insight.optimal_pricing.max / 1000000).toFixed(1)}M
                      </div>
                      <div>
                        Avg Views: {insight.avg_views}
                      </div>
                      <div>
                        Avg Conversion: {insight.avg_conversion_rate.toFixed(1)}%
                      </div>
                    </div>

                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                      <DollarSign className="h-3 w-3 inline mr-1" />
                      <strong>Recommendation:</strong> Listings priced around ${(insight.optimal_pricing.sweet_spot / 1000000).toFixed(1)}M tend to perform {insight.avg_conversion_rate > 3 ? 'well' : 'moderately'} in this category
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geographic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Market Analysis</CardTitle>
              <CardDescription>User demand vs listing supply by location - expansion opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {geographicInsights.map((geo) => (
                  <div key={geo.location} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">{geo.location}</h4>
                      </div>
                      <Badge variant={geo.expansion_opportunity === 'high' ? "default" : 
                                     geo.expansion_opportunity === 'medium' ? "secondary" : "outline"}>
                        {geo.expansion_opportunity} opportunity
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-xs text-muted-foreground mb-2">
                      <div>
                        <span className="font-medium">{geo.user_count}</span> users
                      </div>
                      <div>
                        <span className="font-medium">{geo.listing_count}</span> listings
                      </div>
                      <div>
                        <span className="font-medium">{geo.demand_supply_ratio.toFixed(1)}</span> demand/supply
                      </div>
                      <div>
                        <span className="font-medium">{geo.avg_user_engagement.toFixed(1)}</span> avg engagement
                      </div>
                    </div>

                    {geo.expansion_opportunity === 'high' && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <Target className="h-3 w-3 inline mr-1" />
                        <strong>Prime expansion target:</strong> High user demand ({geo.user_count} users) with limited supply ({geo.listing_count} listings)
                      </div>
                    )}

                    {geo.demand_supply_ratio > 15 && (
                      <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        <strong>Supply shortage:</strong> {geo.demand_supply_ratio.toFixed(1)}x more users than listings - urgent acquisition opportunity
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}