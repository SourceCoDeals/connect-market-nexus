import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, MessageSquare, Clock, Users, Star, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  totalFeedback: number;
  avgResponseTime: number;
  satisfactionRating: number;
  unreadCount: number;
  categoryBreakdown: Array<{ category: string; count: number; color: string }>;
  priorityBreakdown: Array<{ priority: string; count: number; color: string }>;
  dailyTrends: Array<{ date: string; count: number; responseTime: number }>;
  userEngagement: Array<{ userId: string; name: string; feedbackCount: number; avgRating: number }>;
}

export function AdvancedAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      let daysBack = 30;
      
      switch (timeRange) {
        case '24h':
          daysBack = 1;
          break;
        case '7d':
          daysBack = 7;
          break;
        case '30d':
          daysBack = 30;
          break;
        case '90d':
          daysBack = 90;
          break;
      }

      // Use the new analytics function
      const { data: analyticsData, error: analyticsError } = await supabase
        .rpc('get_feedback_analytics', { days_back: daysBack });

      if (analyticsError) throw analyticsError;

      if (analyticsData && analyticsData.length > 0) {
        const result = analyticsData[0];
        
        // Process the data into the expected format
        const processedAnalytics: AnalyticsData = {
          totalFeedback: Number(result.total_feedback) || 0,
          avgResponseTime: Number(result.avg_response_time_hours) || 0,
          satisfactionRating: Number(result.satisfaction_avg) || 0,
          unreadCount: Number(result.unread_count) || 0,
          categoryBreakdown: result.category_breakdown ? 
            Object.entries(result.category_breakdown).map(([category, count], index) => ({
              category,
              count: Number(count),
              color: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'][index % 5]
            })) : [],
          priorityBreakdown: result.priority_breakdown ?
            Object.entries(result.priority_breakdown).map(([priority, count]) => ({
              priority,
              count: Number(count),
              color: {
                urgent: '#ff4444',
                high: '#ff8800',
                normal: '#44aa44',
                low: '#4488ff'
              }[priority as keyof typeof result] || '#666666'
            })) : [],
          dailyTrends: result.daily_trends || [],
          userEngagement: result.top_users || []
        };
        
        setAnalytics(processedAnalytics);
      } else {
        // Fallback to empty analytics
        setAnalytics({
          totalFeedback: 0,
          avgResponseTime: 0,
          satisfactionRating: 0,
          unreadCount: 0,
          categoryBreakdown: [],
          priorityBreakdown: [],
          dailyTrends: [],
          userEngagement: []
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processFeedbackData = (data: any[]): AnalyticsData => {
    const totalFeedback = data.length;
    const unreadCount = data.filter(item => item.status === 'unread').length;
    
    // Calculate average response time
    const respondedFeedback = data.filter(item => item.admin_response && item.updated_at > item.created_at);
    const avgResponseTime = respondedFeedback.reduce((acc, item) => {
      const responseTime = new Date(item.updated_at).getTime() - new Date(item.created_at).getTime();
      return acc + responseTime / (1000 * 60 * 60); // Convert to hours
    }, 0) / respondedFeedback.length || 0;

    // Calculate satisfaction rating
    const ratedFeedback = data.filter(item => item.satisfaction_rating);
    const satisfactionRating = ratedFeedback.reduce((acc, item) => acc + item.satisfaction_rating, 0) / ratedFeedback.length || 0;

    // Category breakdown
    const categoryCount = data.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];
    const categoryBreakdown = Object.entries(categoryCount).map(([category, count]: [string, number], index) => ({
      category,
      count,
      color: categoryColors[index % categoryColors.length]
    }));

    // Priority breakdown
    const priorityCount = data.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityColors = {
      urgent: '#ff4444',
      high: '#ff8800',
      normal: '#44aa44',
      low: '#4488ff'
    };
    
    const priorityBreakdown = Object.entries(priorityCount).map(([priority, count]: [string, number]) => ({
      priority,
      count,
      color: priorityColors[priority as keyof typeof priorityColors] || '#666666'
    }));

    // Daily trends
    const dailyData = data.reduce((acc, item) => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { count: 0, totalResponseTime: 0, responseCount: 0 };
      }
      acc[date].count++;
      
      if (item.admin_response && item.updated_at > item.created_at) {
        const responseTime = new Date(item.updated_at).getTime() - new Date(item.created_at).getTime();
        acc[date].totalResponseTime += responseTime / (1000 * 60 * 60);
        acc[date].responseCount++;
      }
      
      return acc;
    }, {} as Record<string, any>);

    const dailyTrends = Object.entries(dailyData).map(([date, data]: [string, any]) => ({
      date,
      count: data.count,
      responseTime: data.responseCount > 0 ? data.totalResponseTime / data.responseCount : 0
    }));

    // User engagement
    const userEngagement = data.reduce((acc, item) => {
      if (item.user_id) {
        const key = item.user_id;
        if (!acc[key]) {
          acc[key] = {
            userId: item.user_id,
            name: item.profiles ? `${item.profiles.first_name} ${item.profiles.last_name}` : 'Unknown User',
            feedbackCount: 0,
            totalRating: 0,
            ratingCount: 0
          };
        }
        acc[key].feedbackCount++;
        if (item.satisfaction_rating) {
          acc[key].totalRating += item.satisfaction_rating;
          acc[key].ratingCount++;
        }
      }
      return acc;
    }, {} as Record<string, any>);

    const userEngagementArray = Object.values(userEngagement).map((user: any) => ({
      userId: user.userId,
      name: user.name,
      feedbackCount: user.feedbackCount,
      avgRating: user.ratingCount > 0 ? user.totalRating / user.ratingCount : 0
    }));

    return {
      totalFeedback,
      avgResponseTime,
      satisfactionRating,
      unreadCount,
      categoryBreakdown,
      priorityBreakdown,
      dailyTrends,
      userEngagement: userEngagementArray
    };
  };

  const renderMetricCard = (title: string, value: string | number, icon: React.ReactNode, trend?: number) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && (
          <p className={`text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}% from last period
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">No analytics data available.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <div className="flex gap-2">
          {[
            { value: '24h', label: '24 Hours' },
            { value: '7d', label: '7 Days' },
            { value: '30d', label: '30 Days' },
            { value: '90d', label: '90 Days' }
          ].map((option) => (
            <Button
              key={option.value}
              variant={timeRange === option.value ? 'default' : 'outline'}
              onClick={() => setTimeRange(option.value)}
              size="sm"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderMetricCard(
          'Total Feedback',
          analytics.totalFeedback,
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        )}
        {renderMetricCard(
          'Avg Response Time',
          `${analytics.avgResponseTime.toFixed(1)}h`,
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
        {renderMetricCard(
          'Satisfaction Rating',
          `${analytics.satisfactionRating.toFixed(1)}/5`,
          <Star className="h-4 w-4 text-muted-foreground" />
        )}
        {renderMetricCard(
          'Unread Messages',
          analytics.unreadCount,
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="priorities">Priorities</TabsTrigger>
          <TabsTrigger value="users">User Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Feedback Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" name="Feedback Count" />
                  <Line type="monotone" dataKey="responseTime" stroke="#82ca9d" name="Response Time (hours)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.categoryBreakdown.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="capitalize">{item.category}</span>
                      </div>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="priorities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.priorityBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priority" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Users by Feedback Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.userEngagement.slice(0, 10).map((user, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">{user.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.feedbackCount} messages</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.avgRating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm">{user.avgRating.toFixed(1)}</span>
                        </div>
                      )}
                      <Badge variant="outline">{user.feedbackCount}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}