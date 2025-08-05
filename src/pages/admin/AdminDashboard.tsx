import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { adminErrorHandler } from "@/lib/error-handler";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Users, MessageSquare, TrendingUp, BarChart, Shield, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResponsiveManagementTab } from "@/components/admin/ResponsiveManagementTab";
import { AdvancedAnalyticsDashboard } from "@/components/admin/AdvancedAnalyticsDashboard";
import { EnhancedAnalyticsHealthDashboard } from "@/components/admin/EnhancedAnalyticsHealthDashboard";
import { DataQualityDashboard } from "@/components/admin/DataQualityDashboard";
import { UsersTable } from "@/components/admin/UsersTable";
import { MobileUsersTable } from "@/components/admin/MobileUsersTable";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { User } from "@/types";
import { ResponsiveOverviewCards } from "@/components/admin/ResponsiveOverviewCards";
import { ResponsiveRecentActivity } from "@/components/admin/ResponsiveRecentActivity";
import { MobileOptimizedAnalytics } from "@/components/admin/MobileOptimizedAnalytics";

const AdminDashboard = () => {
  const { useStats, useRecentActivities } = useAdmin();
  const { data: stats, isLoading: isLoadingStats } = useStats();
  const { data: activities = [], isLoading: isLoadingActivities } = useRecentActivities();
  const isMobile = useIsMobile();

  // Unified Responsive Layout
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        adminErrorHandler(error, 'dashboard loading');
      }}
    >
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Overview of your marketplace</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
          {/* Responsive tab structure: 4 tabs on mobile, 6 on desktop */}
          {isMobile ? (
            <TabsList className="grid w-full grid-cols-2 mb-4 h-16">
              <TabsTrigger value="overview" className="flex flex-col items-center gap-1 py-2">
                <Store className="h-4 w-4" />
                <span className="text-xs">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex flex-col items-center gap-1 py-2">
                <BarChart className="h-4 w-4" />
                <span className="text-xs">Analytics</span>
              </TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="grid w-full grid-cols-6 mb-6">
              <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="quality" className="text-xs md:text-sm">Data Quality</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs md:text-sm">Analytics</TabsTrigger>
              <TabsTrigger value="health" className="text-xs md:text-sm">Health</TabsTrigger>
              <TabsTrigger value="feedback" className="text-xs md:text-sm">Feedback</TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs md:text-sm">Deal Alerts</TabsTrigger>
            </TabsList>
          )}

          {/* Secondary mobile tabs */}
          {isMobile && (
            <TabsList className="grid w-full grid-cols-2 mb-4 h-12">
              <TabsTrigger value="users-health" className="flex flex-col items-center gap-1 py-1">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <Shield className="h-3 w-3" />
                </div>
                <span className="text-xs">Users & Health</span>
              </TabsTrigger>
              <TabsTrigger value="management" className="flex flex-col items-center gap-1 py-1">
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <Activity className="h-3 w-3" />
                </div>
                <span className="text-xs">Management</span>
              </TabsTrigger>
            </TabsList>
          )}

        <TabsContent value="overview" className="space-y-4 md:space-y-6 mt-6">
          {/* Responsive Overview Cards */}
          <ResponsiveOverviewCards stats={stats} isLoading={isLoadingStats} />
          
          {/* Responsive Recent Activity */}
          <ResponsiveRecentActivity 
            activities={activities} 
            isLoading={isLoadingActivities}
            onRefresh={() => {
              // Add refresh functionality if needed
            }}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 md:space-y-6">
          {isMobile ? (
            <MobileOptimizedAnalytics />
          ) : (
            <AdvancedAnalyticsDashboard />
          )}
        </TabsContent>

        {/* Mobile: Combined Users & Health Tab */}
        {isMobile && (
          <TabsContent value="users-health" className="space-y-4">
            <Tabs defaultValue="users" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 h-10">
                <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
                <TabsTrigger value="health" className="text-xs">Health</TabsTrigger>
                <TabsTrigger value="quality" className="text-xs">Quality</TabsTrigger>
              </TabsList>
              
              <TabsContent value="users" className="space-y-4">
                <ResponsiveUsersSection />
              </TabsContent>
              
              <TabsContent value="health" className="space-y-4">
                <EnhancedAnalyticsHealthDashboard />
              </TabsContent>
              
              <TabsContent value="quality" className="space-y-4">
                <DataQualityDashboard />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

        {/* Mobile: Combined Management Tab */}
        {isMobile && (
          <TabsContent value="management" className="space-y-4">
            <ResponsiveManagementTab />
          </TabsContent>
        )}

        {/* Desktop: Separate tabs for all sections */}
        {!isMobile && (
          <>
            <TabsContent value="quality" className="space-y-4 md:space-y-6">
              <DataQualityDashboard />
            </TabsContent>

            <TabsContent value="health">
              <EnhancedAnalyticsHealthDashboard />
            </TabsContent>

            <TabsContent value="feedback">
              <ResponsiveManagementTab />
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4 md:space-y-6">
              <ResponsiveManagementTab />
            </TabsContent>
          </>
        )}
      </Tabs>
      </div>
    </ErrorBoundary>
  );

  // Responsive Users Section Component
  function ResponsiveUsersSection() {
    const { useUsers, useUpdateUserStatus, useUpdateAdminStatus, useDeleteUser } = useAdminUsers();
    const { data: usersData = [], isLoading } = useUsers();
    
    const updateUserStatus = useUpdateUserStatus();
    const updateAdminStatus = useUpdateAdminStatus();
    const deleteUser = useDeleteUser();

    const handleApprove = (user: User) => {
      updateUserStatus.mutate({ userId: user.id, status: 'approved' });
    };

    const handleMakeAdmin = (user: User) => {
      updateAdminStatus.mutate({ userId: user.id, isAdmin: true });
    };

    const handleRevokeAdmin = (user: User) => {
      updateAdminStatus.mutate({ userId: user.id, isAdmin: false });
    };

    const handleDelete = (user: User) => {
      if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        deleteUser.mutate(user.id);
      }
    };

    const handleSendFeeAgreement = (user: User) => {
      // Implementation for fee agreement
      console.log('Send fee agreement to:', user.email);
    };

    const handleSendNDAEmail = (user: User) => {
      // Implementation for NDA email
      console.log('Send NDA email to:', user.email);
    };

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">User Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        
        {isMobile ? (
          <MobileUsersTable 
            users={usersData}
            isLoading={isLoading}
            onApprove={handleApprove}
            onMakeAdmin={handleMakeAdmin}
            onRevokeAdmin={handleRevokeAdmin}
            onDelete={handleDelete}
            onSendFeeAgreement={handleSendFeeAgreement}
            onSendNDAEmail={handleSendNDAEmail}
          />
        ) : (
          <UsersTable 
            users={usersData}
            isLoading={isLoading}
            onApprove={handleApprove}
            onMakeAdmin={handleMakeAdmin}
            onRevokeAdmin={handleRevokeAdmin}
            onDelete={handleDelete}
          />
        )}
      </div>
    );
  }

  function renderSkeleton() {
    return (
      <div className={cn(
        "grid gap-3 md:gap-4",
        isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"
      )}>
        {[1, 2, 3, 4].map((_, i) => (
          <Card key={i} className="p-3 md:p-4">
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
    )
  }

  function renderActivitySkeleton() {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((_, i) => (
          <div key={i} className="border-l-4 border-muted pl-3 py-1">
            <div className="h-3 w-3/4 bg-muted rounded animate-pulse"></div>
            <div className="h-2 w-1/3 bg-muted rounded animate-pulse mt-1"></div>
          </div>
        ))}
      </div>
    )
  }
};

export default AdminDashboard;
