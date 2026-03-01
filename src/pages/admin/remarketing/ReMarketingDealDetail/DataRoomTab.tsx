import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MemosTab } from "@/components/admin/data-room/MemosTab";
import { DocumentsPanel } from "@/components/admin/data-room/DocumentsPanel";
import { AccessMatrixPanel } from "@/components/admin/data-room/AccessMatrixPanel";
import { AuditLogPanel } from "@/components/admin/data-room/AuditLogPanel";
import { DistributionLogPanel } from "@/components/admin/data-room/DistributionLogPanel";
import {
  DealActivityLog,
  DealPipelinePanel,
  DealMarketplacePanel,
} from "@/components/remarketing/deal-detail";
import {
  BookOpen,
  ClipboardList,
  FolderOpen,
  Send,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

interface DataRoomTabProps {
  deal: Tables<'listings'>;
  dealId: string;
  scoreStats: { count: number; approved: number; passed: number; avgScore: number } | undefined;
}

export function DataRoomTab({ deal, dealId, scoreStats }: DataRoomTabProps) {
  return (
    <Tabs defaultValue="memos" className="space-y-4">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="memos" className="text-sm">
          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
          Memos
        </TabsTrigger>
        <TabsTrigger value="documents" className="text-sm">
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
          Documents
        </TabsTrigger>
        <TabsTrigger value="access" className="text-sm">
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Access
        </TabsTrigger>
        <TabsTrigger value="distribution" className="text-sm">
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Distribution
        </TabsTrigger>
        <TabsTrigger value="activity" className="text-sm">
          <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
          Activity
        </TabsTrigger>
      </TabsList>

      <TabsContent value="memos" className="space-y-6">
        <MemosTab
          dealId={dealId}
          dealTitle={deal.internal_company_name || deal.title}
          projectName={deal.project_name}
        />
      </TabsContent>

      <TabsContent value="documents" className="space-y-6">
        <DocumentsPanel dealId={dealId} />
      </TabsContent>

      <TabsContent value="access" className="space-y-6">
        <AccessMatrixPanel dealId={dealId} projectName={deal.project_name} />
      </TabsContent>

      <TabsContent value="distribution" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Buyer Match Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{scoreStats?.count || 0}</div>
                <div className="text-sm text-muted-foreground">Total Matches</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="text-2xl font-bold text-green-600">{scoreStats?.approved || 0}</div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div className="text-2xl font-bold text-red-600">{scoreStats?.passed || 0}</div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/10">
                <div className="text-2xl font-bold text-primary">
                  {scoreStats?.avgScore ? Math.round(scoreStats.avgScore) : '-'}
                </div>
                <div className="text-sm text-muted-foreground">Avg. Score</div>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Button asChild>
                <Link to={`/admin/remarketing/matching/${dealId}`}>
                  <Target className="h-4 w-4 mr-2" />
                  View All Matches
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <DealPipelinePanel listingId={dealId} />
          <DealMarketplacePanel
            listingId={dealId}
            isInternalDeal={deal.is_internal_deal}
            status={deal.status}
            title={deal.title}
          />
        </div>

        <DistributionLogPanel dealId={dealId} />

      </TabsContent>

      <TabsContent value="activity" className="space-y-6">
        <DealActivityLog dealId={dealId} maxHeight={800} />
        <AuditLogPanel dealId={dealId} />
      </TabsContent>
    </Tabs>
  );
}
