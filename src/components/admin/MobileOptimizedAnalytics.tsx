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
  total_feedback: number;
  unread_count: number;
  avg_response_time_hours: number;
  satisfaction_avg: number;
  category_breakdown: any;
  priority_breakdown: any;
  daily_trends: any;
}

export function MobileOptimizedAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Call the database function directly
      const { data: analyticsData, error } = await supabase
        .rpc('get_feedback_analytics', { days_back: timeRange });

      if (error) throw error;

      if (analyticsData && analyticsData.length > 0) {
        setData(analyticsData[0]);
      } else {
        // Fallback empty data
        setData({
          total_feedback: 0,
          unread_count: 0,
          avg_response_time_hours: 0,
          satisfaction_avg: 0,
          category_breakdown: {},
          priority_breakdown: {},
          daily_trends: []
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

  const renderCategoryChart = () => {
    if (!data?.category_breakdown) return <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>;
    
    const categories = Object.entries(data.category_breakdown).map(([name, value]) => ({ name, value }));
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={categories}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {categories.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderPriorityChart = () => {
    if (!data?.priority_breakdown) return <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>;
    
    const priorities = Object.entries(data.priority_breakdown).map(([name, value]) => ({ name, value }));

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={priorities}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderDailyTrends = () => {
    if (!data?.daily_trends || data.daily_trends.length === 0) {
      return <div className="flex items-center justify-center h-full text-muted-foreground">No trend data available</div>;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.daily_trends}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString()}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleDateString()}
            formatter={(value, name) => [value, name === 'count' ? 'Feedback Count' : 'Avg Response Time (hrs)']}
          />
          <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
          <Line type="monotone" dataKey="avg_response_time" stroke="#82ca9d" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-3 md:p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-6 bg-muted rounded"></div>
              </div>
            </Card>
          ))}
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Time Range Selector */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: '24h', value: 1 },
          { label: '7d', value: 7 },
          { label: '30d', value: 30 },
          { label: '90d', value: 90 }
        ].map((range) => (
          <Button
            key={range.value}
            variant={timeRange === range.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(range.value)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card className="p-3 md:p-4 bg-blue-50 border-blue-200">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <div className="text-xs md:text-sm font-medium text-blue-900">Total Feedback</div>
            </div>
            <div className="text-lg md:text-2xl font-bold text-blue-900">{data.total_feedback || 0}</div>
          </CardContent>
        </Card>

        <Card className="p-3 md:p-4 bg-orange-50 border-orange-200">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <div className="text-xs md:text-sm font-medium text-orange-900">Unread</div>
            </div>
            <div className="text-lg md:text-2xl font-bold text-orange-900">{data.unread_count || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="p-3 md:p-4 bg-green-50 border-green-200">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-green-600" />
              <div className="text-xs md:text-sm font-medium text-green-900">Response Time</div>
            </div>
            <div className="text-lg md:text-2xl font-bold text-green-900">
              {data.avg_response_time_hours ? `${Math.round(Number(data.avg_response_time_hours))}h` : 'N/A'}
            </div>
          </CardContent>
        </Card>
        
        <Card className="p-3 md:p-4 bg-purple-50 border-purple-200">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-purple-600" />
              <div className="text-xs md:text-sm font-medium text-purple-900">Satisfaction</div>
            </div>
            <div className="text-lg md:text-2xl font-bold text-purple-900">
              {data.satisfaction_avg ? `${Number(data.satisfaction_avg).toFixed(1)}/5` : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts - Stack on mobile, side-by-side on desktop */}
      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
        {/* Category Breakdown */}
        <Card className="p-4 md:p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Feedback by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[200px] md:h-[300px]">{renderCategoryChart()}</div>
          </CardContent>
        </Card>

        {/* Priority Breakdown */}
        <Card className="p-4 md:p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[200px] md:h-[300px]">{renderPriorityChart()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trends */}
      <Card className="p-4 md:p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Daily Feedback Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[250px] md:h-[400px]">{renderDailyTrends()}</div>
        </CardContent>
      </Card>
    </div>
  );
}