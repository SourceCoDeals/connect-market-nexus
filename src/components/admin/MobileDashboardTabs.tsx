
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Shield, Activity, MessageSquare, LayoutDashboard, Users, Store, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdvancedAnalyticsDashboard } from './AdvancedAnalyticsDashboard';
import { EnhancedAnalyticsHealthDashboard } from './EnhancedAnalyticsHealthDashboard';
import { UserActivityFeed } from './UserActivityFeed';
import { EnhancedFeedbackManagement } from './EnhancedFeedbackManagement';
import { MobileUsersTable } from './MobileUsersTable';
import { MobileConnectionRequests } from './MobileConnectionRequests';
import { useAdmin } from '@/hooks/use-admin';
import { useAdminUsers } from '@/hooks/admin/use-admin-users';
import { useAdminRequests } from '@/hooks/admin/use-admin-requests';
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function MobileDashboardTabs() {
  const { 
    useStats, 
    useRecentActivities, 
  } = useAdmin();
  
  const { 
    useUsers,
    useUpdateUserStatus,
    useUpdateAdminStatus,
    useDeleteUser
  } = useAdminUsers();
  
  const {
    useConnectionRequests,
    useConnectionRequestsMutation
  } = useAdminRequests();
  
  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useStats();
  const { data: activities = [], isLoading: isLoadingActivities, refetch: refetchActivities } = useRecentActivities();
  const { data: usersData = [], isLoading: isUsersLoading } = useUsers();
  const { data: requests = [], isLoading: isRequestsLoading } = useConnectionRequests();
  
  const updateUserStatus = useUpdateUserStatus();
  const updateAdminStatus = useUpdateAdminStatus();
  const deleteUser = useDeleteUser();
  const updateRequest = useConnectionRequestsMutation();

  const handleRefresh = () => {
    refetchStats();
    refetchActivities();
  };

  const handleApproveUser = (user: any) => {
    updateUserStatus.mutate({ userId: user.id, status: 'approved' });
  };

  const handleRejectUser = (user: any) => {
    updateUserStatus.mutate({ userId: user.id, status: 'rejected' });
  };

  const handleMakeAdmin = (user: any) => {
    updateAdminStatus.mutate({ userId: user.id, isAdmin: true });
  };

  const handleRevokeAdmin = (user: any) => {
    updateAdminStatus.mutate({ userId: user.id, isAdmin: false });
  };

  const handleDeleteUser = (user: any) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteUser.mutate(user.id);
    }
  };

  const handleApproveRequest = (request: any) => {
    updateRequest.mutate({ requestId: request.id, status: 'approved' });
  };

  const handleRejectRequest = (request: any) => {
    updateRequest.mutate({ requestId: request.id, status: 'rejected' });
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((_, i) => (
        <Card key={i} className="p-4 animate-pulse">
          <div className="h-4 bg-muted rounded mb-2"></div>
          <div className="h-6 bg-muted rounded mb-1"></div>
          <div className="h-3 bg-muted rounded w-2/3"></div>
        </Card>
      ))}
    </div>
  );

  const renderActivitySkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-muted rounded mb-1"></div>
          <div className="h-3 bg-muted rounded w-1/3"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your marketplace</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoadingStats}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingStats && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <Tabs defaultValue="overview" className="w-full">
          {/* Main navigation tabs */}
          <TabsList className="grid w-full grid-cols-2 h-16 mb-6 bg-card">
            <TabsTrigger value="overview" className="flex flex-col items-center gap-1 py-2 px-1">
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-xs font-medium">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex flex-col items-center gap-1 py-2 px-1">
              <BarChart className="h-4 w-4" />
              <span className="text-xs font-medium">Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* Secondary tabs for additional features */}
          <div className="mb-4">
            <TabsList className="grid w-full grid-cols-2 h-14 bg-muted/50">
              <TabsTrigger value="health" className="flex flex-col items-center gap-1 py-1 px-1">
                <Shield className="h-3 w-3" />
                <span className="text-xs">Health</span>
              </TabsTrigger>
              <TabsTrigger value="feedback" className="flex flex-col items-center gap-1 py-1 px-1">
                <Activity className="h-3 w-3" />
                <span className="text-xs">Feedback</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="space-y-6">
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Overview Stats - Enhanced mobile layout */}
              {isLoadingStats ? (
                renderSkeleton()
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between mb-2">
                        <Store className="h-5 w-5 text-blue-600" />
                        <Badge variant="secondary" className="text-xs">Active</Badge>
                      </div>
                      <div className="text-2xl font-bold text-blue-900">{stats?.totalListings || 0}</div>
                      <p className="text-sm text-blue-700">Listings</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between mb-2">
                        <Users className="h-5 w-5 text-orange-600" />
                        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700">Pending</Badge>
                      </div>
                      <div className="text-2xl font-bold text-orange-900">{stats?.pendingUsers || 0}</div>
                      <p className="text-sm text-orange-700">User Approvals</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between mb-2">
                        <MessageSquare className="h-5 w-5 text-purple-600" />
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">New</Badge>
                      </div>
                      <div className="text-2xl font-bold text-purple-900">{stats?.pendingConnections || 0}</div>
                      <p className="text-sm text-purple-700">Connections</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between mb-2">
                        <Users className="h-5 w-5 text-green-600" />
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-700">Total</Badge>
                      </div>
                      <div className="text-2xl font-bold text-green-900">{stats?.totalUsers || 0}</div>
                      <p className="text-sm text-green-700">Users</p>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {/* Recent Activity - Enhanced mobile layout */}
              <Card className="p-4">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                    <Badge variant="outline" className="text-xs">{activities.length} items</Badge>
                  </div>
                  <CardDescription className="text-sm">Latest marketplace actions</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingActivities ? (
                    renderActivitySkeleton()
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No recent activity to display</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.slice(0, 5).map((activity) => (
                        <div
                          key={activity.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border-l-4",
                            activity.type === "signup"
                              ? "border-l-green-500 bg-green-50/50"
                              : activity.type === "connection_request"
                              ? "border-l-blue-500 bg-blue-50/50"
                              : activity.type === "listing_creation"
                              ? "border-l-purple-500 bg-purple-50/50"
                              : "border-l-gray-500 bg-gray-50/50"
                          )}
                        >
                          <div className={cn(
                            "rounded-full p-1.5 mt-0.5",
                            activity.type === "signup"
                              ? "bg-green-500"
                              : activity.type === "connection_request"
                              ? "bg-blue-500"
                              : activity.type === "listing_creation"
                              ? "bg-purple-500"
                              : "bg-gray-500"
                          )}>
                            <div className="h-2 w-2 bg-white rounded-full" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium leading-relaxed">{activity.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="analytics" className="mt-0 space-y-4">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-10 mb-4 bg-muted/50">
                  <TabsTrigger value="overview" className="text-xs py-1 px-2">
                    <div className="flex items-center gap-1">
                      <BarChart className="h-3 w-3" />
                      <span>Overview</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="live" className="text-xs py-1 px-2">
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      <span>Live</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="users" className="text-xs py-1 px-2">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>Users</span>
                    </div>
                  </TabsTrigger>
                </TabsList>

                {/* Second row of analytics tabs */}
                <TabsList className="grid w-full grid-cols-3 h-10 mb-4 bg-muted/50">
                  <TabsTrigger value="listings" className="text-xs py-1 px-2">
                    <div className="flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      <span>Listings</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="search" className="text-xs py-1 px-2">
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3">🔍</div>
                      <span>Search</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="funnel" className="text-xs py-1 px-2">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>Funnel</span>
                    </div>
                  </TabsTrigger>
                </TabsList>

                <div className="space-y-4">
                  <TabsContent value="overview" className="mt-0">
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="text-lg">Analytics Overview</CardTitle>
                        <CardDescription className="text-sm">Key marketplace metrics and insights</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                            <div className="text-lg font-bold text-blue-900">{stats?.totalListings || 0}</div>
                            <p className="text-xs text-blue-700">Total Listings</p>
                          </Card>
                          <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
                            <div className="text-lg font-bold text-green-900">{stats?.totalUsers || 0}</div>
                            <p className="text-xs text-green-700">Active Users</p>
                          </Card>
                          <Card className="p-3 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
                            <div className="text-lg font-bold text-purple-900">{stats?.pendingConnections || 0}</div>
                            <p className="text-xs text-purple-700">Connections</p>
                          </Card>
                          <Card className="p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
                            <div className="text-lg font-bold text-orange-900">175</div>
                            <p className="text-xs text-orange-700">Page Views</p>
                          </Card>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="live" className="mt-0">
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="text-lg">Live Activity</CardTitle>
                        <CardDescription className="text-sm">Real-time user activity and engagement</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <UserActivityFeed />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="users" className="mt-0">
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="text-lg">User Analytics</CardTitle>
                        <CardDescription className="text-sm">User behavior and engagement metrics</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <Card className="p-3 bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-200">
                            <div className="text-lg font-bold text-indigo-900">{stats?.totalUsers || 0}</div>
                            <p className="text-xs text-indigo-700">Total Users</p>
                          </Card>
                          <Card className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
                            <div className="text-lg font-bold text-emerald-900">{usersData.filter(u => u.approval_status === 'approved').length}</div>
                            <p className="text-xs text-emerald-700">Active Users</p>
                          </Card>
                        </div>
                        <div className="text-center py-6 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Detailed user analytics</p>
                          <p className="text-xs">User engagement and behavior patterns</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="listings" className="mt-0">
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="text-lg">Listing Analytics</CardTitle>
                        <CardDescription className="text-sm">Marketplace listing performance</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <Card className="p-3 bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200">
                            <div className="text-lg font-bold text-cyan-900">{stats?.totalListings || 0}</div>
                            <p className="text-xs text-cyan-700">Total Listings</p>
                          </Card>
                          <Card className="p-3 bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200">
                            <div className="text-lg font-bold text-rose-900">29%</div>
                            <p className="text-xs text-rose-700">Available</p>
                          </Card>
                        </div>
                        <div className="text-center py-6 text-muted-foreground">
                          <Store className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Listing performance analytics</p>
                          <p className="text-xs">Views, engagement, and conversion rates</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="search" className="mt-0">
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="text-lg">Search Analytics</CardTitle>
                        <CardDescription className="text-sm">Search behavior and performance</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="text-center py-8 text-muted-foreground">
                          <div className="text-4xl mb-4">🔍</div>
                          <p className="text-sm font-medium mb-2">Search analytics will appear here</p>
                          <p className="text-xs mb-4">Data is collected from search functionality</p>
                          
                          <div className="bg-muted/30 rounded-lg p-4 mt-4">
                            <h4 className="font-semibold text-sm mb-2 text-foreground">Search System Status</h4>
                            <div className="flex items-center justify-center gap-2">
                              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-green-700">Live</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="funnel" className="mt-0">
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="text-lg">Conversion Funnel</CardTitle>
                        <CardDescription className="text-sm">User journey and conversion analysis</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="space-y-4">
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Page Views</span>
                              <span className="text-lg font-bold text-blue-900">175</span>
                            </div>
                            <div className="w-full bg-blue-200/50 rounded-full h-2 mt-2">
                              <div className="bg-blue-500 h-2 rounded-full w-full"></div>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Listing Views</span>
                              <span className="text-lg font-bold text-green-900">{stats?.totalListings || 0}</span>
                            </div>
                            <div className="w-full bg-green-200/50 rounded-full h-2 mt-2">
                              <div className="bg-green-500 h-2 rounded-full w-4/5"></div>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Connections</span>
                              <span className="text-lg font-bold text-purple-900">{stats?.pendingConnections || 0}</span>
                            </div>
                            <div className="w-full bg-purple-200/50 rounded-full h-2 mt-2">
                              <div className="bg-purple-500 h-2 rounded-full w-1/4"></div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
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
    </div>
  );
}
