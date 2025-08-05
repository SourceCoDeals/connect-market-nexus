import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Eye, 
  Search, 
  TrendingUp,
  Clock,
  Filter,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel
} from 'recharts';
import { useSimpleMarketplaceAnalytics } from '@/hooks/use-simple-marketplace-analytics';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';

export function StreamlinedAnalyticsTab() {
  const [timeRange, setTimeRange] = useState('30');
  const isMobile = useIsMobile();
  const { data: analytics, isLoading } = useSimpleMarketplaceAnalytics();

  // Mock data for advanced analytics (would come from enhanced analytics API)
  const userJourneyData = [
    { step: 'Landing', users: 1000, conversion: 100 },
    { step: 'Sign Up', users: 650, conversion: 65 },
    { step: 'Profile Complete', users: 520, conversion: 52 },
    { step: 'First Search', users: 480, conversion: 48 },
    { step: 'View Listing', users: 380, conversion: 38 },
    { step: 'Connection Request', users: 120, conversion: 12 }
  ];

  const listingPerformanceData = [
    { category: 'SaaS', views: 2800, saves: 450, connections: 85 },
    { category: 'E-commerce', views: 2200, saves: 380, connections: 72 },
    { category: 'Manufacturing', views: 1600, saves: 240, connections: 45 },
    { category: 'Healthcare', views: 1400, saves: 210, connections: 38 },
    { category: 'Real Estate', views: 1200, saves: 180, connections: 32 }
  ];

  const searchBehaviorData = [
    { term: 'SaaS', searches: 450, results_clicked: 280 },
    { term: 'profitable', searches: 320, results_clicked: 195 },
    { term: 'under 500k', searches: 280, results_clicked: 168 },
    { term: 'tech startup', searches: 240, results_clicked: 144 },
    { term: 'recurring revenue', searches: 210, results_clicked: 126 }
  ];

  const userPatternsData = [
    { hour: '6AM', active_users: 25 },
    { hour: '9AM', active_users: 120 },
    { hour: '12PM', active_users: 180 },
    { hour: '3PM', active_users: 200 },
    { hour: '6PM', active_users: 150 },
    { hour: '9PM', active_users: 80 },
    { hour: '12AM', active_users: 30 }
  ];

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Advanced Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Deep insights into user behavior and marketplace performance
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="conversion" className="space-y-4">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
          <TabsTrigger value="conversion" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            {!isMobile && 'Conversion'}
          </TabsTrigger>
          <TabsTrigger value="listings" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {!isMobile && 'Listings'}
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            {!isMobile && 'Search'}
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {!isMobile && 'Patterns'}
          </TabsTrigger>
        </TabsList>

        {/* Conversion Funnel */}
        <TabsContent value="conversion" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  User Journey Funnel
                </CardTitle>
                <CardDescription>
                  Conversion rates through the marketplace journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userJourneyData.map((step, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{step.step}</span>
                          <span className="text-sm text-muted-foreground">
                            {step.users} users ({step.conversion}%)
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${step.conversion}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Insights</CardTitle>
                <CardDescription>Key insights to improve conversions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Opportunity</span>
                    </div>
                    <p className="text-sm text-green-700">
                      65% sign-up rate is above industry average. Focus on profile completion.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">Improvement</span>
                    </div>
                    <p className="text-sm text-yellow-700">
                      Only 12% convert to connection requests. Consider improving listing quality.
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Insight</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      High view-to-save ratio indicates good listing discovery.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Listing Performance */}
        <TabsContent value="listings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Listing Performance by Category</CardTitle>
              <CardDescription>
                Views, saves, and connection requests by business category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={listingPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="views" fill="hsl(var(--primary))" name="Views" />
                  <Bar dataKey="saves" fill="hsl(var(--secondary))" name="Saves" />
                  <Bar dataKey="connections" fill="hsl(var(--accent))" name="Connections" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {listingPerformanceData.slice(0, 3).map((category, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="text-lg font-semibold">{category.category}</div>
                  <div className="text-sm text-muted-foreground mb-3">Business Category</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Conversion Rate</span>
                      <Badge variant="secondary">
                        {((category.connections / category.views) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Save Rate</span>
                      <Badge variant="outline">
                        {((category.saves / category.views) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Search Analytics */}
        <TabsContent value="search" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Search Terms</CardTitle>
                <CardDescription>Most popular search queries and click-through rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {searchBehaviorData.map((search, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">"{search.term}"</span>
                          <span className="text-sm text-muted-foreground">
                            {search.searches} searches
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full"
                            style={{ 
                              width: `${(search.results_clicked / search.searches) * 100}%` 
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {((search.results_clicked / search.searches) * 100).toFixed(1)}% CTR
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Search Insights</CardTitle>
                <CardDescription>Actionable insights from search behavior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="text-sm font-medium mb-1">Popular Categories</div>
                    <p className="text-sm text-muted-foreground">
                      SaaS and tech-related searches dominate, indicating market demand
                    </p>
                  </div>
                  
                  <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-lg">
                    <div className="text-sm font-medium mb-1">Price Sensitivity</div>
                    <p className="text-sm text-muted-foreground">
                      "Under 500k" searches suggest budget-conscious buyers
                    </p>
                  </div>

                  <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
                    <div className="text-sm font-medium mb-1">Quality Focus</div>
                    <p className="text-sm text-muted-foreground">
                      "Profitable" and "recurring revenue" indicate quality-focused searches
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* User Patterns */}
        <TabsContent value="patterns" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity Patterns</CardTitle>
                <CardDescription>User activity throughout the day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={userPatternsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="active_users" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Engagement Summary</CardTitle>
                <CardDescription>Current engagement metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Peak Activity</span>
                    <Badge>3PM - 6PM</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Session Time</span>
                    <Badge variant="secondary">8.5 minutes</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pages per Session</span>
                    <Badge variant="outline">4.2 pages</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Bounce Rate</span>
                    <Badge variant="destructive">32%</Badge>
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

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}