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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="management">Management</TabsTrigger>
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

          <TabsContent value="management">
            <StreamlinedManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );

};

export default AdminDashboard;
