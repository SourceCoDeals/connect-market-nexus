import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAnalytics } from '@/context/AnalyticsContext';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { RefreshCw, Play, Database } from 'lucide-react';

export function AnalyticsTestPanel() {
  const { trackEvent, trackPageView, trackListingView, trackListingSave, trackConnectionRequest, trackSearch } = useAnalytics();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const logTestResult = (testName: string, success: boolean, details?: any) => {
    const result = {
      test: testName,
      success,
      timestamp: new Date().toLocaleTimeString(),
      details
    };
    setTestResults(prev => [result, ...prev.slice(0, 9)]); // Keep only last 10 results
  };

  const runComprehensiveTest = async () => {
    setIsRunningTests(true);
    setTestResults([]);

    // Starting comprehensive analytics test suite

    try {
      // Test 1: Track a custom event
      // Test 1: Custom Event Tracking
      await trackEvent('test_event', { test: true, timestamp: Date.now() });
      logTestResult('Custom Event', true, 'test_event tracked');

      // Test 2: Track a page view
      // Test 2: Page View Tracking
      await trackPageView('/admin/test-page');
      logTestResult('Page View', true, '/admin/test-page tracked');

      // Test 3: Track a listing view
      // Test 3: Listing View Tracking
      await trackListingView('test-listing-123');
      logTestResult('Listing View', true, 'test-listing-123 tracked');

      // Test 4: Track a listing save
      // Test 4: Listing Save Tracking
      await trackListingSave('test-listing-123');
      logTestResult('Listing Save', true, 'test-listing-123 saved');

      // Test 5: Track a connection request
      // Test 5: Connection Request Tracking
      await trackConnectionRequest('test-listing-123');
      logTestResult('Connection Request', true, 'test-listing-123 connection requested');

      // Test 6: Track a search
      // Debug log removed
      await trackSearch('test search query', { category: 'technology' }, 42);
      logTestResult('Search Query', true, 'test search tracked with 42 results');

      // Wait a moment for database operations to complete
      setTimeout(async () => {
        try {
          // Test 7: Verify data in database
          // Debug log removed
          
          const { data: pageViews } = await supabase
            .from('page_views')
            .select('*')
            .eq('page_path', '/admin/test-page')
            .order('created_at', { ascending: false })
            .limit(1);

          const { data: listingAnalytics } = await supabase
            .from('listing_analytics')
            .select('*')
            .eq('listing_id', 'test-listing-123')
            .order('created_at', { ascending: false })
            .limit(3);

          const { data: userEvents } = await supabase
            .from('user_events')
            .select('*')
            .eq('event_type', 'test_event')
            .order('created_at', { ascending: false })
            .limit(1);

          const { data: searchAnalytics } = await supabase
            .from('search_analytics')
            .select('*')
            .eq('search_query', 'test search query')
            .order('created_at', { ascending: false })
            .limit(1);

          logTestResult('Database - Page Views', pageViews && pageViews.length > 0, `${pageViews?.length || 0} page views found`);
          logTestResult('Database - Listing Analytics', listingAnalytics && listingAnalytics.length > 0, `${listingAnalytics?.length || 0} listing analytics found`);
          logTestResult('Database - User Events', userEvents && userEvents.length > 0, `${userEvents?.length || 0} user events found`);
          logTestResult('Database - Search Analytics', searchAnalytics && searchAnalytics.length > 0, `${searchAnalytics?.length || 0} search analytics found`);

          setIsRunningTests(false);
          // Analytics test suite completed
          
        } catch (error) {
          console.error('🧪 Database verification failed:', error);
          logTestResult('Database Verification', false, `Error: ${error}`);
          setIsRunningTests(false);
        }
      }, 2000);

    } catch (error) {
      console.error('🧪 Analytics test failed:', error);
      logTestResult('Test Suite', false, `Error: ${error}`);
      setIsRunningTests(false);
    }
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Analytics Test Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runComprehensiveTest}
            disabled={isRunningTests}
            className="flex items-center gap-2"
          >
            {isRunningTests ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isRunningTests ? 'Running Tests...' : 'Run Analytics Test Suite'}
          </Button>
          <Button 
            variant="outline" 
            onClick={clearTestResults}
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            Clear Results
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Test Results:</h4>
          {testResults.length === 0 && (
            <p className="text-sm text-muted-foreground">No tests run yet. Click "Run Analytics Test Suite" to test all tracking functions.</p>
          )}
          {testResults.map((result, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                <Badge variant={result.success ? "default" : "destructive"}>
                  {result.success ? "✅" : "❌"}
                </Badge>
                <span className="text-sm font-medium">{result.test}</span>
                <span className="text-xs text-muted-foreground">{result.timestamp}</span>
              </div>
              {result.details && (
                <span className="text-xs text-muted-foreground">{result.details}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}