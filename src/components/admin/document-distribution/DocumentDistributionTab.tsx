/**
 * DocumentDistributionTab: Main document distribution interface on the deal page.
 *
 * Sub-tabs:
 * - Internal Documents: Full Detail Memo (INTERNAL ONLY)
 * - Marketing: Anonymous Teaser distribution
 * - Data Room: Post-NDA diligence files
 * - Activity: Permanent release log
 * - Approvals: Marketplace buyer approval queue
 */

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, Send, FolderOpen, ClipboardList, Shield } from 'lucide-react';
import { InternalDocumentsTab } from './InternalDocumentsTab';
import { MarketingDocumentsTab } from './MarketingDocumentsTab';
import { DataRoomFilesTab } from './DataRoomFilesTab';
import { DocumentActivityTab } from './DocumentActivityTab';
import { ApprovalQueuePanel } from './ApprovalQueuePanel';
import { usePendingApprovalCount } from '@/hooks/admin/use-document-distribution';

interface BuyerOption {
  id?: string;
  name: string;
  email: string;
  firm?: string;
  nda_status?: string;
  fee_agreement_status?: string;
}

interface DocumentDistributionTabProps {
  dealId: string;
  dealTitle?: string;
  projectName?: string | null;
  buyers?: BuyerOption[];
}

export function DocumentDistributionTab({
  dealId,
  dealTitle,
  projectName,
  buyers = [],
}: DocumentDistributionTabProps) {
  const [activeTab, setActiveTab] = useState('marketing');
  const { data: pendingCount = 0 } = usePendingApprovalCount(dealId);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="internal" className="text-sm">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Internal
          </TabsTrigger>
          <TabsTrigger value="marketing" className="text-sm">
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Marketing
          </TabsTrigger>
          <TabsTrigger value="dataroom" className="text-sm">
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Data Room
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-sm">
            <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="approvals" className="text-sm relative">
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Approvals
            {pendingCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="internal">
          <InternalDocumentsTab dealId={dealId} />
        </TabsContent>

        <TabsContent value="marketing">
          <MarketingDocumentsTab
            dealId={dealId}
            projectName={projectName}
            buyers={buyers}
          />
        </TabsContent>

        <TabsContent value="dataroom">
          <DataRoomFilesTab
            dealId={dealId}
            projectName={projectName}
            buyers={buyers}
          />
        </TabsContent>

        <TabsContent value="activity">
          <DocumentActivityTab dealId={dealId} />
        </TabsContent>

        <TabsContent value="approvals">
          <ApprovalQueuePanel dealId={dealId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
