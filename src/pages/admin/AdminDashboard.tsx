import { ErrorBoundary } from "@/components/ErrorBoundary";
import { adminErrorHandler } from "@/lib/error-handler";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BarChart, Settings } from "lucide-react";
import { StreamlinedOverviewTab } from "@/components/admin/StreamlinedOverviewTab";
import { StreamlinedAnalyticsTab } from "@/components/admin/StreamlinedAnalyticsTab";
import { StreamlinedManagementTab } from "@/components/admin/StreamlinedManagementTab";

const AdminDashboard = () => {
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              Advanced Analytics
            </TabsTrigger>
            <TabsTrigger value="management" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <StreamlinedOverviewTab />
          </TabsContent>

          <TabsContent value="analytics">
            <StreamlinedAnalyticsTab />
          </TabsContent>

          <TabsContent value="management">
            <StreamlinedManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );

};

export default AdminDashboard;
