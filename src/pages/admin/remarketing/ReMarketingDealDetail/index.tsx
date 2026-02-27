// ACTIVE — this is the component rendered at /admin/remarketing/deals/:dealId
// and /admin/remarketing/leads/captarget/:dealId and /admin/remarketing/leads/gp-partners/:dealId
// The monolithic sibling file ReMarketingDealDetail.tsx (1,675 lines) is ORPHANED.
// AUDIT REF: CTO Audit February 2026

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Eye, FolderOpen, Phone } from "lucide-react";
import { useDealDetail } from "./useDealDetail";
import { CapTargetInfoCard } from "./CapTargetInfoCard";
import { SalesforceInfoCard } from "./SalesforceInfoCard";
import { DealHeader } from "./DealHeader";
import { OverviewTab } from "./OverviewTab";
import { DataRoomTab } from "./DataRoomTab";
import { DealCallActivityTab } from "./DealCallActivityTab";

const ReMarketingDealDetail = () => {
  const {
    dealId, navigate, backTo, queryClient,
    deal, dealLoading, scoreStats, pipelineStats, transcripts, transcriptsLoading,
    updateDealMutation, toggleUniverseFlagMutation, toggleContactOwnerMutation, updateNameMutation,
    isEnriching, enrichmentProgress, enrichmentStage, isAnalyzingNotes,
    buyerHistoryOpen, setBuyerHistoryOpen, editFinancialsOpen, setEditFinancialsOpen,
    isEditingName, setIsEditingName, editedName, setEditedName,
    handleEnrichFromWebsite, handleSaveName, handleCancelEdit, handleAnalyzeNotes,
    effectiveWebsite, dataCompleteness, tier, displayName, listedName,
  } = useDealDetail();

  if (dealLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg">Deal not found</h3>
            <p className="text-muted-foreground">The deal you're looking for doesn't exist.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/deals')}>
              Back to Active Deals
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      <CapTargetInfoCard deal={deal} dealId={dealId!} />
      <SalesforceInfoCard deal={deal} />

      <DealHeader
        deal={deal}
        backTo={backTo}
        navigate={navigate}
        displayName={displayName}
        listedName={listedName}
        dataCompleteness={dataCompleteness}
        tier={tier}
        isEditingName={isEditingName}
        setIsEditingName={setIsEditingName}
        editedName={editedName}
        setEditedName={setEditedName}
        handleSaveName={handleSaveName}
        handleCancelEdit={handleCancelEdit}
        updateNameMutation={updateNameMutation}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="text-sm">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="call-activity" className="text-sm">
            <Phone className="mr-1.5 h-3.5 w-3.5" />
            Call Activity
          </TabsTrigger>
          <TabsTrigger value="data-room" className="text-sm">
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Data Room
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            deal={deal}
            dealId={dealId!}
            scoreStats={scoreStats}
            pipelineStats={pipelineStats}
            transcripts={transcripts}
            transcriptsLoading={transcriptsLoading}
            effectiveWebsite={effectiveWebsite}
            isEnriching={isEnriching}
            enrichmentProgress={enrichmentProgress}
            enrichmentStage={enrichmentStage}
            isAnalyzingNotes={isAnalyzingNotes}
            buyerHistoryOpen={buyerHistoryOpen}
            setBuyerHistoryOpen={setBuyerHistoryOpen}
            editFinancialsOpen={editFinancialsOpen}
            setEditFinancialsOpen={setEditFinancialsOpen}
            handleEnrichFromWebsite={handleEnrichFromWebsite}
            handleAnalyzeNotes={handleAnalyzeNotes}
            updateDealMutation={updateDealMutation}
            toggleContactOwnerMutation={toggleContactOwnerMutation}
            toggleUniverseFlagMutation={toggleUniverseFlagMutation}
            queryClient={queryClient}
          />
        </TabsContent>

        <TabsContent value="call-activity" className="space-y-6">
          <DealCallActivityTab listingId={dealId!} />
        </TabsContent>

        <TabsContent value="data-room" className="space-y-6">
          <DataRoomTab
            deal={deal}
            dealId={dealId!}
            scoreStats={scoreStats}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReMarketingDealDetail;
