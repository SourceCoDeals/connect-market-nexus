import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Clock, 
  Search, 
  Eye, 
  Heart, 
  Link,
  RefreshCw,
  ChartBar,
  Target,
  AlertTriangle,
  MessageSquare,
  Star,
  AlertCircle
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
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import { useMarketplaceAnalytics, useDailyMetrics, useUserEngagementScores } from '@/hooks/use-marketplace-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import { UserActivityFeed } from './UserActivityFeed';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

// Mobile-responsive breakpoints and optimizations
const MOBILE_CHART_HEIGHT = 250;
const DESKTOP_CHART_HEIGHT = 300;

export function AdvancedAnalyticsDashboard() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('30');
  const [isMobile, setIsMobile] = useState(false);
  
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useMarketplaceAnalytics(parseInt(selectedTimeRange));
  const { data: dailyMetrics, isLoading: metricsLoading, error: metricsError } = useDailyMetrics(parseInt(selectedTimeRange));
  const { data: engagementScores, isLoading: engagementLoading, error: engagementError } = useUserEngagementScores();

  // Handle responsive design
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const chartHeight = isMobile ? MOBILE_CHART_HEIGHT : DESKTOP_CHART_HEIGHT;

  const handleRefresh = () => {
    refetchAnalytics();
  };

  // Enhanced loading state with better skeleton UI
  if (analyticsLoading || metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        
        {/* Loading skeleton for overview cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32 mb-2" />
                <Skeleton className="h-5 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Loading skeleton for tabs and charts */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-64 w-full rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Enhanced error handling with specific error types
  if (analyticsError || metricsError || engagementError) {
    const errorMessage = analyticsError?.message || metricsError?.message || engagementError?.message || 'An unknown error occurred';
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Advanced Analytics</h1>
            <p className="text-destructive">Failed to load analytics data</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-destructive">Analytics Unavailable</h3>
              <p className="text-sm text-muted-foreground">
                Unable to load analytics data. This might be due to a temporary issue with the database functions.
              </p>
              <p className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                Error: {errorMessage}
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleRefresh} size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <p className="text-xs text-muted-foreground">
                  If this persists, please contact support
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Fallback analytics display with sample data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Limited Analytics Preview
            </CardTitle>
            <CardDescription>
              Showing basic metrics while full analytics are unavailable
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <div className="text-sm font-medium">Total Users</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <div className="text-sm font-medium">Active Users</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <div className="text-sm font-medium">Sessions</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <div className="text-sm font-medium">Page Views</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overviewCards = [
    {
      title: 'Total Users',
      value: analytics?.total_users?.toLocaleString() || '0',
      icon: Users,
      description: `${analytics?.new_users || 0} new this period`,
      trend: analytics?.new_users && analytics?.total_users ? 
        Math.round((analytics.new_users / analytics.total_users) * 100) : 0
    },
    {
      title: 'Active Users',
      value: analytics?.active_users?.toLocaleString() || '0',
      icon: Activity,
      description: 'Users with sessions',
      trend: analytics?.active_users && analytics?.total_users ? 
        Math.round((analytics.active_users / analytics.total_users) * 100) : 0
    },
    {
      title: 'Avg Session Duration',
      value: `${Math.round(analytics?.avg_session_duration || 0)}m`,
      icon: Clock,
      description: 'Minutes per session',
      trend: Math.round(analytics?.avg_session_duration || 0)
    },
    {
      title: 'Page Views',
      value: analytics?.page_views?.toLocaleString() || '0',
      icon: Eye,
      description: 'Total page views',
      trend: analytics?.bounce_rate ? Math.round(100 - analytics.bounce_rate) : 0
    }
  ];

  const funnelData = analytics?.user_funnel?.map(step => ({
    value: step.count,
    name: step.step,
    conversion_rate: step.conversion_rate
  })) || [];

  const segmentData = analytics?.user_segments ? [
    { name: 'High Engagement', value: analytics.user_segments.high_engagement, color: COLORS[0] },
    { name: 'Medium Engagement', value: analytics.user_segments.medium_engagement, color: COLORS[1] },
    { name: 'Low Engagement', value: analytics.user_segments.low_engagement, color: COLORS[2] },
    { name: 'At Risk', value: analytics.user_segments.at_risk, color: COLORS[3] }
  ] : [];

  const conversionData = analytics?.conversion_metrics ? [
    { name: 'Signup to Profile', value: analytics.conversion_metrics.signup_to_profile_completion },
    { name: 'View to Save', value: analytics.conversion_metrics.view_to_save_rate },
    { name: 'View to Connect', value: analytics.conversion_metrics.view_to_connection_rate }
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive marketplace insights and user behavior analysis
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map((card, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
              <div className="flex items-center mt-2">
                <Badge variant="secondary" className="text-xs">
                  {card.trend}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-6 md:grid-cols-3 sm:grid-cols-2">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm">Live Activity</TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
          <TabsTrigger value="listings" className="text-xs sm:text-sm">Listings</TabsTrigger>
          <TabsTrigger value="search" className="text-xs sm:text-sm">Search</TabsTrigger>
          <TabsTrigger value="funnel" className="text-xs sm:text-sm">Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Daily Metrics Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity Trends</CardTitle>
                <CardDescription>User activity over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <LineChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Line type="monotone" dataKey="active_users" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="new_signups" stroke="hsl(var(--secondary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Pages */}
            <Card>
              <CardHeader>
                <CardTitle>Top Pages</CardTitle>
                <CardDescription>Most visited pages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.top_pages?.slice(0, 5).map((page, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm truncate">{page.page}</div>
                        <div className="text-xs text-muted-foreground">
                          {page.unique_views} unique views
                        </div>
                      </div>
                      <Badge variant="outline">{page.views}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Conversion Metrics</CardTitle>
              <CardDescription>Key conversion rates across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {conversionData.map((metric, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{metric.name}</span>
                      <span className="text-sm text-muted-foreground">{metric.value.toFixed(1)}%</span>
                    </div>
                    <Progress value={metric.value} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <UserActivityFeed />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* User Segments */}
            <Card>
              <CardHeader>
                <CardTitle>User Engagement Segments</CardTitle>
                <CardDescription>Users categorized by engagement level</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={segmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {segmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Engagement Scores */}
            <Card>
              <CardHeader>
                <CardTitle>Top Engaged Users</CardTitle>
                <CardDescription>Users with highest engagement scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {engagementLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))
                  ) : (
                    engagementScores?.slice(0, 5).map((user, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {user.profiles?.first_name} {user.profiles?.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {user.profiles?.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={user.score} className="w-20 h-2" />
                          <Badge variant={user.score >= 80 ? 'default' : user.score >= 40 ? 'secondary' : 'outline'}>
                            {user.score}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="listings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Listing Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Listing Performance</CardTitle>
                <CardDescription>Overview of listing interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Total Views</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics?.listing_performance?.total_views?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Total Saves</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics?.listing_performance?.total_saves?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Connections</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics?.listing_performance?.total_connections?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Avg Time</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {Math.round(analytics?.listing_performance?.avg_time_spent || 0)}s
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Listings */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Listings</CardTitle>
                <CardDescription>Listings with most views</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.listing_performance?.top_listings?.map((listing, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm truncate">
                          Listing {listing.listing_id.slice(0, 8)}...
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Listing ID: {listing.listing_id}
                        </div>
                      </div>
                      <Badge variant="outline">{listing.views} views</Badge>
                    </div>
                  )) || []}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Search Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Search Analytics</CardTitle>
                <CardDescription>Search behavior and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Total Searches</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics?.search_insights?.total_searches?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ChartBar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Avg Results</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {Math.round(analytics?.search_insights?.avg_results || 0)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">No Results Rate</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {Math.round(analytics?.search_insights?.no_results_rate || 0)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Search Queries */}
            <Card>
              <CardHeader>
                <CardTitle>Top Search Queries</CardTitle>
                <CardDescription>Most popular search terms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.search_insights?.top_queries?.map((query, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm truncate">"{query.query}"</div>
                      </div>
                      <Badge variant="outline">{query.count} searches</Badge>
                    </div>
                  )) || []}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Registration Funnel</CardTitle>
              <CardDescription>Track user conversion through registration process</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={funnelData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}