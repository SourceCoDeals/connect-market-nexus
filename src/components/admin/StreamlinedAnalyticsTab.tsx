import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, Users, Clock, Target, DollarSign, Activity } from "lucide-react";
import { useState } from "react";
import { useSimpleMarketplaceAnalytics } from "@/hooks/use-simple-marketplace-analytics";
import { useConversionAnalytics } from "@/hooks/use-conversion-analytics";
import { useUserBehaviorAnalytics } from "@/hooks/use-user-behavior-analytics";
import { useRevenueIntelligence } from "@/hooks/use-revenue-intelligence";
import { Badge } from "@/components/ui/badge";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function StreamlinedAnalyticsTab() {
  const [timeRange, setTimeRange] = useState("30");
  const { data: analytics, isLoading } = useSimpleMarketplaceAnalytics(parseInt(timeRange));
  const { data: conversionData, isLoading: isLoadingConversion } = useConversionAnalytics(parseInt(timeRange));
  const { data: behaviorData, isLoading: isLoadingBehavior } = useUserBehaviorAnalytics(parseInt(timeRange));
  const { data: revenueData, isLoading: isLoadingRevenue } = useRevenueIntelligence(parseInt(timeRange));

  if (isLoading || isLoadingConversion || isLoadingBehavior || isLoadingRevenue) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
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

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Advanced Analytics</h2>
          <p className="text-muted-foreground">Deep insights into marketplace performance</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionData?.overallConversionRate?.toFixed(1) || '0'}%</div>
            <p className="text-xs text-muted-foreground">View to connection rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Value Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{behaviorData?.highValueUsers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Engaged, unconverted users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Probability Deals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenueData?.highProbabilityDeals || 0}</div>
            <p className="text-xs text-muted-foreground">Deals likely to close</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deal Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${((revenueData?.totalActiveDealValue || 0) / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-muted-foreground">Active deal pipeline</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="conversion" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="conversion">Conversion Intelligence</TabsTrigger>
          <TabsTrigger value="listings">Listing Performance</TabsTrigger>
          <TabsTrigger value="users">User Intelligence</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="conversion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel Analysis</CardTitle>
              <CardDescription>Real user progression through key marketplace actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conversionData?.conversionFunnel || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="step" />
                    <YAxis />
                    <Tooltip formatter={(value: number, name: string) => [
                      name === 'users' ? value.toLocaleString() : `${value}%`,
                      name === 'users' ? 'Users' : 'Drop-off Rate'
                    ]} />
                    <Bar dataKey="users" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm">
                {conversionData?.conversionFunnel && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {conversionData.conversionFunnel.map((step, index) => (
                      index > 0 && step.dropoff > 20 && (
                        <div key={step.step} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                          <strong>High drop-off:</strong> {step.dropoff}% at {step.step}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Converting Listings</CardTitle>
              <CardDescription>Listings with highest conversion rates and engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversionData?.listingConversions?.slice(0, 8).map((listing) => (
                  <div key={listing.listing_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{listing.listing_title}</h4>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <span>{listing.views} views</span>
                        <span>{listing.saves} saves</span>
                        <span>{listing.connections} connections</span>
                        <span>{(listing.avg_view_duration / 60).toFixed(1)}m avg time</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={listing.conversion_rate > 5 ? "default" : listing.conversion_rate > 2 ? "secondary" : "outline"}>
                        {listing.conversion_rate.toFixed(1)}% conversion
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        ${(listing.revenue / 1000000).toFixed(1)}M revenue
                      </p>
                    </div>
                  </div>
                )) || (
                  <p className="text-muted-foreground text-center py-4">No conversion data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>High-Value Users (Unconverted)</CardTitle>
                <CardDescription>Engaged users who haven't made connections yet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {behaviorData?.highValueUsers?.slice(0, 10).map((user) => (
                    <div key={user.user_id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                          <span>{user.total_views} views</span>
                          <span>{user.total_saves} saves</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default">Score: {user.engagement_score}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {user.churn_risk === 'high' ? '⚠️ At risk' : '✅ Active'}
                        </p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-muted-foreground text-center py-4">No high-value users found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Search Intelligence</CardTitle>
                <CardDescription>Popular search terms and content gaps</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {behaviorData?.searchInsights?.map((search, index) => (
                    <div key={search.search_query} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">#{index + 1}</span>
                        <span className="capitalize">{search.search_query}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{search.search_count} searches</div>
                        <div className="text-xs text-muted-foreground">
                          {search.conversion_rate.toFixed(1)}% click rate
                          {search.no_results_rate > 30 && (
                            <span className="text-red-500 ml-1">• Gap!</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )) || (
                    <p className="text-muted-foreground text-center py-4">No search data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Deal Probability Predictions</CardTitle>
                <CardDescription>Listings most likely to close based on engagement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {revenueData?.dealPredictions?.slice(0, 8).map((deal) => (
                    <div key={deal.listing_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{deal.listing_title}</h4>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span>{deal.category}</span>
                          <span>${(deal.revenue / 1000000).toFixed(1)}M revenue</span>
                          <span>{deal.interested_users} interested</span>
                          <span>{deal.days_on_market} days listed</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={deal.probability_score > 70 ? "default" : deal.probability_score > 40 ? "secondary" : "outline"}>
                          {deal.probability_score}% probability
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {deal.probability_score > 70 ? '🔥 Hot lead' : 
                           deal.probability_score > 40 ? '📈 Good potential' : '⏳ Needs work'}
                        </p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-muted-foreground text-center py-4">No deal predictions available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Market Demand Intelligence</CardTitle>
                <CardDescription>Categories with highest search volume and conversion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenueData?.marketDemand?.map((market) => (
                    <div key={market.category} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">{market.category}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{market.search_volume} searches</span>
                          <span>{market.avg_listing_views} avg views</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{market.conversion_rate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">conversion rate</p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-muted-foreground text-center py-4">No market data available</p>
                  )}
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-medium text-sm text-blue-900">Revenue Insights</h5>
                  <div className="mt-2 space-y-1 text-xs text-blue-700">
                    <p>• Avg User LTV: ${revenueData?.avgUserLifetimeValue?.toLocaleString() || 0}</p>
                    <p>• Active Pipeline: ${((revenueData?.totalActiveDealValue || 0) / 1000000).toFixed(1)}M</p>
                    <p>• Hot Deals: {revenueData?.highProbabilityDeals || 0} listings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}