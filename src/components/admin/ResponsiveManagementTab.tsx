import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Bell, Plus, Filter, TrendingUp, Users, Zap, Clock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminFeedbackTab } from "./AdminFeedbackTab";
import { DealAlertsOverview } from "./DealAlertsOverview";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function ResponsiveManagementTab() {
  const isMobile = useIsMobile();
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);

  // Quick stats for management overview
  const { data: quickStats } = useQuery({
    queryKey: ['admin', 'management-quick-stats'],
    queryFn: async () => {
      const [feedbackResult, alertsResult] = await Promise.all([
        supabase
          .from('feedback_messages')
          .select('id, status')
          .eq('status', 'pending'),
        supabase
          .from('deal_alerts')
          .select('id, is_active')
          .eq('is_active', true)
      ]);

      return {
        pendingFeedback: feedbackResult.data?.length || 0,
        activeAlerts: alertsResult.data?.length || 0,
      };
    },
  });

  const quickActions = [
    {
      id: 'respond-feedback',
      icon: MessageSquare,
      label: 'Respond to Feedback',
      badge: quickStats?.pendingFeedback || 0,
      variant: 'default' as const,
    },
    {
      id: 'create-alert',
      icon: Plus,
      label: 'Create Alert',
      variant: 'secondary' as const,
    },
    {
      id: 'manage-alerts',
      icon: Bell,
      label: 'Manage Alerts',
      badge: quickStats?.activeAlerts || 0,
      variant: 'outline' as const,
    },
  ];

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Mobile Quick Actions Bar */}
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-2">
              {quickActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant={action.variant}
                    className="justify-between h-12 px-4"
                    onClick={() => setActiveQuickAction(action.id)}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-4 w-4" />
                      <span className="font-medium">{action.label}</span>
                    </div>
                    {action.badge ? (
                      <Badge variant="secondary" className="ml-2">
                        {action.badge}
                      </Badge>
                    ) : null}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Mobile Management Tabs */}
        <Tabs defaultValue="feedback" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="feedback" className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4" />
              Feedback
              {quickStats?.pendingFeedback ? (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0.5 text-xs">
                  {quickStats.pendingFeedback}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4" />
              Deal Alerts
              {quickStats?.activeAlerts ? (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                  {quickStats.activeAlerts}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feedback" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Feedback Management</h3>
                  <p className="text-sm text-muted-foreground">Manage user feedback and responses</p>
                </div>
                <Button size="sm" variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
              <AdminFeedbackTab />
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Deal Alerts</h3>
                  <p className="text-sm text-muted-foreground">Monitor and manage deal alerts</p>
                </div>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  New Alert
                </Button>
              </div>
              <DealAlertsOverview />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop layout (unchanged functionality)
  return (
    <div className="space-y-6">
      {/* Desktop Quick Actions Overview */}
      <div className="grid grid-cols-3 gap-4">
        {quickActions.map((action) => {
          const IconComponent = action.icon;
          return (
            <Card key={action.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{action.label}</CardTitle>
                <IconComponent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Button variant={action.variant} size="sm">
                    Quick Action
                  </Button>
                  {action.badge ? (
                    <Badge variant="secondary">{action.badge}</Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Management Tabs */}
      <Tabs defaultValue="feedback" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Feedback Management
            {quickStats?.pendingFeedback ? (
              <Badge variant="destructive" className="ml-2">
                {quickStats.pendingFeedback}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Deal Alerts
            {quickStats?.activeAlerts ? (
              <Badge variant="secondary" className="ml-2">
                {quickStats.activeAlerts}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="space-y-6">
          <AdminFeedbackTab />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <DealAlertsOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
