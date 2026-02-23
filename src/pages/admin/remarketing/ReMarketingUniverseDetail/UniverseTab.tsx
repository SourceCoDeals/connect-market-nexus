import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BuyerTableEnhanced,
  UniverseDealsTable,
  BuyerTableToolbar,
  EnrichmentProgressIndicator,
} from "@/components/remarketing";
import {
  Users,
  Plus,
  Sparkles,
  Loader2,
  Unlink,
  Briefcase,
  TrendingUp,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { UseUniverseDataReturn } from "./useUniverseData";

interface UniverseTabProps {
  data: UseUniverseDataReturn;
  handlers: {
    handleRemoveBuyersFromUniverse: (buyerIds: string[]) => Promise<void>;
    handleEnrichSingleBuyer: (buyerId: string) => Promise<void>;
    handleDeleteBuyer: (buyerId: string) => Promise<void>;
    handleToggleFeeAgreement: (buyerId: string, currentStatus: boolean) => Promise<void>;
    handleRemoveSelectedBuyers: () => Promise<void>;
  };
}

export function UniverseTab({ data, handlers }: UniverseTabProps) {
  const {
    id,
    queryClient,
    buyers,
    filteredBuyers,
    buyerIdsWithTranscripts,
    universeDeals,
    dealEngagementStats,
    buyerSearch, setBuyerSearch,
    setAddBuyerDialogOpen,
    setImportBuyersDialogOpen,
    setShowBuyerEnrichDialog,
    setAddDealDialogOpen,
    setAddDealDefaultTab,
    setImportDealsDialogOpen,
    isScoringAllDeals, setIsScoringAllDeals,
    selectedBuyerIds, setSelectedBuyerIds,
    isRemovingSelected,
    queueProgress,
    cancelQueueEnrichment,
    resetQueueEnrichment,
    resetAlignmentScoring,
    scoreAlignmentBuyers,
    cancelAlignmentScoring,
    isScoringAlignment,
    alignmentProgress,
    refetchBuyers,
    refetchDeals,
    dealQueueProgress,
    cancelDealQueueEnrichment,
    pauseDealEnrichment,
    resumeDealEnrichment,
    dealEnrichmentProgress,
    enrichDeals,
    cancelDealEnrichment,
    resetDealEnrichment,
  } = data;

  const {
    handleRemoveBuyersFromUniverse,
    handleEnrichSingleBuyer,
    handleDeleteBuyer,
    handleToggleFeeAgreement,
    handleRemoveSelectedBuyers,
  } = handlers;

  return (
    <Tabs defaultValue="buyers" className="space-y-4">
      <TabsList>
        <TabsTrigger value="buyers">
          <Users className="mr-2 h-4 w-4" />
          Buyers ({buyers?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="deals">
          <Briefcase className="mr-2 h-4 w-4" />
          Deals ({universeDeals?.length || 0})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="buyers">
        <Card>
          <CardHeader className="pb-4">
            <BuyerTableToolbar
              buyerCount={filteredBuyers.length}
              searchValue={buyerSearch}
              onSearchChange={setBuyerSearch}
              onAddBuyer={() => setAddBuyerDialogOpen(true)}
              onImportCSV={() => setImportBuyersDialogOpen(true)}
              onEnrichAll={() => setShowBuyerEnrichDialog(true)}
              onCancelEnrichment={cancelQueueEnrichment}
              onResetQueue={async () => {
                await resetQueueEnrichment();
                toast.success('Enrichment queue reset');
              }}
              onScoreAlignment={async () => {
                if (!buyers?.length) {
                  toast.error('No buyers to score');
                  return;
                }

                // Reset any previous alignment state
                resetAlignmentScoring();

                // Score buyers and refresh when done
                await scoreAlignmentBuyers(
                  buyers.map(b => ({
                    id: b.id,
                    company_name: b.company_name,
                    alignment_score: b.alignment_score ?? null
                  })),
                  () => refetchBuyers()
                );
              }}
              onCancelAlignment={cancelAlignmentScoring}
              isEnriching={queueProgress.isRunning}
              isScoringAlignment={isScoringAlignment}
              enrichmentProgress={{
                current: queueProgress.completed + queueProgress.failed,
                total: queueProgress.total,
                successful: queueProgress.completed,
                failed: queueProgress.failed,
                creditsDepleted: false,
                rateLimited: queueProgress.rateLimited > 0,
                resetTime: queueProgress.rateLimitResetAt
              }}
              alignmentProgress={{
                current: alignmentProgress.current,
                total: alignmentProgress.total,
                successful: alignmentProgress.successful,
                failed: alignmentProgress.failed,
                creditsDepleted: alignmentProgress.creditsDepleted
              }}
               selectedCount={selectedBuyerIds.length}
               onRemoveSelected={handleRemoveSelectedBuyers}
               isRemovingSelected={isRemovingSelected}
            />
          </CardHeader>
          <CardContent className="p-0">
            <BuyerTableEnhanced
              buyers={filteredBuyers as unknown as { id: string; company_name: string; [key: string]: unknown }[]}
              showPEColumn={true}
              buyerIdsWithTranscripts={buyerIdsWithTranscripts}
              selectable={true}
              onRemoveFromUniverse={handleRemoveBuyersFromUniverse}
              onEnrich={handleEnrichSingleBuyer}
              onDelete={handleDeleteBuyer}
              onToggleFeeAgreement={handleToggleFeeAgreement}
              onSelectionChange={setSelectedBuyerIds}
              universeId={id}
            />
          </CardContent>
        </Card>

        {/* Always-visible bulk action button (requested) */}
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            variant="outline"
            onClick={handleRemoveSelectedBuyers}
            disabled={selectedBuyerIds.length === 0 || isRemovingSelected}
            className="bg-background/95 backdrop-blur border shadow-sm text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            {isRemovingSelected ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Unlink className="h-4 w-4 mr-2" />
            )}
            Remove Selected{selectedBuyerIds.length ? ` (${selectedBuyerIds.length})` : ""}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="deals">
        {/* Deal Enrichment Progress Bar — uses queue-based tracking for real-time updates */}
        {(dealQueueProgress.isEnriching || dealQueueProgress.isPaused) && (
          <div className="mb-4">
            <EnrichmentProgressIndicator
              completedCount={dealQueueProgress.completedCount}
              totalCount={dealQueueProgress.totalCount}
              progress={dealQueueProgress.progress}
              estimatedTimeRemaining={dealQueueProgress.estimatedTimeRemaining}
              processingRate={dealQueueProgress.processingRate}
              itemLabel="deals"
              successfulCount={dealQueueProgress.successfulCount}
              failedCount={dealQueueProgress.failedCount}
              isPaused={dealQueueProgress.isPaused}
              onPause={pauseDealEnrichment}
              onResume={resumeDealEnrichment}
              onCancel={cancelDealQueueEnrichment}
            />
          </div>
        )}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {universeDeals?.length || 0} deals
                </span>
                {(() => {
                  const unenrichedCount = universeDeals?.filter((d: any) => !d.listing?.enriched_at).length || 0;
                  return unenrichedCount > 0 ? (
                    <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                      {unenrichedCount} unenriched
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
                      All enriched
                    </Badge>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!universeDeals?.length) {
                      toast.error('No deals to score');
                      return;
                    }
                    setIsScoringAllDeals(true);
                    try {
                      const listingIds = universeDeals.filter((d: any) => d.listing?.id).map((d: any) => d.listing.id);
                      const { queueDealScoring } = await import("@/lib/remarketing/queueScoring");
                      await queueDealScoring({ universeId: id!, listingIds });
                      toast.success(`Queued ${listingIds.length} deals for scoring`);
                      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-engagement', id] });
                    } catch (error) {
                      toast.error('Failed to score deals');
                    } finally {
                      setIsScoringAllDeals(false);
                    }
                  }}
                  disabled={isScoringAllDeals || !universeDeals?.length}
                >
                  {isScoringAllDeals ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  )}
                  Score All Deals
                </Button>
                {(dealQueueProgress.isEnriching || dealQueueProgress.isPaused) ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={cancelDealQueueEnrichment}
                  >
                    Cancel Enrichment
                  </Button>
                ) : dealEnrichmentProgress.isRunning ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={cancelDealEnrichment}
                  >
                    Cancel Enrichment
                  </Button>
                ) : (
                  (() => {
                    const unenrichedDeals = universeDeals?.filter((d: any) => d.listing?.id && !d.listing.enriched_at) || [];
                    return unenrichedDeals.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          resetDealEnrichment();

                          const dealsToEnrich = unenrichedDeals.map((d: any) => ({
                            id: d.id,
                            listingId: d.listing.id,
                            enrichedAt: d.listing.enriched_at
                          }));

                          await enrichDeals(dealsToEnrich);
                          refetchDeals();
                        }}
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        Enrich {unenrichedDeals.length} Unenriched
                      </Button>
                    ) : null;
                  })()
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportDealsDialogOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Import Deals
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setAddDealDefaultTab('existing');
                    setAddDealDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Deal
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <UniverseDealsTable
              deals={(universeDeals || []) as unknown as { id: string; added_at: string; status: string; listing: { id: string; title: string; [key: string]: unknown }; }[]}
              engagementStats={dealEngagementStats || {}}
              universeId={id}
              onRemoveDeal={async (dealId, _listingId) => {
                try {
                  await supabase
                    .from('remarketing_universe_deals')
                    .update({ status: 'archived' })
                    .eq('id', dealId);
                  toast.success('Deal removed from universe');
                  refetchDeals();
                } catch (error) {
                  toast.error('Failed to remove deal');
                }
              }}
              onScoreDeal={async (listingId) => {
                try {
                  const { queueDealScoring } = await import("@/lib/remarketing/queueScoring");
                  await queueDealScoring({ universeId: id!, listingIds: [listingId] });
                  queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-engagement', id] });
                } catch (error) {
                  toast.error('Failed to score deal');
                }
              }}
              onEnrichDeal={async (listingId) => {
                try {
                  const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
                  await queueDealEnrichment([listingId]);
                  refetchDeals();
                } catch (error) {
                  toast.error('Failed to queue enrichment');
                }
              }}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
