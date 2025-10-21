import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, Target, Briefcase, BarChart3 } from "lucide-react";
import { User } from "@/types";
import { UserGrowthTrend } from "./stripe/UserGrowthTrend";
import { BuyerIntelligence } from "./stripe/BuyerIntelligence";
import { ProfileCompletionAnalysis } from "./stripe/ProfileCompletionAnalysis";
import { EngagementAnalytics } from "./stripe/EngagementAnalytics";
import { BusinessIntelligenceTab } from "./stripe/BusinessIntelligenceTab";
import { useState } from "react";

interface StripeAnalyticsTabProps {
  users: User[];
}

export function StripeAnalyticsTab({ users }: StripeAnalyticsTabProps) {
  const [timeRange, setTimeRange] = useState("30");

  // Calculate hero stats
  const heroStats = useMemo(() => {
    const now = new Date();
    const timeRangeDays = parseInt(timeRange);
    const cutoffDate = new Date(now.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);
    
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.approval_status === 'approved').length;
    const activeRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
    
    // Calculate growth
    const newUsersInPeriod = users.filter(u => new Date(u.created_at) >= cutoffDate).length;
    const previousPeriodStart = new Date(cutoffDate.getTime() - timeRangeDays * 24 * 60 * 60 * 1000);
    const previousPeriodUsers = users.filter(u => {
      const createdAt = new Date(u.created_at);
      return createdAt >= previousPeriodStart && createdAt < cutoffDate;
    }).length;
    const growthRate = previousPeriodUsers > 0 
      ? ((newUsersInPeriod - previousPeriodUsers) / previousPeriodUsers) * 100 
      : 100;
    
    // Calculate average profile completion
    const fields = [
      'first_name', 'last_name', 'email', 'company', 'phone_number',
      'website', 'linkedin_profile', 'buyer_type', 'ideal_target_description'
    ];
    const totalCompletion = users.reduce((sum, user) => {
      const completed = fields.filter(field => user[field as keyof User]).length;
      return sum + (completed / fields.length) * 100;
    }, 0);
    const avgCompletion = users.length > 0 ? totalCompletion / users.length : 0;

    return {
      totalUsers,
      activeRate,
      growthRate,
      avgCompletion,
      newUsersInPeriod,
    };
  }, [users, timeRange]);

  return (
    <div className="space-y-8 px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Analytics Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Deep insights into user behavior and growth
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hero Stats Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-bold tabular-nums">{heroStats.totalUsers.toLocaleString()}</p>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-success" />
                <span className="text-success font-medium">+{heroStats.newUsersInPeriod}</span>
                <span className="ml-1">this period</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Active Rate</p>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-bold tabular-nums">{heroStats.activeRate.toFixed(0)}%</p>
              <div className="flex items-center text-xs text-muted-foreground">
                <span>Approved users</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Growth</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-bold tabular-nums">
                {heroStats.growthRate > 0 ? '+' : ''}{heroStats.growthRate.toFixed(0)}%
              </p>
              <div className="flex items-center text-xs text-muted-foreground">
                <span>vs previous period</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Avg Completion</p>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-bold tabular-nums">{heroStats.avgCompletion.toFixed(0)}%</p>
              <div className="flex items-center text-xs text-muted-foreground">
                <span>Profile quality</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="growth" className="space-y-6">
        <TabsList className="bg-muted/30 h-11 p-1">
          <TabsTrigger value="growth" className="text-sm gap-2">
            <TrendingUp className="h-4 w-4" />
            Growth
          </TabsTrigger>
          <TabsTrigger value="buyers" className="text-sm gap-2">
            <Users className="h-4 w-4" />
            Buyer Intel
          </TabsTrigger>
          <TabsTrigger value="profiles" className="text-sm gap-2">
            <Target className="h-4 w-4" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="engagement" className="text-sm gap-2">
            <BarChart3 className="h-4 w-4" />
            Engagement
          </TabsTrigger>
          <TabsTrigger value="business" className="text-sm gap-2">
            <Briefcase className="h-4 w-4" />
            Business
          </TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-6 mt-0">
          <UserGrowthTrend users={users} timeRange={parseInt(timeRange)} />
        </TabsContent>

        <TabsContent value="buyers" className="space-y-6 mt-0">
          <BuyerIntelligence users={users} />
        </TabsContent>

        <TabsContent value="profiles" className="space-y-6 mt-0">
          <ProfileCompletionAnalysis users={users} />
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6 mt-0">
          <EngagementAnalytics users={users} />
        </TabsContent>

        <TabsContent value="business" className="space-y-6 mt-0">
          <BusinessIntelligenceTab users={users} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
