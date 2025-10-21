import { ErrorBoundary } from "@/components/ErrorBoundary";
import { adminErrorHandler } from "@/lib/error-handler";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Settings, LayoutGrid, Activity, TrendingUp, Users, ShoppingBag, Database, Workflow, Bell, HelpCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StreamlinedOverviewTab } from "@/components/admin/StreamlinedOverviewTab";
import { StreamlinedAnalyticsTab } from "@/components/admin/StreamlinedAnalyticsTab";
import { StreamlinedManagementTab } from "@/components/admin/StreamlinedManagementTab";
import { RecentActivityTab } from "@/components/admin/RecentActivityTab";
import { ListingIntelligenceTab } from "@/components/admin/ListingIntelligenceTab";
import { DataRecoveryTab } from "@/components/admin/data-recovery/DataRecoveryTab";
import { FormMonitoringTab } from "@/components/admin/form-monitoring/FormMonitoringTab";
import { useAdmin } from "@/hooks/use-admin";
import { useState } from "react";

const AdminDashboard = () => {
  const { users } = useAdmin();
  const { data: usersData = [] } = users;
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  
  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExportData = () => {
    console.log("Exporting dashboard data...");
    // Add export functionality here
  };

  const handleManagePermissions = () => {
    console.log("Managing permissions...");
    // Add permissions management here
  };

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        adminErrorHandler(error, 'dashboard loading');
      }}
    >
      <div className="min-h-screen bg-background">
        {/* Header Section */}
        <div className="border-b bg-card/50 backdrop-blur-sm">
          <div className="px-6 py-6">
            {/* Title and Utility Bar */}
            <div className="flex flex-col gap-6">
              {/* Title */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Admin Dashboard
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage and monitor your marketplace
                  </p>
                </div>
                
                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleRefresh}
                    className="h-9 w-9"
                    title="Refresh dashboard"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9"
                      >
                        <Bell className="h-4 w-4" />
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
                        className="h-9 w-9"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={handleManagePermissions}>
                        <Users className="mr-2 h-4 w-4" />
                        Manage Permissions
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportData}>
                        <Database className="mr-2 h-4 w-4" />
                        Export Data
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Help & Support
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Search Bar */}
              <div className="max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search dashboard..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 bg-background border-border/50 focus-visible:ring-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <div className="px-6 border-b">
              <TabsList className="inline-flex h-10 items-center justify-start rounded-none border-b-0 bg-transparent p-0 gap-8">
                <TabsTrigger 
                  value="overview"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3.5 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3.5 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger 
                  value="listings"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3.5 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                  Listings
                </TabsTrigger>
                <TabsTrigger 
                  value="management"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3.5 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Users
                </TabsTrigger>
                
                {/* Separator */}
                <div className="h-5 w-px bg-border/50 self-center" />
                
                <TabsTrigger 
                  value="activity"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3.5 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Activity className="h-3.5 w-3.5 mr-1.5" />
                  Activity
                </TabsTrigger>
                <TabsTrigger 
                  value="data-recovery"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3.5 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Database className="h-3.5 w-3.5 mr-1.5" />
                  Data
                </TabsTrigger>
                <TabsTrigger 
                  value="form-monitoring"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3.5 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Workflow className="h-3.5 w-3.5 mr-1.5" />
                  Forms
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Content Area */}
            <div className="px-6 py-6">
              <TabsContent value="overview" className="mt-0">
                <StreamlinedOverviewTab />
              </TabsContent>

              <TabsContent value="analytics" className="mt-0">
                <StreamlinedAnalyticsTab />
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
    </ErrorBoundary>
  );
};

export default AdminDashboard;
