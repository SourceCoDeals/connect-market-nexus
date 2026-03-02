import { DatafastAnalyticsDashboard } from "@/components/admin/analytics/datafast/DatafastAnalyticsDashboard";

export default function WebsiteAnalytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Website Analytics</h1>
        <p className="text-sm text-muted-foreground">Visitor traffic, sources, geography, and conversion data</p>
      </div>
      <DatafastAnalyticsDashboard />
    </div>
  );
}
