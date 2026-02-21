/**
 * DataRoomTab: Main data room interface embedded in deal detail page
 *
 * Sub-tabs:
 * - Documents: Upload, organize, manage documents by category/folder
 * - Access: Buyer access matrix with 3 toggles per buyer
 * - Memos: AI lead memo generation, editing, publishing
 * - Distribution: Log of all memo sends across channels
 * - Audit Log: Complete activity trail
 */

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, Shield, BookOpen, Send, ClipboardList } from 'lucide-react';
import { DocumentsPanel } from './DocumentsPanel';
import { AccessMatrixPanel } from './AccessMatrixPanel';
import { MemosPanel } from './MemosPanel';
import { DistributionLogPanel } from './DistributionLogPanel';
import { AuditLogPanel } from './AuditLogPanel';

interface DataRoomTabProps {
  dealId: string;
  dealTitle?: string;
  isInternalDeal?: boolean;
}

export function DataRoomTab({ dealId, dealTitle, isInternalDeal }: DataRoomTabProps) {
  const [activeTab, setActiveTab] = useState('documents');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="documents" className="text-sm">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="access" className="text-sm">
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Access
          </TabsTrigger>
          <TabsTrigger value="memos" className="text-sm">
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Memos
          </TabsTrigger>
          <TabsTrigger value="distribution" className="text-sm">
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-sm">
            <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <DocumentsPanel dealId={dealId} />
        </TabsContent>

        <TabsContent value="access">
          <AccessMatrixPanel dealId={dealId} />
        </TabsContent>

        <TabsContent value="memos">
          <MemosPanel dealId={dealId} dealTitle={dealTitle} />
        </TabsContent>

        <TabsContent value="distribution">
          <DistributionLogPanel dealId={dealId} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogPanel dealId={dealId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
