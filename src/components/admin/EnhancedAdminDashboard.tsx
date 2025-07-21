import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdvancedAnalyticsDashboard } from './AdvancedAnalyticsDashboard';
import { UserActivityFeed } from './UserActivityFeed';
import { EnhancedAnalyticsHealthDashboard } from './EnhancedAnalyticsHealthDashboard';

export function EnhancedAdminDashboard() {
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