import { ErrorBoundary } from "@/components/ErrorBoundary";
import { adminErrorHandler } from "@/lib/error-handler";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BarChart, Settings } from "lucide-react";
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

const AdminDashboard = () => {
  const { users } = useAdmin();
  const { data: usersData = [] } = users;
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        adminErrorHandler(error, 'dashboard loading');
      }}
    >
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Streamlined marketplace management</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-13 text-xs">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="predictive">AI Insights</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="management">Management</TabsTrigger>
            <TabsTrigger value="project">Project Mgmt</TabsTrigger>
            <TabsTrigger value="data-recovery">Data Recovery</TabsTrigger>
            <TabsTrigger value="form-monitoring">Form Monitoring</TabsTrigger>
            <TabsTrigger value="user-analytics">User Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <StreamlinedOverviewTab />
          </TabsContent>

          <TabsContent value="analytics">
            <StreamlinedAnalyticsTab />
          </TabsContent>

          <TabsContent value="activity">
            <RecentActivityTab />
          </TabsContent>

          <TabsContent value="listings">
            <ListingIntelligenceTab />
          </TabsContent>

          <TabsContent value="market">
            <MarketIntelligenceTab />
          </TabsContent>

          <TabsContent value="predictive">
            <PredictiveIntelligenceTab />
          </TabsContent>

          <TabsContent value="automation">
            <AutomatedIntelligenceTab />
          </TabsContent>

          <TabsContent value="revenue">
            <RevenueOptimizationTab />
          </TabsContent>

          <TabsContent value="management">
            <StreamlinedManagementTab />
          </TabsContent>

          <TabsContent value="project">
            <ProjectManagementTab />
          </TabsContent>

          <TabsContent value="data-recovery">
            <DataRecoveryTab users={usersData} />
          </TabsContent>

          <TabsContent value="form-monitoring">
            <FormMonitoringTab />
          </TabsContent>

          <TabsContent value="user-analytics">
            <AnalyticsTab users={usersData} />
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );

};

export default AdminDashboard;
