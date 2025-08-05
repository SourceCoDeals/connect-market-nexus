import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Users, 
  Settings,
  TrendingUp,
  Activity,
  MessageSquare,
  AlertTriangle,
  Clock,
  Eye,
  Heart,
  RefreshCw
} from 'lucide-react';
import { useAdmin } from '@/hooks/use-admin';
import { useIsMobile } from '@/hooks/use-mobile';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StreamlinedOverviewTab } from './StreamlinedOverviewTab';
import { StreamlinedAnalyticsTab } from './StreamlinedAnalyticsTab';
import { StreamlinedManagementTab } from './StreamlinedManagementTab';

export function StreamlinedAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const isMobile = useIsMobile();
  const { useStats } = useAdmin();
  const { data: stats, isLoading, refetch } = useStats();

  const handleRefresh = () => {
    refetch();
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: TrendingUp,
      description: 'Key metrics and live activity'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      description: 'Business intelligence and insights'
    },
    {
      id: 'management',
      label: 'Management',
      icon: Settings,
      description: 'User management and system health'
    }
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Streamlined marketplace management and insights
            </p>
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            className="self-start sm:self-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Main Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${isMobile ? 'grid-cols-1 h-auto' : 'grid-cols-3'}`}>
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.id}
                value={tab.id} 
                className={`${isMobile ? 'flex items-center justify-start gap-3 p-4' : 'flex-col gap-1 py-3'}`}
              >
                <tab.icon className="h-4 w-4" />
                <div className={isMobile ? 'text-left' : 'text-center'}>
                  <div className="font-medium">{tab.label}</div>
                  {isMobile && (
                    <div className="text-xs text-muted-foreground">{tab.description}</div>
                  )}
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab Content */}
          <TabsContent value="overview" className="space-y-6">
            <StreamlinedOverviewTab 
              stats={stats} 
              isLoading={isLoading}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <StreamlinedAnalyticsTab />
          </TabsContent>

          <TabsContent value="management" className="space-y-6">
            <StreamlinedManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}