import { ErrorBoundary } from "@/components/ErrorBoundary";
import { adminErrorHandler } from "@/lib/error-handler";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Settings, LayoutGrid, Activity, TrendingUp, Users, ShoppingBag, Database, Workflow } from "lucide-react";
import { StreamlinedOverviewTab } from "@/components/admin/StreamlinedOverviewTab";
import { StreamlinedAnalyticsTab } from "@/components/admin/StreamlinedAnalyticsTab";
import { StreamlinedManagementTab } from "@/components/admin/StreamlinedManagementTab";
import { RecentActivityTab } from "@/components/admin/RecentActivityTab";
import { ListingIntelligenceTab } from "@/components/admin/ListingIntelligenceTab";
import { MarketIntelligenceTab } from "@/components/admin/MarketIntelligenceTab";
import { PredictiveIntelligenceTab } from "@/components/admin/PredictiveIntelligenceTab";
import { AutomatedIntelligenceTab } from "@/components/admin/AutomatedIntelligenceTab";
import { RevenueOptimizationTab } from "@/components/admin/RevenueOptimizationTab";
import { ProjectManagementTab } from "@/components/admin/ProjectManagementTab";
import { DataRecoveryTab } from "@/components/admin/data-recovery/DataRecoveryTab";
import { FormMonitoringTab } from "@/components/admin/form-monitoring/FormMonitoringTab";
import { AnalyticsTab } from "@/components/admin/analytics/AnalyticsTab";
import { useAdmin } from "@/hooks/use-admin";
import { useState } from "react";

const AdminDashboard = () => {
  const { users } = useAdmin();
  const { data: usersData = [] } = users;
  const [searchQuery, setSearchQuery] = useState("");
  
  const handleRefresh = () => {
    window.location.reload();
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
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-9 w-9"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
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
            <div className="px-6">
              <TabsList className="inline-flex h-9 items-center justify-start rounded-none border-b-0 bg-transparent p-0 gap-6">
                <TabsTrigger 
                  value="overview"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger 
                  value="activity"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Activity
                </TabsTrigger>
                <TabsTrigger 
                  value="listings"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Listings
                </TabsTrigger>
                <TabsTrigger 
                  value="management"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Users
                </TabsTrigger>
                <TabsTrigger 
                  value="data-recovery"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Data
                </TabsTrigger>
                <TabsTrigger 
                  value="form-monitoring"
                  className="relative rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Workflow className="h-4 w-4 mr-2" />
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
