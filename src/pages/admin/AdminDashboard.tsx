import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Users, MessageSquare, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const AdminDashboard = () => {
  const { useStats, useRecentActivities } = useAdmin();
  const { data: stats, isLoading: isLoadingStats } = useStats();
  const { data: activities = [], isLoading: isLoadingActivities } = useRecentActivities();

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <CardDescription className="h-4 w-20 bg-muted rounded skeleton"></CardDescription>
            <CardTitle className="h-8 w-24 bg-muted rounded skeleton mt-1"></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-4 w-32 bg-muted rounded skeleton"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderActivitySkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((_, i) => (
        <div key={i} className="border-l-4 border-muted pl-4 py-1">
          <div className="h-4 w-3/4 bg-muted rounded skeleton"></div>
          <div className="h-3 w-1/3 bg-muted rounded skeleton mt-1"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {isLoadingStats ? (
        renderSkeleton()
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <Store className="h-4 w-4 mr-1" /> Listings
              </CardDescription>
              <CardTitle>{stats?.totalListings || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Active listings in marketplace
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <Users className="h-4 w-4 mr-1" /> Users
              </CardDescription>
              <CardTitle>{stats?.pendingUsers || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pending approval requests
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <MessageSquare className="h-4 w-4 mr-1" /> Connections
              </CardDescription>
              <CardTitle>{stats?.pendingConnections || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                New connection requests
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" /> Activity
              </CardDescription>
              <CardTitle>{stats?.totalUsers || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Total registered users
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest actions across the marketplace
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivities ? (
              renderActivitySkeleton()
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No recent activity to display
              </p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className={cn(
                      "border-l-4 pl-4 py-1",
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
      </div>
    </div>
  );
};

export default AdminDashboard;
