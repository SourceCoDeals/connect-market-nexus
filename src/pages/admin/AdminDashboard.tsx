
import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Users, MessageSquare, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { AdminFeedbackTab } from "@/components/admin/AdminFeedbackTab";
import { AdvancedAnalyticsDashboard } from "@/components/admin/AdvancedAnalyticsDashboard";

const AdminDashboard = () => {
  const { useStats, useRecentActivities } = useAdmin();
  const { data: stats, isLoading: isLoadingStats } = useStats();
  const { data: activities = [], isLoading: isLoadingActivities } = useRecentActivities();

  const renderSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
      {[1, 2, 3, 4].map((_, i) => (
        <Card key={i} className="p-3 md:p-4">
          <CardHeader className="p-0 pb-2">
            <CardDescription className="h-3 w-16 bg-muted rounded skeleton"></CardDescription>
            <CardTitle className="h-5 w-20 bg-muted rounded skeleton mt-1"></CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="h-3 w-24 bg-muted rounded skeleton"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderActivitySkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((_, i) => (
        <div key={i} className="border-l-4 border-muted pl-3 py-1">
          <div className="h-3 w-3/4 bg-muted rounded skeleton"></div>
          <div className="h-2 w-1/3 bg-muted rounded skeleton mt-1"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground">Overview of your marketplace</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs md:text-sm">Analytics</TabsTrigger>
          <TabsTrigger value="feedback" className="text-xs md:text-sm">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 md:space-y-6">
          {/* Overview Stats */}
          {isLoadingStats ? (
            renderSkeleton()
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              <Card className="p-3 md:p-4">
                <CardHeader className="p-0 pb-2">
                  <CardDescription className="flex items-center text-xs md:text-sm">
                    <Store className="h-3 w-3 md:h-4 md:w-4 mr-1" /> Listings
                  </CardDescription>
                  <CardTitle className="text-lg md:text-2xl">{stats?.totalListings || 0}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Active listings
                  </p>
                </CardContent>
              </Card>
              
              <Card className="p-3 md:p-4">
                <CardHeader className="p-0 pb-2">
                  <CardDescription className="flex items-center text-xs md:text-sm">
                    <Users className="h-3 w-3 md:h-4 md:w-4 mr-1" /> Users
                  </CardDescription>
                  <CardTitle className="text-lg md:text-2xl">{stats?.pendingUsers || 0}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Pending approval
                  </p>
                </CardContent>
              </Card>
              
              <Card className="p-3 md:p-4">
                <CardHeader className="p-0 pb-2">
                  <CardDescription className="flex items-center text-xs md:text-sm">
                    <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1" /> Connections
                  </CardDescription>
                  <CardTitle className="text-lg md:text-2xl">{stats?.pendingConnections || 0}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-xs md:text-sm text-muted-foreground">
                    New requests
                  </p>
                </CardContent>
              </Card>
              
              <Card className="p-3 md:p-4">
                <CardHeader className="p-0 pb-2">
                  <CardDescription className="flex items-center text-xs md:text-sm">
                    <TrendingUp className="h-3 w-3 md:h-4 md:w-4 mr-1" /> Total
                  </CardDescription>
                  <CardTitle className="text-lg md:text-2xl">{stats?.totalUsers || 0}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Registered users
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Recent Activity */}
          <Card className="p-4 md:p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-base md:text-lg">Recent Activity</CardTitle>
              <CardDescription className="text-sm">
                Latest actions across the marketplace
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingActivities ? (
                renderActivitySkeleton()
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No recent activity to display
                </p>
              ) : (
                <div className="space-y-3">
                  {activities.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className={cn(
                        "border-l-4 pl-3 py-1",
                        activity.type === "signup"
                          ? "border-green-500"
                          : activity.type === "connection_request"
                          ? "border-blue-500"
                          : activity.type === "listing_creation"
                          ? "border-purple-500"
                          : "border-gray-500"
                      )}
                    >
                      <p className="text-sm">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <AdvancedAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="feedback">
          <AdminFeedbackTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
