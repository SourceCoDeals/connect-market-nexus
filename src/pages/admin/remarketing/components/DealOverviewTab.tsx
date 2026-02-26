import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithTimeout } from '@/lib/invoke-with-timeout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  DollarSign,
  ExternalLink,
  Flag,
  Globe,
  History,
  Loader2,
  Pencil,
  PhoneCall,
  Sparkles,
  Store,
} from 'lucide-react';
import { PipelineSummaryCard } from '@/components/remarketing';
import { DealTranscriptSection } from '@/components/remarketing/DealTranscriptSection';
import {
  GeneralNotesSection,
  OwnerResponseSection,
  ExecutiveSummaryCard,
  ServicesBusinessModelCard,
  GeographicCoverageCard,
  OwnerGoalsCard,
  PrimaryContactCard,
  CustomerTypesCard,
  CompanyOverviewCard,
  AdditionalInfoCard,
  KeyQuotesCard,
  UniverseAssignmentButton,
  BuyerHistoryDialog,
  EditFinancialsDialog,
} from '@/components/remarketing/deal-detail';
import type { DealTranscript } from '../types';

interface DealOverviewTabProps {
  dealId: string;
  deal: Record<string, any>;
  scoreStats?: {
    count: number;
    approved: number;
    passed: number;
    avgScore: number;
  } | null;
  pipelineStats?: {
    contacted: number;
    responded: number;
    meetingScheduled: number;
    loiSent: number;
    closedWon: number;
    closedLost: number;
  } | null;
  transcripts: any[];
  transcriptsLoading: boolean;
  allContactEmails: string[];
  effectiveWebsite: string | null;
}

export function DealOverviewTab({
  dealId,
  deal,
  scoreStats,
  pipelineStats,
  transcripts,
  transcriptsLoading,
  allContactEmails,
  effectiveWebsite,
}: DealOverviewTabProps) {
  const queryClient = useQueryClient();

  // Enrichment state
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [enrichmentStage, setEnrichmentStage] = useState('');
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  // Dialog state
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);
  const [buyerHistoryOpen, setBuyerHistoryOpen] = useState(false);
  const [editFinancialsOpen, setEditFinancialsOpen] = useState(false);

  // Mutation: update deal fields
  const updateDealMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase.from('listings').update(updates).eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
    },
  });

  // Mutation: toggle universe build flag
  const toggleUniverseFlagMutation = useMutation({
    mutationFn: async (flagged: boolean) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      const { error } = await supabase
        .from('listings')
        .update({
          universe_build_flagged: flagged,
          universe_build_flagged_at: flagged ? new Date().toISOString() : null,
          universe_build_flagged_by: flagged ? user?.id : null,
        })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: (_, flagged) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
      toast.success(flagged ? 'Flagged for universe build' : 'Universe build flag removed');
    },
    onError: () => toast.error('Failed to update flag'),
  });

  // Mutation: toggle "needs owner contact" flag
  const toggleContactOwnerMutation = useMutation({
    mutationFn: async (flagged: boolean) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      const { error } = await supabase
        .from('listings')
        .update({
          needs_owner_contact: flagged,
          needs_owner_contact_at: flagged ? new Date().toISOString() : null,
          needs_owner_contact_by: flagged ? user?.id : null,
        })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: (_, flagged) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      toast.success(
        flagged ? '⚠️ Flagged: Owner needs to be contacted' : 'Contact owner flag cleared',
      );
    },
    onError: () => toast.error('Failed to update flag'),
  });

  const handleEnrichFromWebsite = async () => {
    if (!deal) return;

    setIsEnriching(true);
    setEnrichmentProgress(10);
    setEnrichmentStage('Scraping website...');

    progressTimerRef.current = setInterval(() => {
      setEnrichmentProgress((prev) => {
        if (prev >= 85) {
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
          return 85;
        }
        if (prev < 30) {
          setEnrichmentStage('Scraping website...');
          return prev + 3;
        }
        if (prev < 55) {
          setEnrichmentStage('Extracting business intelligence...');
          return prev + 2;
        }
        if (prev < 75) {
          setEnrichmentStage('Processing company data...');
          return prev + 1.5;
        }
        setEnrichmentStage('Saving enriched data...');
        return prev + 1;
      });
    }, 500);

    try {
      const { queueDealEnrichment } = await import('@/lib/remarketing/queueEnrichment');
      await queueDealEnrichment([dealId]);

      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
      setEnrichmentProgress(100);
      setEnrichmentStage('Queued for background processing');
      setTimeout(() => {
        setIsEnriching(false);
        setEnrichmentProgress(0);
        setEnrichmentStage('');
      }, 1500);
    } catch (error: any) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
      toast.error(error.message || 'Failed to queue enrichment');
      setIsEnriching(false);
      setEnrichmentProgress(0);
      setEnrichmentStage('');
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return 'Not specified';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <>
      {/* Pipeline Summary Card - Shows conversion funnel */}
      {scoreStats && scoreStats.count > 0 && (
        <PipelineSummaryCard
          scored={scoreStats.count}
          approved={scoreStats.approved}
          contacted={(pipelineStats?.contacted || 0) + (pipelineStats?.responded || 0)}
          meetingScheduled={pipelineStats?.meetingScheduled || 0}
          closedWon={pipelineStats?.closedWon || 0}
        />
      )}

      {/* Website & Actions */}
      {(() => {
        const needsContact = deal?.needs_owner_contact;
        return (
          <Card
            className={
              needsContact ? 'border-red-400 border-2 bg-red-50 dark:bg-red-950/20' : ''
            }
          >
            {needsContact && (
              <div className="bg-red-500 text-white text-sm font-semibold px-4 py-2 flex items-center gap-2 rounded-t-lg">
                <PhoneCall className="h-4 w-4 animate-pulse" />
                ACTION REQUIRED: Owner needs to be contacted — we have a buyer ready!
              </div>
            )}
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle
                  className={`text-lg flex items-center gap-2 ${needsContact ? 'text-red-700' : ''}`}
                >
                  <Globe className="h-5 w-5" />
                  Website & Actions
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              {effectiveWebsite && (
                <p className="text-sm text-muted-foreground truncate">
                  {effectiveWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-3">
                {effectiveWebsite && (
                  <Button variant="outline" className="gap-2" asChild>
                    <a
                      href={
                        effectiveWebsite.startsWith('http')
                          ? effectiveWebsite
                          : `https://${effectiveWebsite}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Website
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleEnrichFromWebsite}
                  disabled={isEnriching || !effectiveWebsite}
                >
                  {isEnriching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Enrich from Website
                </Button>
                <UniverseAssignmentButton
                  dealId={dealId}
                  dealCategory={deal?.category}
                  scoreCount={scoreStats?.count || 0}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setBuyerHistoryOpen(true)}
                >
                  <History className="h-4 w-4" />
                  Buyer History
                </Button>
                {/* Contact Owner Flag Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={needsContact ? 'default' : 'outline'}
                        className={`gap-2 font-semibold ${
                          needsContact
                            ? 'bg-red-600 hover:bg-red-700 border-red-600 text-white shadow-md shadow-red-200'
                            : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500'
                        }`}
                        onClick={() => toggleContactOwnerMutation.mutate(!needsContact)}
                        disabled={toggleContactOwnerMutation.isPending}
                      >
                        {toggleContactOwnerMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PhoneCall
                            className={`h-4 w-4 ${needsContact ? 'animate-pulse' : ''}`}
                          />
                        )}
                        {needsContact ? '🚨 Needs Owner Contact' : 'Flag: Contact Owner'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {needsContact
                        ? 'This deal is flagged — team must contact the owner, we have a buyer ready! Click to clear.'
                        : 'Flag this deal to alert the team that the owner needs to be contacted (buyer is ready).'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Universe Build Flag Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={deal?.universe_build_flagged ? 'default' : 'outline'}
                        className={`gap-2 ${deal?.universe_build_flagged ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white' : 'border-amber-400 text-amber-600 hover:bg-amber-50'}`}
                        onClick={() =>
                          toggleUniverseFlagMutation.mutate(!deal?.universe_build_flagged)
                        }
                        disabled={toggleUniverseFlagMutation.isPending}
                      >
                        {toggleUniverseFlagMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Flag
                            className={`h-4 w-4 ${deal?.universe_build_flagged ? 'fill-white' : ''}`}
                          />
                        )}
                        {deal?.universe_build_flagged
                          ? 'Flagged: Build Universe'
                          : 'Flag for Universe Build'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {deal?.universe_build_flagged
                        ? 'This deal is flagged — a team member needs to build a buyer universe for it. Click to remove flag.'
                        : 'Flag this deal to indicate a buyer universe needs to be built by the team.'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Push to Marketplace Queue Button */}
                <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {deal?.pushed_to_marketplace ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 gap-1 py-1.5 px-3"
                          >
                            <Store className="h-3 w-3" />
                            In Marketplace Queue
                            {deal.pushed_to_marketplace_at && (
                              <span className="text-blue-500 ml-1">
                                {format(new Date(deal.pushed_to_marketplace_at), 'MMM d, yyyy')}
                              </span>
                            )}
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            className="gap-2 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-500"
                            onClick={async () => {
                              const {
                                data: { user: authUser },
                              } = await supabase.auth.getUser();
                              const { error } = await supabase
                                .from('listings')
                                .update({
                                  pushed_to_marketplace: true,
                                  pushed_to_marketplace_at: new Date().toISOString(),
                                  pushed_to_marketplace_by: authUser?.id || null,
                                })
                                .eq('id', dealId);
                              if (error) {
                                toast.error('Failed to push to marketplace queue');
                              } else {
                                toast.success('Deal pushed to Marketplace Queue');
                                queryClient.invalidateQueries({
                                  queryKey: ['remarketing', 'deal', dealId],
                                });
                                queryClient.invalidateQueries({
                                  queryKey: ['remarketing', 'deals'],
                                });
                                queryClient.invalidateQueries({
                                  queryKey: ['marketplace-queue'],
                                });
                              }
                            }}
                          >
                            <Store className="h-4 w-4" />
                            Push to Marketplace
                          </Button>
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        {deal?.pushed_to_marketplace
                          ? 'This deal is in the Marketplace Queue. It will be reviewed before going live.'
                          : 'Push this deal to the Marketplace Queue for review and publishing.'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
              </div>
              {isEnriching && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {enrichmentStage}
                    </span>
                    <span className="text-muted-foreground font-medium">
                      {Math.round(enrichmentProgress)}%
                    </span>
                  </div>
                  <Progress value={enrichmentProgress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Buyer History Dialog */}
      <BuyerHistoryDialog
        open={buyerHistoryOpen}
        onOpenChange={setBuyerHistoryOpen}
        dealId={dealId}
      />

      {/* Company Overview */}
      <CompanyOverviewCard
        companyName={deal.internal_company_name || deal.title}
        website={effectiveWebsite}
        location={deal.location}
        address={deal.address}
        foundedYear={deal.founded_year}
        employees={{
          fullTime: deal.full_time_employees,
          partTime: deal.part_time_employees,
        }}
        industry={deal.industry}
        numberOfLocations={deal.number_of_locations}
        locationRadiusRequirement={deal.location_radius_requirement}
        category={deal.category}
        status={deal.status}
        streetAddress={deal.street_address}
        addressCity={deal.address_city}
        addressState={deal.address_state}
        addressZip={deal.address_zip}
        addressCountry={deal.address_country}
        googleReviewCount={deal.google_review_count ?? undefined}
        googleRating={deal.google_rating ?? undefined}
        googleMapsUrl={deal.google_maps_url ?? undefined}
        linkedinUrl={deal.linkedin_url ?? undefined}
        linkedinEmployeeCount={deal.linkedin_employee_count ?? undefined}
        linkedinEmployeeRange={deal.linkedin_employee_range ?? undefined}
        dealQualityScore={deal.deal_total_score ?? undefined}
        onScoreChange={async (newScore) => {
          await updateDealMutation.mutateAsync({
            deal_total_score: newScore,
          });
        }}
        onSave={async (data) => {
          await updateDealMutation.mutateAsync({
            internal_company_name: data.companyName,
            website: data.website,
            address: data.address,
            founded_year: data.foundedYear,
            industry: data.industry,
            number_of_locations: data.numberOfLocations,
            location_radius_requirement: data.locationRadiusRequirement,
            street_address: data.streetAddress,
            address_city: data.addressCity,
            address_state: data.addressState,
            address_zip: data.addressZip,
            address_country: data.addressCountry,
          });
        }}
      />

      {/* Financial Overview */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Overview
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditFinancialsOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {/* Revenue */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  REVENUE
                </p>
              </div>
              <span className="text-2xl font-bold">{formatCurrency(deal.revenue)}</span>
              {(() => {
                const sources = deal.extraction_sources as Record<string, any> | null;
                const revSource = sources?.revenue;
                const sourceType = revSource?.source as string | undefined;
                const transcriptTitle = revSource?.transcriptTitle as string | undefined;
                const hasQuote = !!deal.revenue_source_quote;
                const isManual = sourceType === 'manual';
                const isTranscript = sourceType === 'transcript';
                const showPopover = hasQuote || isManual || isTranscript;

                return showPopover ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs text-primary p-0 h-auto mt-1 block"
                      >
                        {isManual ? 'Manually entered' : 'View source'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              isManual
                                ? 'bg-blue-50 text-blue-700 border-blue-200 text-xs'
                                : isTranscript
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 text-xs'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 text-xs'
                            }
                          >
                            {isManual
                              ? 'Manual'
                              : isTranscript
                                ? 'Transcript'
                                : sourceType || 'Unknown'}
                          </Badge>
                          {revSource?.timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(revSource.timestamp).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {isTranscript && transcriptTitle && (
                          <p className="text-xs text-muted-foreground">
                            From:{' '}
                            <span className="font-medium text-foreground">
                              {transcriptTitle}
                            </span>
                          </p>
                        )}
                        {hasQuote && (
                          <>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                              Source Quote
                            </p>
                            <p className="text-sm italic border-l-2 border-primary/30 pl-2">
                              "{deal.revenue_source_quote}"
                            </p>
                          </>
                        )}
                        {isManual && !hasQuote && (
                          <p className="text-xs text-muted-foreground">
                            Value was entered manually by a team member.
                          </p>
                        )}
                        {deal.revenue_is_inferred && (
                          <p className="text-xs text-amber-600">
                            Inferred from other financial data
                          </p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : null;
              })()}
            </div>

            {/* EBITDA */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  EBITDA
                </p>
              </div>
              <span className="text-2xl font-bold">{formatCurrency(deal.ebitda)}</span>
              {(() => {
                const sources = deal.extraction_sources as Record<string, any> | null;
                const ebitdaSource = sources?.ebitda;
                const sourceType = ebitdaSource?.source as string | undefined;
                const transcriptTitle = ebitdaSource?.transcriptTitle as string | undefined;
                const hasQuote = !!deal.ebitda_source_quote;
                const isManual = sourceType === 'manual';
                const isTranscript = sourceType === 'transcript';
                const showPopover = hasQuote || isManual || isTranscript;

                return showPopover ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs text-primary p-0 h-auto mt-1 block"
                      >
                        {isManual ? 'Manually entered' : 'View source'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              isManual
                                ? 'bg-blue-50 text-blue-700 border-blue-200 text-xs'
                                : isTranscript
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 text-xs'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 text-xs'
                            }
                          >
                            {isManual
                              ? 'Manual'
                              : isTranscript
                                ? 'Transcript'
                                : sourceType || 'Unknown'}
                          </Badge>
                          {ebitdaSource?.timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(ebitdaSource.timestamp).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {isTranscript && transcriptTitle && (
                          <p className="text-xs text-muted-foreground">
                            From:{' '}
                            <span className="font-medium text-foreground">
                              {transcriptTitle}
                            </span>
                          </p>
                        )}
                        {hasQuote && (
                          <>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                              Source Quote
                            </p>
                            <p className="text-sm italic border-l-2 border-primary/30 pl-2">
                              "{deal.ebitda_source_quote}"
                            </p>
                          </>
                        )}
                        {isManual && !hasQuote && (
                          <p className="text-xs text-muted-foreground">
                            Value was entered manually by a team member.
                          </p>
                        )}
                        {deal.ebitda_is_inferred && (
                          <p className="text-xs text-amber-600">
                            Inferred from other financial data
                          </p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : null;
              })()}
            </div>

            {/* EBITDA Margin */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                EBITDA MARGIN
              </p>
              {deal.revenue && deal.ebitda ? (
                <>
                  <span className="text-2xl font-bold">
                    {((deal.ebitda / deal.revenue) * 100).toFixed(0)}%
                  </span>
                  <Progress
                    value={Math.min((deal.ebitda / deal.revenue) * 100, 100)}
                    className="h-2 mt-2"
                  />
                </>
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">–</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <EditFinancialsDialog
        open={editFinancialsOpen}
        onOpenChange={setEditFinancialsOpen}
        data={{
          revenue: deal.revenue,
          ebitda: deal.ebitda,
        }}
        onSave={async (data) => {
          const { _manualEdit, ...financialData } = data;
          const updates: Record<string, any> = { ...financialData };

          if (_manualEdit) {
            const existingSources = (deal.extraction_sources as Record<string, any>) || {};
            const manualSource = { source: 'manual', timestamp: new Date().toISOString() };
            const sourceUpdates: Record<string, any> = { ...existingSources };
            if (data.revenue !== undefined) {
              sourceUpdates.revenue = manualSource;
              sourceUpdates.revenue_source_quote = manualSource;
            }
            if (data.ebitda !== undefined) {
              sourceUpdates.ebitda = manualSource;
              sourceUpdates.ebitda_source_quote = manualSource;
            }
            updates.extraction_sources = sourceUpdates;
            if (data.revenue !== undefined) updates.revenue_source_quote = null;
            if (data.ebitda !== undefined) updates.ebitda_source_quote = null;
          }

          await updateDealMutation.mutateAsync(updates);
          setEditFinancialsOpen(false);
        }}
        isSaving={updateDealMutation.isPending}
      />

      {/* Executive Summary */}
      <ExecutiveSummaryCard
        summary={deal.executive_summary}
        onSave={async (summary) => {
          await updateDealMutation.mutateAsync({ executive_summary: summary });
        }}
      />

      {/* Two Column Layout - Services & Geographic */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ServicesBusinessModelCard
          serviceMix={deal.service_mix}
          onSave={async (data) => {
            await updateDealMutation.mutateAsync({
              service_mix: data.serviceMix,
            });
          }}
        />

        <GeographicCoverageCard
          states={Array.isArray(deal.geographic_states) ? deal.geographic_states : null}
          onSave={async (states) => {
            await updateDealMutation.mutateAsync({ geographic_states: states });
          }}
        />
      </div>

      {/* Owner Goals */}
      <OwnerGoalsCard
        ownerGoals={deal.owner_goals}
        ownershipStructure={deal.ownership_structure}
        specialRequirements={deal.special_requirements}
        onSave={async (data) => {
          await updateDealMutation.mutateAsync({
            owner_goals: data.ownerGoals,
            special_requirements: data.specialRequirements,
          });
        }}
      />

      {/* Owner Response */}
      <OwnerResponseSection
        ownerResponse={deal.owner_response}
        onSave={async (response) => {
          await updateDealMutation.mutateAsync({ owner_response: response });
        }}
      />

      {/* Key Quotes from Seller */}
      <KeyQuotesCard
        quotes={Array.isArray(deal.key_quotes) ? deal.key_quotes : null}
        onSave={async (quotes) => {
          await updateDealMutation.mutateAsync({ key_quotes: quotes });
        }}
      />

      {/* Primary Contact */}
      <PrimaryContactCard
        name={deal.main_contact_name}
        email={deal.main_contact_email}
        phone={deal.main_contact_phone}
        onSave={async (data) => {
          await updateDealMutation.mutateAsync({
            main_contact_name: data.name,
            main_contact_email: data.email,
            main_contact_phone: data.phone,
          });
          queryClient.invalidateQueries({
            queryKey: ['remarketing', 'deal-transcripts', dealId],
          });
        }}
      />

      {/* End Market / Customers */}
      <CustomerTypesCard
        customerTypes={deal.customer_types}
        customerConcentration={
          deal.customer_concentration != null ? String(deal.customer_concentration) : undefined
        }
        customerGeography={deal.customer_geography ?? undefined}
        onSave={async (data) => {
          await updateDealMutation.mutateAsync({
            customer_types: data.customerTypes,
            customer_concentration: data.customerConcentration
              ? parseFloat(data.customerConcentration)
              : null,
            customer_geography: data.customerGeography,
          });
        }}
      />

      {/* Additional Information */}
      <AdditionalInfoCard
        otherNotes={deal.owner_notes}
        internalNotes={deal.internal_notes}
        keyRisks={deal.key_risks as string | null}
        technologySystems={deal.technology_systems as string | null}
        realEstateInfo={deal.real_estate_info as string | null}
        growthTrajectory={deal.growth_trajectory as string | null}
        onSave={async (data) => {
          await updateDealMutation.mutateAsync({
            owner_notes: data.otherNotes,
            internal_notes: data.internalNotes,
            key_risks: data.keyRisks,
            technology_systems: data.technologySystems,
            real_estate_info: data.realEstateInfo,
            growth_trajectory: data.growthTrajectory,
          });
        }}
      />

      {/* Description */}
      {deal.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{deal.description}</p>
          </CardContent>
        </Card>
      )}

      <DealTranscriptSection
        dealId={dealId}
        transcripts={(transcripts || []) as unknown as DealTranscript[]}
        isLoading={transcriptsLoading}
        dealInfo={{
          company_name: deal.internal_company_name || deal.title,
          main_contact_email: deal.main_contact_email ?? undefined,
        }}
        contactEmail={deal.main_contact_email ?? null}
        contactEmails={allContactEmails}
        contactName={deal.main_contact_name ?? null}
        companyName={deal.internal_company_name || deal.title || ''}
        onSyncComplete={() => {
          queryClient.invalidateQueries({
            queryKey: ['remarketing', 'deal-transcripts', dealId],
          });
        }}
        onTranscriptLinked={() => {
          queryClient.invalidateQueries({
            queryKey: ['remarketing', 'deal-transcripts', dealId],
          });
        }}
      />

      {/* General Notes Section */}
      <GeneralNotesSection
        notes={deal.general_notes}
        onSave={async (notes) => {
          await updateDealMutation.mutateAsync({ general_notes: notes });
        }}
        isAnalyzing={isAnalyzingNotes}
        onAnalyze={async (notes) => {
          setIsAnalyzingNotes(true);
          try {
            const { data, error } = await invokeWithTimeout<any>('analyze-deal-notes', {
              body: { dealId, notesText: notes },
              timeoutMs: 120_000,
            });

            if (error) throw error;

            if (data?.success) {
              toast.success(`Extracted ${data.fieldsUpdated?.length || 0} fields from notes`);
              queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
            } else {
              toast.error(data?.error || 'Failed to analyze notes');
            }
          } catch (error: any) {
            toast.error(error.message || 'Failed to analyze notes');
          } finally {
            setIsAnalyzingNotes(false);
          }
        }}
      />

      {/* Timestamps Footer */}
      <div className="flex justify-end gap-6 text-xs text-muted-foreground pt-4">
        <span className="flex items-center gap-1">
          Created: {format(new Date(deal.created_at), 'MMM d, yyyy')}
        </span>
        <span className="flex items-center gap-1">
          Updated: {format(new Date(deal.updated_at), 'MMM d, yyyy')}
        </span>
      </div>
    </>
  );
}
