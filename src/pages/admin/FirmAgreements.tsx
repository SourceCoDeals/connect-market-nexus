import { Building2 } from 'lucide-react';
import { FirmAgreementsTable } from '@/components/admin/firm-agreements/FirmAgreementsTable';
import { FirmSyncTestingPanel } from '@/components/admin/firm-agreements/FirmSyncTestingPanel';
import { FirmAgreementHelp } from '@/components/admin/firm-agreements/FirmAgreementHelp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FirmAgreements() {
  return (
    <div className="container mx-auto py-8 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Firm Agreement Tracking</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage NDA and Fee Agreement signatures across all firms. Changes sync to all firm members automatically.
          </p>
        </div>
        <FirmAgreementHelp />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="firms" className="w-full">
        <TabsList>
          <TabsTrigger value="firms">All Firms</TabsTrigger>
          <TabsTrigger value="testing">System Testing</TabsTrigger>
        </TabsList>
        
        <TabsContent value="firms" className="mt-6">
          <FirmAgreementsTable />
        </TabsContent>
        
        <TabsContent value="testing" className="mt-6">
          <FirmSyncTestingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
