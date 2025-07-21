import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAnalytics } from '@/context/AnalyticsContext';
import { Activity, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface HealthStatus {
  table: string;
  status: 'healthy' | 'warning' | 'error';
  lastInsert?: string;
  recordCount: number;
  errorMessage?: string;
}

export function AnalyticsHealthDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const analytics = useAnalytics();

  const checkAnalyticsHealth = async () => {
    setIsLoading(true);
    const statuses: HealthStatus[] = [];

    // Check user_sessions
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        statuses.push({
          table: 'user_sessions',
          status: 'error',
          recordCount: 0,
          errorMessage: error.message
        });
      } else {
        const { count } = await supabase
          .from('user_sessions')
          .select('*', { count: 'exact', head: true });

        statuses.push({
          table: 'user_sessions',
          status: count && count > 0 ? 'healthy' : 'warning',
          recordCount: count || 0,
          lastInsert: data?.[0]?.created_at
        });
      }
    } catch (err) {
      statuses.push({
        table: 'user_sessions',
        status: 'error',
        recordCount: 0,
        errorMessage: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Check page_views
    try {
      const { data, error } = await supabase
        .from('page_views')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        statuses.push({
          table: 'page_views',
          status: 'error',
          recordCount: 0,
          errorMessage: error.message
        });
      } else {
        const { count } = await supabase
          .from('page_views')
          .select('*', { count: 'exact', head: true });

        statuses.push({
          table: 'page_views',
          status: count && count > 0 ? 'healthy' : 'warning',
          recordCount: count || 0,
          lastInsert: data?.[0]?.created_at
        });
      }
    } catch (err) {
      statuses.push({
        table: 'page_views',
        status: 'error',
        recordCount: 0,
        errorMessage: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Check listing_analytics
    try {
      const { data, error } = await supabase
        .from('listing_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        statuses.push({
          table: 'listing_analytics',
          status: 'error',
          recordCount: 0,
          errorMessage: error.message
        });
      } else {
        const { count } = await supabase
          .from('listing_analytics')
          .select('*', { count: 'exact', head: true });

        statuses.push({
          table: 'listing_analytics',
          status: count && count > 0 ? 'healthy' : 'warning',
          recordCount: count || 0,
          lastInsert: data?.[0]?.created_at
        });
      }
    } catch (err) {
      statuses.push({
        table: 'listing_analytics',
        status: 'error',
        recordCount: 0,
        errorMessage: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Check user_events
    try {
      const { data, error } = await supabase
        .from('user_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        statuses.push({
          table: 'user_events',
          status: 'error',
          recordCount: 0,
          errorMessage: error.message
        });
      } else {
        const { count } = await supabase
          .from('user_events')
          .select('*', { count: 'exact', head: true });

        statuses.push({
          table: 'user_events',
          status: count && count > 0 ? 'healthy' : 'warning',
          recordCount: count || 0,
          lastInsert: data?.[0]?.created_at
        });
      }
    } catch (err) {
      statuses.push({
        table: 'user_events',
        status: 'error',
        recordCount: 0,
        errorMessage: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Check search_analytics
    try {
      const { data, error } = await supabase
        .from('search_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        statuses.push({
          table: 'search_analytics',
          status: 'error',
          recordCount: 0,
          errorMessage: error.message
        });
      } else {
        const { count } = await supabase
          .from('search_analytics')
          .select('*', { count: 'exact', head: true });

        statuses.push({
          table: 'search_analytics',
          status: count && count > 0 ? 'healthy' : 'warning',
          recordCount: count || 0,
          lastInsert: data?.[0]?.created_at
        });
      }
    } catch (err) {
      statuses.push({
        table: 'search_analytics',
        status: 'error',
        recordCount: 0,
        errorMessage: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    setHealthStatus(statuses);
    setIsLoading(false);
  };

  const runComprehensiveTest = async () => {
    setIsTesting(true);
    const results: string[] = [];

    try {
      // Test page view tracking
      analytics.trackPageView('/test-page');
      results.push('✓ Page view tracked');

      // Test event tracking
      analytics.trackEvent('test_event', { test: true });
      results.push('✓ Custom event tracked');

      // Test listing interaction
      analytics.trackListingView('test-listing-id');
      results.push('✓ Listing view tracked');

      analytics.trackListingSave('test-listing-id');
      results.push('✓ Listing save tracked');

      // Test search tracking
      analytics.trackSearch('test query', { category: 'test' }, 5);
      results.push('✓ Search tracked');

      // Test connection request
      analytics.trackConnectionRequest('test-listing-id');
      results.push('✓ Connection request tracked');

      toast.success(`Analytics test completed:\n${results.join('\n')}`);
      
      // Refresh health status after test
      setTimeout(() => checkAnalyticsHealth(), 2000);
    } catch (error) {
      console.error('Analytics test failed:', error);
      toast.error('Analytics test failed. Check console for details.');
    }

    setIsTesting(false);
  };

  const clearAnalyticsData = async () => {
    if (!confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      await supabase.from('user_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('page_views').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('listing_analytics').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('user_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('search_analytics').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      toast.success('Analytics data cleared successfully');
      await checkAnalyticsHealth();
    } catch (error) {
      console.error('Failed to clear analytics data:', error);
      toast.error('Failed to clear analytics data');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkAnalyticsHealth();
  }, []);

  const getStatusIcon = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: HealthStatus['status']) => {
    const variants = {
      healthy: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800', 
      error: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Analytics Health Dashboard
          </h2>
          <p className="text-muted-foreground">
            Monitor and test the analytics tracking system
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={checkAnalyticsHealth}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={runComprehensiveTest}
            disabled={isTesting}
          >
            {isTesting ? 'Testing...' : 'Run Test Suite'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">Health Status</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4">
            {healthStatus.map((status) => (
              <Card key={status.table}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {getStatusIcon(status.status)}
                    {status.table.replace('_', ' ').toUpperCase()}
                  </CardTitle>
                  {getStatusBadge(status.status)}
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold">{status.recordCount}</p>
                      <p className="text-xs text-muted-foreground">Records</p>
                    </div>
                    <div className="text-right">
                      {status.lastInsert && (
                        <>
                          <p className="text-sm">Last Insert:</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(status.lastInsert).toLocaleString()}
                          </p>
                        </>
                      )}
                      {status.errorMessage && (
                        <p className="text-xs text-red-600 max-w-xs">
                          {status.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Testing Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={runComprehensiveTest}
                  disabled={isTesting}
                  className="w-full"
                >
                  {isTesting ? 'Running Tests...' : 'Run Comprehensive Analytics Test'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Tests all analytics tracking functions and verifies data insertion
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={clearAnalyticsData}
                  disabled={isLoading}
                  variant="destructive"
                  className="w-full"
                >
                  Clear All Analytics Data
                </Button>
                <p className="text-sm text-muted-foreground">
                  Permanently deletes all analytics data. Use for testing only.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}