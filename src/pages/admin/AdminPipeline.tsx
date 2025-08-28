import { DealsPipelineView } from "@/components/admin/DealsPipelineView";

const AdminPipeline = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Deals Pipeline</h1>
        <p className="text-muted-foreground">Manage all deal inquiries and connection requests</p>
      </div>
      
      <DealsPipelineView />
    </div>
  );
};

export default AdminPipeline;