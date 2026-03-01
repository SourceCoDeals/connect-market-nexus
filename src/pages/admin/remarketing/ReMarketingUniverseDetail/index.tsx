/**
 * ReMarketingUniverseDetail — refactored shell component.
 *
 * Delegates data fetching to useUniverseData, actions to useUniverseActions,
 * and the universe Buyers/Deals sub-tabs to UniverseTab.  Everything else
 * (header, configuration tab, new-universe tabs, modals, AI chat) is rendered
 * directly here.  This file replaces the old monolithic
 * ReMarketingUniverseDetail.tsx sitting one directory up.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  DocumentUploadSection,
  MAGuideEditor,
  UniverseTemplates,
  AddDealToUniverseDialog,
  DealCSVImport,
  BuyerCSVImport,
  BuyerFitCriteriaDialog,
  AIResearchSection,
  ScoringStyleCard,
  BuyerFitCriteriaAccordion,
  StructuredCriteriaPanel,
  EnrichmentSummaryDialog,
} from '@/components/remarketing';
import { PushToDialerModal } from '@/components/remarketing/PushToDialerModal';
import { PushToSmartleadModal } from '@/components/remarketing/PushToSmartleadModal';
import { AddBuyerToUniverseDialog } from '@/components/remarketing/AddBuyerToUniverseDialog';
import {
  ArrowLeft,
  Save,
  Target,
  Users,
  FileText,
  Settings,
  Plus,
  Sparkles,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';
import { useAIUIActionHandler } from '@/hooks/useAIUIActionHandler';

import { useUniverseData } from './useUniverseData';
import { useUniverseActions } from './useUniverseActions';
import { UniverseTab } from './UniverseTab';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ReMarketingUniverseDetail = () => {
  const data = useUniverseData();
  const actions = useUniverseActions(data);

  const {
    id,
    isNew,
    navigate: _navigate,
    queryClient,

    // Form state
    formData, setFormData,
    sizeCriteria, setSizeCriteria,
    geographyCriteria, setGeographyCriteria,
    serviceCriteria, setServiceCriteria,
    buyerTypesCriteria, setBuyerTypesCriteria,
    scoringBehavior, setScoringBehavior,
    documents, setDocuments,
    maGuideContent, setMaGuideContent,
    targetBuyerTypes, setTargetBuyerTypes,

    // Dialog/UI state
    addDealDialogOpen, setAddDealDialogOpen,
    addDealDefaultTab, setAddDealDefaultTab,
    importDealsDialogOpen, setImportDealsDialogOpen,
    showCriteriaEdit, setShowCriteriaEdit,
    documentsOpen, setDocumentsOpen,
    isParsing,
    importBuyersDialogOpen, setImportBuyersDialogOpen,
    addBuyerDialogOpen, setAddBuyerDialogOpen,
    showBuyerEnrichDialog, setShowBuyerEnrichDialog,
    selectedBuyerIds, setSelectedBuyerIds,
    editingHeader, setEditingHeader,

    // Query data
    universe: _universe, isLoading,
    buyers,
    universeDeals, refetchDeals,

    // Enrichment hooks
    queueProgress,
    enrichmentSummary, showEnrichmentSummary, dismissEnrichmentSummary,
    queueBuyers, resetQueueEnrichment,

    // Mutation
    saveMutation,

    // Derived
    totalWeight,
  } = data;

  const {
    handleApplyTemplate,
    parseCriteria,
    handleRemoveBuyersFromUniverse,
    handleEnrichSingleBuyer,
    handleDeleteBuyer,
    handleToggleFeeAgreement,
    handleRemoveSelectedBuyers,
    handleBuyerEnrichment,
  } = actions;

  // --- State that is only needed in the shell (not in hooks) ---------------

  const [dialerOpen, setDialerOpen] = useState(false);
  const [smartleadOpen, setSmartleadOpen] = useState(false);

  // --- AI Command Center context -------------------------------------------

  const { setPageContext } = useAICommandCenterContext();

  useEffect(() => {
    if (id && !isNew) {
      setPageContext({ page: 'universe_detail', entity_id: id, entity_type: 'universe' });
    }
  }, [id, isNew, setPageContext]);

  // --- Wire AI UI actions to this page's buyer table -----------------------

  useAIUIActionHandler({
    table: 'buyers',
    onSelectRows: (rowIds, mode) => {
      if (mode === 'replace') {
        setSelectedBuyerIds(rowIds);
      } else if (mode === 'add') {
        setSelectedBuyerIds((prev) => [...new Set([...prev, ...rowIds])]);
      } else {
        // toggle
        setSelectedBuyerIds((prev) => {
          const prevSet = new Set(prev);
          rowIds.forEach((rid) => (prevSet.has(rid) ? prevSet.delete(rid) : prevSet.add(rid)));
          return [...prevSet];
        });
      }
    },
    onClearSelection: () => setSelectedBuyerIds([]),
    onSortColumn: (field) => {
      // Sort not yet implemented for universe buyer table
    },
    onTriggerAction: (action) => {
      if (action === 'push_to_dialer') setDialerOpen(true);
      if (action === 'push_to_smartlead') setSmartleadOpen(true);
      if (action === 'remove_from_universe') handleRemoveSelectedBuyers();
    },
  });

  // --- Loading state -------------------------------------------------------

  if (!isNew && isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // --- Render --------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* ================================================================ */}
      {/* Header                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/buyers/universes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            {!isNew && editingHeader ? (
              <div className="space-y-2">
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="text-2xl font-bold h-10 px-2"
                  placeholder="Universe name"
                  autoFocus
                />
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="text-sm resize-none"
                  placeholder="Add a description for this universe..."
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      saveMutation.mutate();
                      setEditingHeader(false);
                    }}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingHeader(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={
                  !isNew
                    ? 'cursor-pointer group rounded-md px-2 py-1 -mx-2 -my-1 hover:bg-muted/50 transition-colors'
                    : ''
                }
                onClick={() => !isNew && setEditingHeader(true)}
              >
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">
                    {isNew ? 'New Universe' : formData.name || 'Universe'}
                  </h1>
                  {!isNew && (
                    <span className="text-muted-foreground text-sm">
                      · {buyers?.length || 0} buyers · {universeDeals?.length || 0} deals
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {isNew
                    ? 'Create a new buyer universe'
                    : formData.description || 'Click to add a description...'}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant="outline"
              onClick={() => {
                setAddDealDefaultTab('new');
                setAddDealDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              List New Deal
            </Button>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!formData.name || saveMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* New Universe: Templates                                          */}
      {/* ================================================================ */}
      {isNew && <UniverseTemplates onApplyTemplate={handleApplyTemplate} />}

      {/* ================================================================ */}
      {/* Main Tabs: Universe (default) vs Configuration — existing only   */}
      {/* ================================================================ */}
      {!isNew && (
        <Tabs defaultValue="universe" className="space-y-4">
          <TabsList>
            <TabsTrigger value="universe">
              <Users className="mr-2 h-4 w-4" />
              Universe
            </TabsTrigger>
            <TabsTrigger value="configuration">
              <Settings className="mr-2 h-4 w-4" />
              Configuration & Research
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Universe — Buyers & Deals (delegated) */}
          <TabsContent value="universe" className="space-y-4">
            <UniverseTab
              data={data}
              handlers={{
                handleRemoveBuyersFromUniverse,
                handleEnrichSingleBuyer,
                handleDeleteBuyer,
                handleToggleFeeAgreement,
                handleRemoveSelectedBuyers,
              }}
            />

            {/* Dialer / Smartlead modals live at this level so state stays here */}
            <PushToDialerModal
              open={dialerOpen}
              onOpenChange={setDialerOpen}
              contactIds={selectedBuyerIds}
              contactCount={selectedBuyerIds.length}
              entityType="buyers"
            />
            <PushToSmartleadModal
              open={smartleadOpen}
              onOpenChange={setSmartleadOpen}
              contactIds={selectedBuyerIds}
              contactCount={selectedBuyerIds.length}
              entityType="buyers"
            />
          </TabsContent>

          {/* TAB 2: Configuration & Research */}
          <TabsContent value="configuration" className="space-y-6">
            {/* AI Research & M&A Guide - Primary section */}
            {id && (
              <AIResearchSection
                universeName={formData.name}
                existingContent={maGuideContent}
                universeId={id}
                onDocumentAdded={(doc) => {
                  setDocuments((prev) => {
                    const filtered = prev.filter((d) => !d.type || d.type !== 'ma_guide');
                    return [...filtered, doc];
                  });
                }}
                onGuideGenerated={(guide, extractedCriteria, buyerProfiles) => {
                  setMaGuideContent(guide);
                  if (extractedCriteria) {
                    if (extractedCriteria.size_criteria)
                      setSizeCriteria((prev) => ({ ...prev, ...extractedCriteria.size_criteria }));
                    if (extractedCriteria.geography_criteria)
                      setGeographyCriteria((prev) => ({
                        ...prev,
                        ...extractedCriteria.geography_criteria,
                      }));
                    if (extractedCriteria.service_criteria)
                      setServiceCriteria((prev) => ({
                        ...prev,
                        ...extractedCriteria.service_criteria,
                      }));
                    if (extractedCriteria.buyer_types_criteria)
                      setBuyerTypesCriteria((prev) => ({
                        ...prev,
                        ...extractedCriteria.buyer_types_criteria,
                      }));
                  }
                  if (buyerProfiles && buyerProfiles.length > 0) {
                    setTargetBuyerTypes(buyerProfiles);
                  }
                  toast.success('M&A Guide generated and criteria extracted');
                }}
              />
            )}

            {/* Industry & Scoring Style */}
            <ScoringStyleCard
              scoringBehavior={scoringBehavior}
              onScoringBehaviorChange={setScoringBehavior}
              onSave={() => saveMutation.mutate()}
              isSaving={saveMutation.isPending}
            />

            {/* Buyer Fit Criteria - Full Detail with Target Buyer Types */}
            <BuyerFitCriteriaAccordion
              sizeCriteria={sizeCriteria}
              geographyCriteria={geographyCriteria}
              serviceCriteria={serviceCriteria}
              targetBuyerTypes={targetBuyerTypes}
              onTargetBuyerTypesChange={setTargetBuyerTypes}
              onEditCriteria={() => setShowCriteriaEdit(true)}
              defaultOpen={false}
              universeId={id}
              universeName={formData.name}
              maGuideContent={maGuideContent}
              maGuideDocument={documents.find((d) => d.type === 'ma_guide')}
              onCriteriaExtracted={() => {
                queryClient.invalidateQueries({ queryKey: ['remarketing', 'universe', id] });
              }}
            />

            {/* Supporting Documents */}
            {id && (
              <Collapsible open={documentsOpen} onOpenChange={setDocumentsOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-sm font-medium">
                            Supporting Documents
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {documents.length} files
                          </Badge>
                        </div>
                        {documentsOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <DocumentUploadSection
                        universeId={id}
                        documents={documents}
                        onDocumentsChange={setDocuments}
                        industryName={formData.name}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ================================================================ */}
      {/* New Universe: Details / Criteria / Weights / Guide tabs          */}
      {/* ================================================================ */}
      {isNew && (
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">
              <Target className="mr-2 h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="criteria">
              <FileText className="mr-2 h-4 w-4" />
              Criteria
            </TabsTrigger>
            <TabsTrigger value="weights">
              <Settings className="mr-2 h-4 w-4" />
              Scoring
            </TabsTrigger>
            <TabsTrigger value="guide">
              <BookOpen className="mr-2 h-4 w-4" />
              MA Guide
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Universe Details</CardTitle>
                <CardDescription>Basic information about this buyer universe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Home Services PE Firms"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe this buyer universe..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Criteria Tab */}
          <TabsContent value="criteria">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fit Criteria</CardTitle>
                  <CardDescription>
                    Define the criteria for matching buyers to listings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="fit_criteria">Natural Language Criteria</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={parseCriteria}
                        disabled={isParsing || !formData.fit_criteria.trim()}
                      >
                        {isParsing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Parsing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            AI Parse
                          </>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      id="fit_criteria"
                      placeholder="Describe your ideal buyer fit criteria in natural language..."
                      value={formData.fit_criteria}
                      onChange={(e) => setFormData({ ...formData, fit_criteria: e.target.value })}
                      rows={6}
                    />
                  </div>
                </CardContent>
              </Card>

              <StructuredCriteriaPanel
                sizeCriteria={sizeCriteria}
                geographyCriteria={geographyCriteria}
                serviceCriteria={serviceCriteria}
                buyerTypesCriteria={buyerTypesCriteria}
                scoringBehavior={scoringBehavior}
                onSizeCriteriaChange={setSizeCriteria}
                onGeographyCriteriaChange={setGeographyCriteria}
                onServiceCriteriaChange={setServiceCriteria}
                onBuyerTypesCriteriaChange={setBuyerTypesCriteria}
                onScoringBehaviorChange={setScoringBehavior}
              />
            </div>
          </TabsContent>

          {/* Weights Tab */}
          <TabsContent value="weights">
            <Card>
              <CardHeader>
                <CardTitle>Scoring Weights</CardTitle>
                <CardDescription>
                  Adjust how much each category contributes to the overall score
                  <Badge variant={totalWeight === 100 ? 'default' : 'destructive'} className="ml-2">
                    Total: {totalWeight}%
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Geography ({formData.geography_weight}%)</Label>
                  <Slider
                    value={[formData.geography_weight]}
                    onValueChange={([value]) =>
                      setFormData({ ...formData, geography_weight: value })
                    }
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Size Fit ({formData.size_weight}%)</Label>
                  <Slider
                    value={[formData.size_weight]}
                    onValueChange={([value]) => setFormData({ ...formData, size_weight: value })}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Service Mix ({formData.service_weight}%)</Label>
                  <Slider
                    value={[formData.service_weight]}
                    onValueChange={([value]) => setFormData({ ...formData, service_weight: value })}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Owner Goals ({formData.owner_goals_weight}%)</Label>
                  <Slider
                    value={[formData.owner_goals_weight]}
                    onValueChange={([value]) =>
                      setFormData({ ...formData, owner_goals_weight: value })
                    }
                    max={100}
                    step={5}
                  />
                </div>

                {totalWeight !== 100 && (
                  <div className="p-4 bg-destructive/10 rounded-lg text-destructive text-sm">
                    Weights should total 100%. Currently at {totalWeight}%.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MA Guide Tab */}
          <TabsContent value="guide">
            <MAGuideEditor
              content={maGuideContent}
              onChange={setMaGuideContent}
              universeName={formData.name}
              fitCriteria={formData.fit_criteria}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* ================================================================ */}
      {/* Dialogs & Modals                                                 */}
      {/* ================================================================ */}

      {/* Buyer Fit Criteria Edit Dialog */}
      <BuyerFitCriteriaDialog
        open={showCriteriaEdit}
        onOpenChange={setShowCriteriaEdit}
        sizeCriteria={sizeCriteria}
        geographyCriteria={geographyCriteria}
        serviceCriteria={serviceCriteria}
        targetBuyerTypes={targetBuyerTypes}
        onSizeCriteriaChange={setSizeCriteria}
        onGeographyCriteriaChange={setGeographyCriteria}
        onServiceCriteriaChange={setServiceCriteria}
        onTargetBuyerTypesChange={setTargetBuyerTypes}
        universeName={formData.name}
      />

      {/* Add Deal Dialog */}
      {!isNew && id && (
        <AddDealToUniverseDialog
          open={addDealDialogOpen}
          onOpenChange={setAddDealDialogOpen}
          universeId={id}
          defaultTab={addDealDefaultTab}
          existingDealIds={universeDeals?.map((d: any) => d.listing?.id).filter(Boolean) || []}
          onDealAdded={() => {
            refetchDeals();
            setAddDealDialogOpen(false);
          }}
        />
      )}

      {/* Import Buyers Dialog */}
      {!isNew && id && (
        <BuyerCSVImport
          universeId={id}
          open={importBuyersDialogOpen}
          onOpenChange={setImportBuyersDialogOpen}
          hideTrigger
          onComplete={async () => {
            queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', 'universe', id] });
            setImportBuyersDialogOpen(false);

            // Auto-score new buyers against all deals in universe
            if (id) {
              const { data: deals, error: dealsError } = await supabase
                .from('remarketing_universe_deals')
                .select('listing_id')
                .eq('universe_id', id);
              if (dealsError) throw dealsError;
              if (deals && deals.length > 0) {
                const { queueDealScoring } = await import('@/lib/remarketing/queueScoring');
                await queueDealScoring({
                  universeId: id!,
                  listingIds: deals.map((d) => d.listing_id),
                });
              }
            }
          }}
        />
      )}

      {/* Add Buyer Dialog */}
      {!isNew && id && (
        <AddBuyerToUniverseDialog
          open={addBuyerDialogOpen}
          onOpenChange={setAddBuyerDialogOpen}
          universeId={id}
          onBuyerAdded={() => {
            queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', 'universe', id] });
          }}
        />
      )}

      {/* Import Deals Dialog */}
      {!isNew && id && importDealsDialogOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Import Deals from CSV</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setImportDealsDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DealCSVImport
                universeId={id}
                onImportComplete={() => {
                  refetchDeals();
                  setImportDealsDialogOpen(false);
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}


      {/* Buyer Enrichment Selection Dialog */}
      <Dialog open={showBuyerEnrichDialog} onOpenChange={setShowBuyerEnrichDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Enrich Buyers
            </DialogTitle>
            <DialogDescription>
              Enrichment scrapes websites and extracts company data, investment criteria, and M&A
              intelligence.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="default"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => handleBuyerEnrichment('all')}
              disabled={queueProgress.isRunning}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-medium">Enrich All</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Re-enrich all{' '}
                  {buyers?.filter(
                    (b) => b.company_website || b.platform_website || b.pe_firm_website,
                  ).length || 0}{' '}
                  buyers (resets existing data)
                </span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => handleBuyerEnrichment('unenriched')}
              disabled={queueProgress.isRunning}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="font-medium">Only Unenriched</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Only enrich{' '}
                  {buyers?.filter(
                    (b) => b.company_website || b.platform_website || b.pe_firm_website,
                  ).length || 0}{' '}
                  buyers that haven't been enriched yet
                </span>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowBuyerEnrichDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrichment Summary Dialog */}
      <EnrichmentSummaryDialog
        open={showEnrichmentSummary}
        onOpenChange={dismissEnrichmentSummary}
        summary={enrichmentSummary}
        onRetryFailed={async () => {
          dismissEnrichmentSummary();
          if (!buyers?.length || !enrichmentSummary?.errors.length) return;

          const failedBuyerIds = new Set(enrichmentSummary.errors.map((e) => e.buyerId));
          const failedBuyers = buyers.filter((b) => failedBuyerIds.has(b.id));

          if (failedBuyers.length > 0) {
            resetQueueEnrichment();
            await queueBuyers(
              failedBuyers.map((b) => ({
                id: b.id,
                company_website: b.company_website,
                platform_website: b.platform_website,
                pe_firm_website: b.pe_firm_website,
              })),
            );
          }
        }}
      />
    </div>
  );
};

export default ReMarketingUniverseDetail;
