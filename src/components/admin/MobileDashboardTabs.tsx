
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Shield, Activity, MessageSquare } from 'lucide-react';
import { MobileAnalyticsDashboard } from './MobileAnalyticsDashboard';
import { EnhancedAnalyticsHealthDashboard } from './EnhancedAnalyticsHealthDashboard';
import { UserActivityFeed } from './UserActivityFeed';
import { EnhancedFeedbackManagement } from './EnhancedFeedbackManagement';

export function MobileDashboardTabs() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your marketplace</p>
      </div>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4 h-auto">
          <TabsTrigger value="analytics" className="flex flex-col items-center gap-1 p-2 text-xs">
            <BarChart className="h-3 w-3" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="flex flex-col items-center gap-1 p-2 text-xs">
            <Shield className="h-3 w-3" />
            <span>Health</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex flex-col items-center gap-1 p-2 text-xs">
            <Activity className="h-3 w-3" />
            <span>Activity</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex flex-col items-center gap-1 p-2 text-xs">
            <MessageSquare className="h-3 w-3" />
            <span>Feedback</span>
          </TabsTrigger>
        </TabsList>

        <div className="space-y-4">
          <TabsContent value="analytics" className="mt-0 space-y-4">
            <MobileAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="health" className="mt-0 space-y-4">
            <EnhancedAnalyticsHealthDashboard />
          </TabsContent>

          <TabsContent value="activity" className="mt-0 space-y-4">
            <UserActivityFeed />
          </TabsContent>

          <TabsContent value="feedback" className="mt-0 space-y-4">
            <EnhancedFeedbackManagement />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
