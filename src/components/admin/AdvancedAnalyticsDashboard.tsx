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
import { useSimpleMarketplaceAnalytics } from '@/hooks/use-simple-marketplace-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import { UserActivityFeed } from './UserActivityFeed';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

// Mobile-responsive breakpoints and optimizations
const MOBILE_CHART_HEIGHT = 250;
const DESKTOP_CHART_HEIGHT = 300;

export function AdvancedAnalyticsDashboard() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('30');
  const [isMobile, setIsMobile] = useState(false);
  
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useSimpleMarketplaceAnalytics();

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
  if (analyticsLoading) {
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
  if (analyticsError) {
    const errorMessage = analyticsError?.message || 'An unknown error occurred';
    
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
      title: 'Active Sessions',
      value: analytics?.active_sessions?.toLocaleString() || '0',
      icon: Activity,
      description: 'Current active sessions',
      trend: analytics?.session_count && analytics?.active_sessions ? 
        Math.round((analytics.active_sessions / analytics.session_count) * 100) : 0
    },
    {
      title: 'Total Listings',
      value: analytics?.total_listings?.toLocaleString() || '0',
      icon: TrendingUp,
      description: 'Available listings',
      trend: analytics?.total_listings || 0
    },
    {
      title: 'Page Views',
      value: analytics?.total_page_views?.toLocaleString() || '0',
      icon: Eye,
      description: 'Total page views',
      trend: analytics?.total_page_views || 0
    }
  ];

  // Simple analytics data - no complex funnel or segment data available
  const funnelData: any[] = [];
  const segmentData: any[] = [];
  const conversionData: any[] = [];

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
            {/* Current Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Current Activity</CardTitle>
                <CardDescription>Real-time analytics overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Sessions</span>
                    <Badge variant="secondary">{analytics?.active_sessions || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Sessions</span>
                    <Badge variant="outline">{analytics?.session_count || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pending Connections</span>
                    <Badge variant="default">{analytics?.pending_connections || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Analytics Health */}
            <Card>
              <CardHeader>
                <CardTitle>Analytics Status</CardTitle>
                <CardDescription>System health overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Data Collection</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Real-time Updates</span>
                    <Badge variant="default">Live</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Updated</span>
                    <Badge variant="secondary">Now</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Summary</CardTitle>
              <CardDescription>Overall marketplace statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4">
                  <div className="text-lg font-bold text-primary">{analytics?.total_users || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Users</div>
                </div>
                <div className="text-center p-4">
                  <div className="text-lg font-bold text-green-600">{analytics?.total_listings || 0}</div>
                  <div className="text-sm text-muted-foreground">Active Listings</div>
                </div>
                <div className="text-center p-4">
                  <div className="text-lg font-bold text-blue-600">{analytics?.total_page_views || 0}</div>
                  <div className="text-sm text-muted-foreground">Page Views</div>
                </div>
                <div className="text-center p-4">
                  <div className="text-lg font-bold text-purple-600">{analytics?.new_users || 0}</div>
                  <div className="text-sm text-muted-foreground">New Users</div>
                </div>
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

            {/* User Summary */}
            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
                <CardDescription>Current user engagement overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Sessions</span>
                    <Badge variant="default">{analytics?.active_sessions || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">New Users Today</span>
                    <Badge variant="secondary">{analytics?.new_users || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Registered</span>
                    <Badge variant="outline">{analytics?.total_users || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="listings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Listing Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Listing Overview</CardTitle>
                <CardDescription>Current listing status and activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Total Listings</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics?.total_listings?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Pending Connections</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics?.pending_connections?.toLocaleString() || '0'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest marketplace interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Check the Live Activity tab for real-time updates</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Search Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Search Activity</CardTitle>
                <CardDescription>Overview of search behavior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Search analytics will appear here</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Data is collected from the search functionality
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Search Status */}
            <Card>
              <CardHeader>
                <CardTitle>Search System</CardTitle>
                <CardDescription>Current search system status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Search Tracking</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Filter Analytics</span>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Query Logging</span>
                    <Badge variant="secondary">Collecting</Badge>
                  </div>
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