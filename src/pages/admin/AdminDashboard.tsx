import { ErrorBoundary } from "@/components/ErrorBoundary";
import { adminErrorHandler } from "@/lib/error-handler";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Settings, Users, Database, Bell, HelpCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StripeOverviewTab } from "@/components/admin/StripeOverviewTab";
import { AnalyticsTabContainer } from "@/components/admin/analytics/AnalyticsTabContainer";
import { StreamlinedManagementTab } from "@/components/admin/StreamlinedManagementTab";
import { RecentActivityTab } from "@/components/admin/RecentActivityTab";
import { ListingIntelligenceTab } from "@/components/admin/ListingIntelligenceTab";
import { DataRecoveryTab } from "@/components/admin/data-recovery/DataRecoveryTab";
import { FormMonitoringTab } from "@/components/admin/form-monitoring/FormMonitoringTab";
import { useAdmin } from "@/hooks/use-admin";
import { useState } from "react";
import { usePermissions } from "@/hooks/permissions/usePermissions";
import { PermissionsModal } from "@/components/admin/permissions/PermissionsModal";
import { MyDealsTab } from "@/components/admin/dashboard/MyDealsTab";

const AdminDashboard = () => {
  const { users } = useAdmin();
  const { data: usersData = [] } = users;
  const [showNotifications, setShowNotifications] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const { canManagePermissions } = usePermissions();
  
  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExportData = () => {
    console.log("Exporting dashboard data...");
    // Add export functionality here
  };

  const handleManagePermissions = () => {
    setIsPermissionsModalOpen(true);
  };

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        adminErrorHandler(error, 'dashboard loading');
      }}
    >
      <div className="min-h-screen bg-background">
        {/* Stripe-inspired Header */}
        <div className="border-b border-border/50 bg-background sticky top-0 z-10">
          <div className="px-8 py-5">
            <div className="flex flex-col gap-5">
              {/* Title Row */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    Dashboard
                  </h1>
                  <p className="text-sm text-muted-foreground/70 mt-0.5">
                    Manage and monitor your marketplace
                  </p>
                </div>
                
                {/* Quick Actions - Minimal */}
                <div className="flex items-center gap-1.5">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleRefresh}
                    className="h-8 w-8 hover:bg-muted/50"
                    title="Refresh"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 hover:bg-muted/50"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      <div className="flex items-center justify-between px-4 py-2">
                        <h4 className="font-medium text-sm">Notifications</h4>
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                          Mark all read
                        </Button>
                      </div>
                      <DropdownMenuSeparator />
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No new notifications
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 hover:bg-muted/50"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {canManagePermissions && (
                        <>
                          <DropdownMenuItem onClick={handleManagePermissions}>
                            <Users className="mr-2 h-4 w-4" />
                            Manage Permissions
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem disabled>
                        <Database className="mr-2 h-4 w-4" />
                        Export Data
                        <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Help & Support
                        <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

            </div>
          </div>

          {/* Stripe-style Tabs */}
          <Tabs defaultValue="analytics" className="w-full">
            <div className="px-8">
              <TabsList className="inline-flex h-11 items-center justify-start rounded-none border-b-0 bg-transparent p-0 gap-6">
                <TabsTrigger 
                  value="analytics"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium text-muted-foreground/70 shadow-none transition-all hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Analytics
                </TabsTrigger>
                <TabsTrigger 
                  value="overview"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium text-muted-foreground/70 shadow-none transition-all hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="my-deals"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium text-muted-foreground/70 shadow-none transition-all hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  My Deals
                </TabsTrigger>
                <TabsTrigger 
                  value="listings"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium text-muted-foreground/70 shadow-none transition-all hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Listings
                </TabsTrigger>
                <TabsTrigger 
                  value="management"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium text-muted-foreground/70 shadow-none transition-all hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Users
                </TabsTrigger>
                <TabsTrigger 
                  value="activity"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium text-muted-foreground/70 shadow-none transition-all hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Activity
                </TabsTrigger>
                <TabsTrigger 
                  value="data-recovery"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium text-muted-foreground/70 shadow-none transition-all hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Data
                </TabsTrigger>
                <TabsTrigger 
                  value="form-monitoring"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium text-muted-foreground/70 shadow-none transition-all hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Forms
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Content Area - More spacious */}
            <div className="px-8 py-8">
              <TabsContent value="overview" className="mt-0 space-y-6">
                <StripeOverviewTab />
              </TabsContent>

              <TabsContent value="my-deals" className="mt-0">
                <MyDealsTab />
              </TabsContent>

              <TabsContent value="analytics" className="mt-0">
                <AnalyticsTabContainer />
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                <RecentActivityTab />
              </TabsContent>

              <TabsContent value="listings" className="mt-0">
                <ListingIntelligenceTab />
              </TabsContent>

              <TabsContent value="management" className="mt-0">
                <StreamlinedManagementTab />
              </TabsContent>

              <TabsContent value="data-recovery" className="mt-0">
                <DataRecoveryTab users={usersData} />
              </TabsContent>

              <TabsContent value="form-monitoring" className="mt-0">
                <FormMonitoringTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Permissions Modal */}
      <PermissionsModal 
        open={isPermissionsModalOpen} 
        onOpenChange={setIsPermissionsModalOpen}
      />
    </ErrorBoundary>
  );
};

export default AdminDashboard;
