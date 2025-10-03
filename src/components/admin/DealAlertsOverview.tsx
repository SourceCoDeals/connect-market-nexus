import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Users, Zap, Clock, TrendingUp } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AdminAlertManagement } from './AdminAlertManagement';

interface DealAlertStats {
  total_alerts: number;
  active_alerts: number;
  users_with_alerts: number;
  instant_alerts: number;
  daily_alerts: number;
  weekly_alerts: number;
  alerts_sent_today: number;
  top_categories: Array<{ category: string; count: number }>;
}

export function DealAlertsOverview() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'deal-alerts-stats'],
    queryFn: async () => {
      // Get basic alert statistics
      const { data: alertData, error: alertError } = await supabase
        .from('deal_alerts')
        .select(`
          id,
          is_active,
          frequency,
          criteria,
          user_id,
          created_at
        `);

      if (alertError) {
        console.error('Error fetching deal alerts:', alertError);
        throw alertError;
      }

      if (!alertData) {
        throw new Error('No alert data returned');
      }

      // Get alerts sent today
      const today = new Date().toISOString().split('T')[0];
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('alert_delivery_logs')
        .select('id')
        .gte('created_at', today + 'T00:00:00Z')
        .lt('created_at', today + 'T23:59:59Z');

      if (deliveryError) {
        console.error('Error fetching delivery logs:', deliveryError);
        // Don't throw on delivery log errors, just use 0
      }

      // Process the data
      const totalAlerts = alertData.length;
      const activeAlerts = alertData.filter(a => a.is_active).length;
      const uniqueUsers = new Set(alertData.map(a => a.user_id)).size;
      
      const instantAlerts = alertData.filter(a => a.frequency === 'instant').length;
      const dailyAlerts = alertData.filter(a => a.frequency === 'daily').length;
      const weeklyAlerts = alertData.filter(a => a.frequency === 'weekly').length;
      
      const alertsSentToday = deliveryData?.length || 0;

      // Get top categories from criteria
      const categoryCount: Record<string, number> = {};
      alertData.forEach(alert => {
        const criteria = alert.criteria as any;
        const category = criteria?.category;
        if (category && category !== 'all') {
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        }
      });

      const topCategories = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        total_alerts: totalAlerts,
        active_alerts: activeAlerts,
        users_with_alerts: uniqueUsers,
        instant_alerts: instantAlerts,
        daily_alerts: dailyAlerts,
        weekly_alerts: weeklyAlerts,
        alerts_sent_today: alertsSentToday,
        top_categories: topCategories,
      } as DealAlertStats;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load deal alerts statistics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_alerts}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active_alerts} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users with Alerts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users_with_alerts}</div>
            <p className="text-xs text-muted-foreground">
              Unique subscribers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts Sent Today</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.alerts_sent_today}</div>
            <p className="text-xs text-muted-foreground">
              Notifications delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instant Alerts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.instant_alerts}</div>
            <p className="text-xs text-muted-foreground">
              Real-time subscribers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Frequency Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Alert Frequency Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="default">Instant</Badge>
              <span className="text-sm text-muted-foreground">{stats.instant_alerts} alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Daily</Badge>
              <span className="text-sm text-muted-foreground">{stats.daily_alerts} alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Weekly</Badge>
              <span className="text-sm text-muted-foreground">{stats.weekly_alerts} alerts</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Categories */}
      {stats.top_categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Popular Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.top_categories.map((item, index) => (
                <div key={item.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="font-medium">{item.category}</span>
                  </div>
                  <Badge variant="secondary">{item.count} alerts</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Individual Alert Management */}
      <AdminAlertManagement />
    </div>
  );
}