
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdvancedAnalyticsDashboard } from './AdvancedAnalyticsDashboard';
import { UserActivityFeed } from './UserActivityFeed';
import { EnhancedAnalyticsHealthDashboard } from './EnhancedAnalyticsHealthDashboard';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function EnhancedAdminDashboard() {
  const queryClient = useQueryClient();

  const handleManualRefresh = () => {
    
    queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">Marketplace Analytics Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Advanced marketplace analytics and system monitoring
          </p>
        </div>
        <Button
          onClick={handleManualRefresh}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto">
          <TabsTrigger value="analytics" className="text-xs md:text-sm py-2">Advanced Analytics</TabsTrigger>
          <TabsTrigger value="health" className="text-xs md:text-sm py-2">Analytics Health</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs md:text-sm py-2">Live Activity</TabsTrigger>
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
