
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Shield, Activity, MessageSquare } from 'lucide-react';
import { MobileAnalyticsDashboard } from './MobileAnalyticsDashboard';
import { EnhancedAnalyticsHealthDashboard } from './EnhancedAnalyticsHealthDashboard';
import { UserActivityFeed } from './UserActivityFeed';
import { EnhancedFeedbackManagement } from './EnhancedFeedbackManagement';

export function MobileDashboardTabs() {
  return (
    <div className="w-full">
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 h-auto">
          <TabsTrigger value="analytics" className="flex flex-col items-center gap-1 p-3 text-xs">
            <BarChart className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="flex flex-col items-center gap-1 p-3 text-xs">
            <Shield className="h-4 w-4" />
            <span>Health</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex flex-col items-center gap-1 p-3 text-xs">
            <Activity className="h-4 w-4" />
            <span>Activity</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex flex-col items-center gap-1 p-3 text-xs">
            <MessageSquare className="h-4 w-4" />
            <span>Feedback</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="analytics" className="mt-0">
            <MobileAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="health" className="mt-0">
            <EnhancedAnalyticsHealthDashboard />
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <UserActivityFeed />
          </TabsContent>

          <TabsContent value="feedback" className="mt-0">
            <EnhancedFeedbackManagement />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
