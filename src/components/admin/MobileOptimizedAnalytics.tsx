import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Eye, 
  Search,
  Heart,
  Link,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useSimpleMarketplaceAnalytics } from '@/hooks/use-simple-marketplace-analytics';
import { cn } from "@/lib/utils";

const MOBILE_CHART_HEIGHT = 200;
const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function MobileOptimizedAnalytics() {
  const [selectedChartType, setSelectedChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [currentSection, setCurrentSection] = useState(0);
  
  const { data: analytics, isLoading, error, refetch } = useSimpleMarketplaceAnalytics();

  // Sample data for charts (replace with real data when available)
  const chartData = [
    { name: 'Week 1', users: analytics?.new_users || 12, listings: analytics?.total_listings || 8, views: 45 },
    { name: 'Week 2', users: analytics?.new_users || 19, listings: analytics?.total_listings || 15, views: 67 },
    { name: 'Week 3', users: analytics?.new_users || 25, listings: analytics?.total_listings || 22, views: 89 },
    { name: 'Week 4', users: analytics?.new_users || 31, listings: analytics?.total_listings || 28, views: 112 },
  ];

  const pieData = [
    { name: 'Page Views', value: analytics?.total_page_views || 245, color: 'hsl(var(--primary))' },
    { name: 'Listing Views', value: analytics?.total_listings || 156, color: 'hsl(var(--secondary))' },
    { name: 'User Events', value: analytics?.total_users || 89, color: 'hsl(var(--accent))' },
    { name: 'Searches', value: 67, color: 'hsl(var(--muted))' },
  ];

  const sections = [
    {
      title: 'Overview',
      icon: Activity,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
              <CardContent className="p-0">
                <div className="flex items-center justify-between mb-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">Total</Badge>
                </div>
                <div className="text-xl font-bold text-blue-900">{analytics?.total_users || 0}</div>
                <p className="text-xs text-blue-700">Users</p>
              </CardContent>
            </Card>
            <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
              <CardContent className="p-0">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-700">Active</Badge>
                </div>
                <div className="text-xl font-bold text-green-900">{analytics?.active_sessions || 0}</div>
                <p className="text-xs text-green-700">Sessions</p>
              </CardContent>
            </Card>
          </div>
          
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm">Weekly Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveContainer width="100%" height={MOBILE_CHART_HEIGHT}>
                {selectedChartType === 'bar' ? (
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="users" fill="hsl(var(--primary))" />
                  </BarChart>
                ) : selectedChartType === 'line' ? (
                  <LineChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                )}
              </ResponsiveContainer>
              
              <div className="flex justify-center gap-2 mt-3">
                <Button
                  variant={selectedChartType === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedChartType('bar')}
                >
                  <BarChart3 className="h-3 w-3" />
                </Button>
                <Button
                  variant={selectedChartType === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedChartType('line')}
                >
                  <TrendingUp className="h-3 w-3" />
                </Button>
                <Button
                  variant={selectedChartType === 'pie' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedChartType('pie')}
                >
                  <PieChartIcon className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    },
    {
      title: 'Engagement',
      icon: Heart,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Page Views
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Views</span>
                  <Badge variant="secondary">{analytics?.total_page_views || 245}</Badge>
                </div>
                <Progress value={75} className="h-2" />
                <p className="text-xs text-muted-foreground">75% more than last week</p>
              </CardContent>
            </Card>
            
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Search Queries</span>
                  <Badge variant="secondary">67</Badge>
                </div>
                <Progress value={60} className="h-2" />
                <p className="text-xs text-muted-foreground">60% match rate</p>
              </CardContent>
            </Card>
            
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Connections
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">New Requests</span>
                  <Badge variant="secondary">{analytics?.pending_connections || 12}</Badge>
                </div>
                <Progress value={85} className="h-2" />
                <p className="text-xs text-muted-foreground">85% approval rate</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    },
    {
      title: 'Performance',
      icon: TrendingUp,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
              <CardContent className="p-0">
                <div className="text-lg font-bold text-purple-900">{analytics?.total_listings || 0}</div>
                <p className="text-xs text-purple-700">Active Listings</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-purple-600" />
                  <span className="text-xs text-purple-600">+12%</span>
                </div>
              </CardContent>
            </Card>
            <Card className="p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
              <CardContent className="p-0">
                <div className="text-lg font-bold text-orange-900">{analytics?.session_count || 0}</div>
                <p className="text-xs text-orange-700">Sessions</p>
                <div className="flex items-center gap-1 mt-1">
                  <Activity className="h-3 w-3 text-orange-600" />
                  <span className="text-xs text-orange-600">Live</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm">Key Metrics</CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>User Retention</span>
                  <span className="font-medium">78%</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Conversion Rate</span>
                  <span className="font-medium">23%</span>
                </div>
                <Progress value={23} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Engagement Score</span>
                  <span className="font-medium">91%</span>
                </div>
                <Progress value={91} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
          <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <Card key={i} className="p-3 animate-pulse">
              <div className="h-4 w-16 bg-muted rounded mb-2"></div>
              <div className="h-6 w-12 bg-muted rounded mb-1"></div>
              <div className="h-3 w-20 bg-muted rounded"></div>
            </Card>
          ))}
        </div>
        <Card className="p-4 animate-pulse">
          <div className="h-40 bg-muted rounded"></div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">Failed to load analytics</p>
          <Button onClick={() => refetch()} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentSectionData = sections[currentSection];

  return (
    <div className="space-y-4">
      {/* Section Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <currentSectionData.icon className="h-5 w-5" />
          <h3 className="font-semibold">{currentSectionData.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
            disabled={currentSection === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="text-xs">
            {currentSection + 1} of {sections.length}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentSection(Math.min(sections.length - 1, currentSection + 1))}
            disabled={currentSection === sections.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Section Content */}
      <div className="space-y-4">
        {currentSectionData.content}
      </div>

      {/* Section Indicators */}
      <div className="flex justify-center gap-2">
        {sections.map((_, index) => (
          <button
            key={index}
            className={cn(
              "h-2 w-8 rounded-full transition-colors",
              index === currentSection 
                ? "bg-primary" 
                : "bg-muted hover:bg-muted-foreground/20"
            )}
            onClick={() => setCurrentSection(index)}
          />
        ))}
      </div>
    </div>
  );
}