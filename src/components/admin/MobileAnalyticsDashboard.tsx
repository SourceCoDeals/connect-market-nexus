import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdvancedAnalyticsDashboard } from './AdvancedAnalyticsDashboard';
import { UserActivityFeed } from './UserActivityFeed';
import { EnhancedAnalyticsHealthDashboard } from './EnhancedAnalyticsHealthDashboard';
import { BarChart, Activity, Shield, TrendingUp, RefreshCw } from 'lucide-react';
import { useSimpleMarketplaceAnalytics } from '@/hooks/use-simple-marketplace-analytics';

export function MobileAnalyticsDashboard() {
  const { data: analytics, isLoading, error, refetch } = useSimpleMarketplaceAnalytics();

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Analytics</h2>
          <Button size="sm" disabled>
            <RefreshCw className="h-4 w-4 mr-2" />
            Loading...
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2 p-3">
                <div className="h-3 w-16 bg-muted rounded"></div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="h-6 w-12 bg-muted rounded mb-1"></div>
                <div className="h-2 w-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Analytics</h2>
          <Button size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">Failed to load analytics</p>
          <p className="text-xs text-destructive mt-1">{error?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Analytics</h2>
        <Button size="sm" variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-2">
          <CardHeader className="pb-2 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Users</CardTitle>
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold">{analytics?.total_users || 0}</div>
            <p className="text-xs text-muted-foreground">Registered</p>
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="pb-2 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Active Sessions</CardTitle>
              <Activity className="h-3 w-3 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold">{analytics?.active_sessions || 0}</div>
            <p className="text-xs text-muted-foreground">Live now</p>
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="pb-2 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Listings</CardTitle>
              <BarChart className="h-3 w-3 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold">{analytics?.total_listings || 0}</div>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="pb-2 p-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Page Views</CardTitle>
              <Shield className="h-3 w-3 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold">{analytics?.total_page_views || 0}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Summary */}
      <Card className="p-3">
        <CardHeader className="pb-3 p-0">
          <CardTitle className="text-sm">Activity Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">New Users</span>
            <Badge variant="secondary" className="text-xs">
              {analytics?.new_users || 0}
            </Badge>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Pending Connections</span>
            <Badge variant="outline" className="text-xs">
              {analytics?.pending_connections || 0}
            </Badge>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Session Count</span>
            <Badge variant="secondary" className="text-xs">
              {analytics?.session_count || 0}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Additional Details Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="overview" className="text-xs px-2 py-1">Overview</TabsTrigger>
          <TabsTrigger value="health" className="text-xs px-2 py-1">Health</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs px-2 py-1">Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-3 mt-3">
          <Card className="p-3">
            <CardContent className="p-0">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {((analytics?.active_sessions || 0) / (analytics?.session_count || 1) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Active Session Rate</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-3 border rounded-lg">
              <Badge variant="default" className="text-xs mb-1">Live</Badge>
              <p className="text-xs text-muted-foreground">Data Collection</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <Badge variant="default" className="text-xs mb-1">Active</Badge>
              <p className="text-xs text-muted-foreground">Real-time</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-3 mt-3">
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">Live activity feed available in desktop view</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}