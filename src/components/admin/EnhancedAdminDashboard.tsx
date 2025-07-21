import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedFeedbackManagement } from './EnhancedFeedbackManagement';
import { AdvancedAnalyticsDashboard } from './AdvancedAnalyticsDashboard';
import { EmailTemplateManager } from './EmailTemplateManager';
import { UserActivityFeed } from './UserActivityFeed';
import { AnalyticsTestPanel } from './AnalyticsTestPanel';

export function EnhancedAdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Enhanced Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Comprehensive feedback management with advanced analytics and automation
        </p>
      </div>

      <Tabs defaultValue="feedback" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="feedback">Feedback Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="activity">Live Activity</TabsTrigger>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="space-y-4">
          <EnhancedFeedbackManagement />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AdvancedAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-6">
            <AnalyticsTestPanel />
            <UserActivityFeed />
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <EmailTemplateManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}