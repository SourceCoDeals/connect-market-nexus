
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Shield, Activity, MessageSquare, LayoutDashboard, Users, Store } from 'lucide-react';
import { MobileAnalyticsDashboard } from './MobileAnalyticsDashboard';
import { EnhancedAnalyticsHealthDashboard } from './EnhancedAnalyticsHealthDashboard';
import { UserActivityFeed } from './UserActivityFeed';
import { EnhancedFeedbackManagement } from './EnhancedFeedbackManagement';
import { MobileUsersTable } from './MobileUsersTable';
import { MobileConnectionRequests } from './MobileConnectionRequests';
import { useAdmin } from '@/hooks/use-admin';
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function MobileDashboardTabs() {
  const { 
    useStats, 
    useRecentActivities, 
    users, 
    useConnectionRequests, 
    useConnectionRequestsMutation,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail 
  } = useAdmin();
  const { data: stats, isLoading: isLoadingStats } = useStats();
  const { data: activities = [], isLoading: isLoadingActivities } = useRecentActivities();
  const { data: usersData = [], isLoading: isUsersLoading, refetch: refetchUsers } = users;
  const { data: requests = [], isLoading: isRequestsLoading } = useConnectionRequests();
  const { mutate: updateRequest, isPending: isUpdating } = useConnectionRequestsMutation();

  const renderSkeleton = () => (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((_, i) => (
        <Card key={i} className="p-3">
          <CardHeader className="p-0 pb-2">
            <CardDescription className="h-3 w-16 bg-muted rounded animate-pulse"></CardDescription>
            <CardTitle className="h-5 w-20 bg-muted rounded animate-pulse mt-1"></CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="h-3 w-24 bg-muted rounded animate-pulse"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderActivitySkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((_, i) => (
        <div key={i} className="border-l-4 border-muted pl-3 py-1">
          <div className="h-3 w-3/4 bg-muted rounded animate-pulse"></div>
          <div className="h-2 w-1/3 bg-muted rounded animate-pulse mt-1"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your marketplace</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-4 h-auto">
          <TabsTrigger value="overview" className="flex flex-col items-center gap-1 p-2 text-xs">
            <LayoutDashboard className="h-3 w-3" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex flex-col items-center gap-1 p-2 text-xs">
            <Users className="h-3 w-3" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex flex-col items-center gap-1 p-2 text-xs">
            <MessageSquare className="h-3 w-3" />
            <span>Requests</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex flex-col items-center gap-1 p-2 text-xs">
            <BarChart className="h-3 w-3" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="flex flex-col items-center gap-1 p-2 text-xs">
            <Shield className="h-3 w-3" />
            <span>Health</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex flex-col items-center gap-1 p-2 text-xs">
            <MessageSquare className="h-3 w-3" />
            <span>Feedback</span>
          </TabsTrigger>
        </TabsList>

        <div className="space-y-4">
          <TabsContent value="overview" className="mt-0 space-y-4">
            {/* Overview Stats */}
            {isLoadingStats ? (
              renderSkeleton()
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <CardHeader className="p-0 pb-2">
                    <CardDescription className="flex items-center text-xs">
                      <Store className="h-3 w-3 mr-1" /> Listings
                    </CardDescription>
                    <CardTitle className="text-lg">{stats?.totalListings || 0}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-xs text-muted-foreground">Active listings</p>
                  </CardContent>
                </Card>
                
                <Card className="p-3">
                  <CardHeader className="p-0 pb-2">
                    <CardDescription className="flex items-center text-xs">
                      <Users className="h-3 w-3 mr-1" /> Pending
                    </CardDescription>
                    <CardTitle className="text-lg">{stats?.pendingUsers || 0}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-xs text-muted-foreground">User approvals</p>
                  </CardContent>
                </Card>
                
                <Card className="p-3">
                  <CardHeader className="p-0 pb-2">
                    <CardDescription className="flex items-center text-xs">
                      <MessageSquare className="h-3 w-3 mr-1" /> Connections
                    </CardDescription>
                    <CardTitle className="text-lg">{stats?.pendingConnections || 0}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-xs text-muted-foreground">New requests</p>
                  </CardContent>
                </Card>
                
                <Card className="p-3">
                  <CardHeader className="p-0 pb-2">
                    <CardDescription className="flex items-center text-xs">
                      <Users className="h-3 w-3 mr-1" /> Total Users
                    </CardDescription>
                    <CardTitle className="text-lg">{stats?.totalUsers || 0}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-xs text-muted-foreground">Registered</p>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Recent Activity */}
            <Card className="p-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription className="text-sm">Latest marketplace actions</CardDescription>
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
                    {activities.slice(0, 4).map((activity) => (
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
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-0 space-y-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">User Management</h2>
              </div>
              <MobileUsersTable 
                users={usersData}
                onApprove={() => {}}
                onReject={() => {}}
                onMakeAdmin={() => {}}
                onRevokeAdmin={() => {}}
                onDelete={() => {}}
                isLoading={isUsersLoading}
              />
            </div>
          </TabsContent>

          <TabsContent value="requests" className="mt-0 space-y-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Connection Requests</h2>
              </div>
              <MobileConnectionRequests 
                requests={requests}
                onApprove={(request) => updateRequest({ requestId: request.id, status: 'approved' })}
                onReject={(request) => updateRequest({ requestId: request.id, status: 'rejected' })}
                isLoading={isUpdating}
              />
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-0 space-y-4">
            <MobileAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="health" className="mt-0 space-y-4">
            <EnhancedAnalyticsHealthDashboard />
          </TabsContent>

          <TabsContent value="feedback" className="mt-0 space-y-4">
            <EnhancedFeedbackManagement />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
