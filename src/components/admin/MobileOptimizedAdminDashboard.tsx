import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { AdvancedAnalyticsDashboard } from './AdvancedAnalyticsDashboard';
import { UserActivityFeed } from './UserActivityFeed';
import { EnhancedAnalyticsHealthDashboard } from './EnhancedAnalyticsHealthDashboard';
import { MobileAnalyticsDashboard } from './MobileAnalyticsDashboard';
import { BarChart, Activity, Shield, TrendingUp } from 'lucide-react';

export function MobileOptimizedAdminDashboard() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-4 p-2">
        <div>
          <h1 className="text-lg font-bold">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Marketplace analytics and monitoring
          </p>
        </div>

        <Tabs defaultValue="analytics" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="analytics" className="text-xs p-2">
              <div className="flex flex-col items-center gap-1">
                <BarChart className="h-3 w-3" />
                <span>Analytics</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="health" className="text-xs p-2">
              <div className="flex flex-col items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Health</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs p-2">
              <div className="flex flex-col items-center gap-1">
                <Activity className="h-3 w-3" />
                <span>Activity</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-4 mt-4">
            <MobileAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="health" className="space-y-4 mt-4">
            <EnhancedAnalyticsHealthDashboard />
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 mt-4">
            <UserActivityFeed />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop version
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Marketplace Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Advanced marketplace analytics and system monitoring
        </p>
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics">Advanced Analytics</TabsTrigger>
          <TabsTrigger value="health">Analytics Health</TabsTrigger>
          <TabsTrigger value="activity">Live Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <AdvancedAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <EnhancedAnalyticsHealthDashboard />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <UserActivityFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}