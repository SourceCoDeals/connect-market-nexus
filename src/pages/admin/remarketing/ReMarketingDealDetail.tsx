import { useState } from "react";

import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Building2,
  Check,
  DollarSign,
  ExternalLink,
  Globe,
  MapPin,
  Sparkles,
  Target,
  Users,
  History,
  Loader2,
  CheckCircle2,
  Pencil,
  AlertTriangle,
  Eye,
  X,
  Flag,
  PhoneCall,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { ScoreTierBadge, getTierFromScore, PipelineSummaryCard, DealBuyerChat, DealSourceBadge } from "@/components/remarketing";
import { DealTranscriptSection } from "@/components/remarketing/DealTranscriptSection";
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
  DealActivityLog,
} from "@/components/remarketing/deal-detail";

const ReMarketingDealDetail = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as any)?.from || null;
  const queryClient = useQueryClient();
  
  const [isEnriching, setIsEnriching] = useState(false);
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);
  const [buyerHistoryOpen, setBuyerHistoryOpen] = useState(false);
  const [editFinancialsOpen, setEditFinancialsOpen] = useState(false);

  // Fetch deal/listing data
  const { data: deal, isLoading: dealLoading } = useQuery({
    queryKey: ['remarketing', 'deal', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', dealId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!dealId
  });


  // Fetch score stats for this deal
  const { data: scoreStats } = useQuery({
    queryKey: ['remarketing', 'deal-scores', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('composite_score, status, tier')
        .eq('listing_id', dealId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return { count: 0, approved: 0, passed: 0, avgScore: 0 };
      }

      const approved = data.filter(s => s.status === 'approved').length;
      const passed = data.filter(s => s.status === 'passed').length;
      const avgScore = data.reduce((sum, s) => sum + (s.composite_score || 0), 0) / data.length;

      return { count: data.length, approved, passed, avgScore };
    },
    enabled: !!dealId
  });

  // Fetch pipeline/outreach stats for this deal
  const { data: pipelineStats } = useQuery({
    queryKey: ['remarketing', 'pipeline', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_outreach')
        .select('status')
        .eq('listing_id', dealId);

      if (error) throw error;

      return {
        contacted: data?.filter(o => o.status === 'contacted').length || 0,
        responded: data?.filter(o => o.status === 'responded').length || 0,
        meetingScheduled: data?.filter(o => o.status === 'meeting_scheduled').length || 0,
        loiSent: data?.filter(o => o.status === 'loi_sent').length || 0,
        closedWon: data?.filter(o => o.status === 'closed_won').length || 0,
        closedLost: data?.filter(o => o.status === 'closed_lost').length || 0,
      };
    },
    enabled: !!dealId
  });

  // Fetch transcripts for this deal
  const { data: transcripts, isLoading: transcriptsLoading } = useQuery({
    queryKey: ['remarketing', 'deal-transcripts', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_transcripts')
        .select('*')
        .eq('listing_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as any[];
    },
    enabled: !!dealId
  });

  // Mutation to update deal fields
  const updateDealMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', dealId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
    }
  });

  // Toggle universe build flag
  const toggleUniverseFlagMutation = useMutation({
    mutationFn: async (flagged: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('listings')
        .update({
          universe_build_flagged: flagged,
          universe_build_flagged_at: flagged ? new Date().toISOString() : null,
          universe_build_flagged_by: flagged ? user?.id : null,
        } as any)
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: (_, flagged) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
      toast.success(flagged ? 'Flagged for universe build' : 'Universe build flag removed');
    },
    onError: () => toast.error('Failed to update flag'),
  });

  // Toggle "needs owner contact" flag
  const toggleContactOwnerMutation = useMutation({
    mutationFn: async (flagged: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('listings')
        .update({
          needs_owner_contact: flagged,
          needs_owner_contact_at: flagged ? new Date().toISOString() : null,
          needs_owner_contact_by: flagged ? user?.id : null,
        } as any)
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: (_, flagged) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      toast.success(flagged ? '⚠️ Flagged: Owner needs to be contacted' : 'Contact owner flag cleared');
    },
    onError: () => toast.error('Failed to update flag'),
  });

  // Extract website URL from internal_deal_memo_link
  const extractWebsiteFromMemo = (memoLink: string | null): string | null => {
    if (!memoLink) return null;
    
    // Skip SharePoint/OneDrive links
    if (memoLink.includes('sharepoint.com') || memoLink.includes('onedrive')) {
      return null;
    }
    
    // Handle "Website: https://..." format
    const websiteMatch = memoLink.match(/Website:\s*(https?:\/\/[^\s]+)/i);
    if (websiteMatch) return websiteMatch[1];
    
    // Handle direct URL (not SharePoint)
    if (memoLink.match(/^https?:\/\/[a-zA-Z0-9]/) && !memoLink.includes('sharepoint')) {
      return memoLink;
    }
    
    // Handle domain-only format (e.g., "pragra.io")
    if (memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) {
      return `https://${memoLink}`;
    }
    
    return null;
  };

  // Get effective website - prefer website field, fallback to extracted from memo
  const getEffectiveWebsite = (): string | null => {
    if (deal?.website) return deal.website;
    return extractWebsiteFromMemo(deal?.internal_deal_memo_link);
  };

  const effectiveWebsite = deal ? getEffectiveWebsite() : null;

  // Calculate data completeness
  const calculateDataCompleteness = () => {
    if (!deal) return 0;
    
    const fields = [
      deal.title,
      deal.description,
      deal.location,
      deal.revenue,
      deal.ebitda,
      deal.category,
      effectiveWebsite,
      deal.executive_summary,
      deal.service_mix,
      deal.geographic_states,
    ];
    
    const filledFields = fields.filter(f => f !== null && f !== undefined && f !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const dataCompleteness = calculateDataCompleteness();

  // Handle website enrichment with progress tracking
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [enrichmentStage, setEnrichmentStage] = useState('');

  const handleEnrichFromWebsite = async () => {
    if (!deal) return;
    
    setIsEnriching(true);
    setEnrichmentProgress(10);
    setEnrichmentStage('Scraping website...');

    // Simulate progress stages while waiting for the edge function
    const progressTimer = setInterval(() => {
      setEnrichmentProgress(prev => {
        if (prev >= 85) { clearInterval(progressTimer); return 85; }
        if (prev < 30) { setEnrichmentStage('Scraping website...'); return prev + 3; }
        if (prev < 55) { setEnrichmentStage('Extracting business intelligence...'); return prev + 2; }
        if (prev < 75) { setEnrichmentStage('Processing company data...'); return prev + 1.5; }
        setEnrichmentStage('Saving enriched data...');
        return prev + 1;
      });
    }, 500);

    try {
      const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueDealEnrichment([dealId]);

      clearInterval(progressTimer);
      setEnrichmentProgress(100);
      setEnrichmentStage('Queued for background processing');
      setTimeout(() => { setIsEnriching(false); setEnrichmentProgress(0); setEnrichmentStage(''); }, 1500);
    } catch (error: any) {
      clearInterval(progressTimer);
      toast.error(error.message || "Failed to queue enrichment");
    }
    setIsEnriching(false);
    setEnrichmentProgress(0);
    setEnrichmentStage('');
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "Not specified";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  // Inline editing state for company name (must be before early returns)
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const updateNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase
        .from('listings')
        .update({ internal_company_name: newName })
        .eq('id', dealId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
      toast.success('Company name updated');
      setIsEditingName(false);
    },
    onError: (err: Error) => {
      toast.error(`Failed to update name: ${err.message}`);
    },
  });

  const currentName = deal?.internal_company_name || deal?.title || '';

  const handleSaveName = () => {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === currentName) {
      setIsEditingName(false);
      return;
    }
    updateNameMutation.mutate(trimmed);
  };

  const handleCancelEdit = () => {
    setEditedName(currentName);
    setIsEditingName(false);
  };

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
            <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/remarketing/deals')}>
              Back to All Deals
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tier = scoreStats?.avgScore ? getTierFromScore(scoreStats.avgScore) : null;

  // Get display name - prefer internal_company_name, fallback to title
  const displayName = deal.internal_company_name || deal.title;
  const listedName = deal.internal_company_name && deal.title !== deal.internal_company_name 
    ? deal.title 
    : null;


  return (
    <div className="p-6 space-y-6">

      {/* Financial Data Warning Banner per spec */}
      {deal && (deal.revenue_confidence === 'low' || deal.ebitda_confidence === 'low') && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">
            Financial Data Needs Clarification — Some financial figures have low confidence. Review source quotes and consider follow-up.
          </span>
        </div>
      )}

      {/* CapTarget Info Section — shown only for captarget-sourced deals */}
      {deal.deal_source === 'captarget' && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="py-3">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
              <Target className="h-5 w-5" />
              CapTarget Info
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {deal.captarget_client_name && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Client</p>
                  <p className="text-sm font-medium">{deal.captarget_client_name}</p>
                </div>
              )}
              {deal.captarget_contact_date && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Contact Date</p>
                  <p className="text-sm">{format(new Date(deal.captarget_contact_date), 'MMM d, yyyy')}</p>
                </div>
              )}
              {deal.captarget_outreach_channel && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Outreach Channel</p>
                  <p className="text-sm">{deal.captarget_outreach_channel}</p>
                </div>
              )}
              {deal.captarget_interest_type && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Interest Type</p>
                  <Badge variant="outline" className={
                    deal.captarget_interest_type === 'interest' ? 'bg-green-50 text-green-700 border-green-200' :
                    deal.captarget_interest_type === 'no_interest' ? 'bg-red-50 text-red-700 border-red-200' :
                    deal.captarget_interest_type === 'keep_in_mind' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-gray-50 text-gray-600 border-gray-200'
                  }>
                    {deal.captarget_interest_type === 'interest' ? 'Interest' :
                     deal.captarget_interest_type === 'no_interest' ? 'No Interest' :
                     deal.captarget_interest_type === 'keep_in_mind' ? 'Keep in Mind' : 'Unknown'}
                  </Badge>
                </div>
              )}
            </div>
            {/* Push status */}
            <div className="mt-3 flex items-center gap-4">
              {deal.pushed_to_all_deals ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                  <Check className="h-3 w-3" />
                  Pushed to All Deals
                  {deal.pushed_to_all_deals_at && (
                    <span className="text-green-500 ml-1">
                      {format(new Date(deal.pushed_to_all_deals_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={async () => {
                    const { error } = await supabase
                      .from('listings')
                      .update({
                        status: 'active',
                        pushed_to_all_deals: true,
                        pushed_to_all_deals_at: new Date().toISOString(),
                      })
                      .eq('id', dealId);
                    if (error) {
                      toast.error('Failed to push deal');
                    } else {
                      toast.success('Deal pushed to All Deals');
                      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
                      queryClient.invalidateQueries({ queryKey: ['remarketing', 'captarget-deals'] });
                      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
                    }
                  }}
                >
                  Push to All Deals
                </Button>
              )}
              {deal.captarget_source_url && (
                <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" asChild>
                  <a href={deal.captarget_source_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    View in Google Sheet
                  </a>
                </Button>
              )}
            </div>
            {/* Call notes collapsible */}
            {deal.captarget_call_notes && (
              <details className="mt-3">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                  Original Call Notes
                </summary>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap bg-white/60 rounded-md p-3 border">
                  {deal.captarget_call_notes}
                </p>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {backTo ? (
              <Button variant="ghost" size="sm" asChild>
                <Link to={backTo}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  className="text-2xl font-bold text-foreground bg-transparent border-b-2 border-primary outline-none px-0 py-0.5 min-w-[200px]"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  autoFocus
                  disabled={updateNameMutation.isPending}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveName} disabled={updateNameMutation.isPending}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit} disabled={updateNameMutation.isPending}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setEditedName(displayName); setIsEditingName(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {deal.category && (
              <Badge variant="secondary">{deal.category}</Badge>
            )}
            {/* Data Quality Badge with Rich Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant={dataCompleteness >= 80 ? 'default' : 'outline'}>
                    {dataCompleteness}% Data
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Deal Data Quality: {dataCompleteness}%</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((dataCompleteness / 100) * 10)} of 10 fields filled
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Seller Interest Score Badge */}
            {deal.seller_interest_score !== null && deal.seller_interest_score !== undefined && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={
                        deal.seller_interest_score >= 70
                          ? "bg-green-50 text-green-700 border-green-200"
                          : deal.seller_interest_score >= 40
                          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }
                    >
                      {deal.seller_interest_score} Seller Interest
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">Seller Interest Score: {deal.seller_interest_score}/100</p>
                    <p className="text-xs text-muted-foreground">
                      AI-analyzed from call transcripts and notes to indicate seller motivation level.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Badge variant={deal.status === 'active' ? 'default' : 'secondary'} className="capitalize">
              {deal.status}
            </Badge>
            <DealSourceBadge source={deal.deal_source} />
          </div>
          {listedName && (
            <p className="text-sm text-muted-foreground mt-0.5">Listed as: {listedName}</p>
          )}
          {/* Show structured address if available, otherwise fall back to location */}
          {(deal.address_city && deal.address_state) ? (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              {deal.address_city}, {deal.address_state}
            </p>
          ) : deal.location ? (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              {deal.location}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {tier && <ScoreTierBadge tier={tier} size="lg" />}
        </div>
      </div>

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
        const needsContact = (deal as any)?.needs_owner_contact;
        return (
          <Card className={needsContact ? "border-red-400 border-2 bg-red-50 dark:bg-red-950/20" : ""}>
            {needsContact && (
              <div className="bg-red-500 text-white text-sm font-semibold px-4 py-2 flex items-center gap-2 rounded-t-lg">
                <PhoneCall className="h-4 w-4 animate-pulse" />
                ACTION REQUIRED: Owner needs to be contacted — we have a buyer ready!
              </div>
            )}
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-lg flex items-center gap-2 ${needsContact ? "text-red-700" : ""}`}>
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
                    <a href={effectiveWebsite.startsWith('http') ? effectiveWebsite : `https://${effectiveWebsite}`} target="_blank" rel="noopener noreferrer">
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
                  dealId={dealId!}
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
                        variant={needsContact ? "default" : "outline"}
                        className={`gap-2 font-semibold ${needsContact
                          ? "bg-red-600 hover:bg-red-700 border-red-600 text-white shadow-md shadow-red-200"
                          : "border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500"
                        }`}
                        onClick={() => toggleContactOwnerMutation.mutate(!needsContact)}
                        disabled={toggleContactOwnerMutation.isPending}
                      >
                        {toggleContactOwnerMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PhoneCall className={`h-4 w-4 ${needsContact ? "animate-pulse" : ""}`} />
                        )}
                        {needsContact ? "🚨 Needs Owner Contact" : "Flag: Contact Owner"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {needsContact
                        ? "This deal is flagged — team must contact the owner, we have a buyer ready! Click to clear."
                        : "Flag this deal to alert the team that the owner needs to be contacted (buyer is ready)."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Universe Build Flag Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={((deal as any)?.universe_build_flagged) ? "default" : "outline"}
                        className={`gap-2 ${((deal as any)?.universe_build_flagged) ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white" : "border-amber-400 text-amber-600 hover:bg-amber-50"}`}
                        onClick={() => toggleUniverseFlagMutation.mutate(!((deal as any)?.universe_build_flagged))}
                        disabled={toggleUniverseFlagMutation.isPending}
                      >
                        {toggleUniverseFlagMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Flag className={`h-4 w-4 ${((deal as any)?.universe_build_flagged) ? "fill-white" : ""}`} />
                        )}
                        {((deal as any)?.universe_build_flagged) ? "Flagged: Build Universe" : "Flag for Universe Build"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {((deal as any)?.universe_build_flagged)
                        ? "This deal is flagged — a team member needs to build a buyer universe for it. Click to remove flag."
                        : "Flag this deal to indicate a buyer universe needs to be built by the team."}
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
                    <span className="text-muted-foreground font-medium">{Math.round(enrichmentProgress)}%</span>
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
        dealId={dealId!}
      />

      {/* Company Overview (75%) + Activity Log (25%) side by side */}
      <div className="grid grid-cols-4 gap-4 items-start">
        <div className="col-span-3">
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
            // Structured address fields
            streetAddress={deal.street_address}
            addressCity={deal.address_city}
            addressState={deal.address_state}
            addressZip={deal.address_zip}
            addressCountry={deal.address_country}
            // Google reviews data
            googleReviewCount={deal.google_review_count ?? undefined}
            googleRating={deal.google_rating ?? undefined}
            googleMapsUrl={deal.google_maps_url ?? undefined}
            // LinkedIn data
            linkedinUrl={deal.linkedin_url ?? undefined}
            linkedinEmployeeCount={deal.linkedin_employee_count ?? undefined}
            linkedinEmployeeRange={deal.linkedin_employee_range ?? undefined}
            // Deal quality score (editable)
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
                // Structured address
                street_address: data.streetAddress,
                address_city: data.addressCity,
                address_state: data.addressState,
                address_zip: data.addressZip,
                address_country: data.addressCountry,
              });
            }}
          />
        </div>
        <div className="col-span-1">
          <DealActivityLog dealId={dealId!} maxHeight={480} />
        </div>
      </div>

      {/* Financial Overview - Full width below Company Overview */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Overview
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditFinancialsOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Low Confidence Warning Banner */}
          {((deal.revenue_confidence === 'low') || (deal.ebitda_confidence === 'low')) && (
            <div className="flex items-start gap-2 p-2 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium">Needs Clarification</p>
              </div>
            </div>
          )}
          
          {/* 3-column grid for financial metrics */}
          <div className="grid grid-cols-3 gap-6">
            {/* Revenue */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  REVENUE
                </p>
                {deal.revenue && (
                  <Badge 
                    variant="outline" 
                    className={
                      deal.revenue_confidence === 'high' 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs" 
                        : deal.revenue_confidence === 'low'
                        ? "bg-red-50 text-red-600 border-red-200 text-xs"
                        : "bg-amber-50 text-amber-700 border-amber-200 text-xs"
                    }
                  >
                    {deal.revenue_confidence === 'high' ? '✓' : 
                     deal.revenue_confidence === 'low' ? '△' : '○'}
                  </Badge>
                )}
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
                      <Button variant="link" size="sm" className="text-xs text-primary p-0 h-auto mt-1 block">
                        {isManual ? 'Manually entered' : 'View source'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={
                            isManual ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                            : isTranscript ? "bg-purple-50 text-purple-700 border-purple-200 text-xs"
                            : "bg-gray-50 text-gray-600 border-gray-200 text-xs"
                          }>
                            {isManual ? 'Manual' : isTranscript ? 'Transcript' : sourceType || 'Unknown'}
                          </Badge>
                          {revSource?.timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(revSource.timestamp).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {isTranscript && transcriptTitle && (
                          <p className="text-xs text-muted-foreground">
                            From: <span className="font-medium text-foreground">{transcriptTitle}</span>
                          </p>
                        )}
                        {hasQuote && (
                          <>
                            <p className="text-xs font-medium text-muted-foreground uppercase">Source Quote</p>
                            <p className="text-sm italic border-l-2 border-primary/30 pl-2">"{deal.revenue_source_quote}"</p>
                          </>
                        )}
                        {isManual && !hasQuote && (
                          <p className="text-xs text-muted-foreground">Value was entered manually by a team member.</p>
                        )}
                        {deal.revenue_is_inferred && (
                          <p className="text-xs text-amber-600">Inferred from other financial data</p>
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
                {deal.ebitda && (
                  <Badge 
                    variant="outline" 
                    className={
                      deal.ebitda_confidence === 'high' 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs" 
                        : deal.ebitda_confidence === 'low'
                        ? "bg-red-50 text-red-600 border-red-200 text-xs"
                        : "bg-amber-50 text-amber-700 border-amber-200 text-xs"
                    }
                  >
                    {deal.ebitda_confidence === 'high' ? '✓' : 
                     deal.ebitda_confidence === 'low' ? '△' : '○'}
                  </Badge>
                )}
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
                      <Button variant="link" size="sm" className="text-xs text-primary p-0 h-auto mt-1 block">
                        {isManual ? 'Manually entered' : 'View source'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={
                            isManual ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                            : isTranscript ? "bg-purple-50 text-purple-700 border-purple-200 text-xs"
                            : "bg-gray-50 text-gray-600 border-gray-200 text-xs"
                          }>
                            {isManual ? 'Manual' : isTranscript ? 'Transcript' : sourceType || 'Unknown'}
                          </Badge>
                          {ebitdaSource?.timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(ebitdaSource.timestamp).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {isTranscript && transcriptTitle && (
                          <p className="text-xs text-muted-foreground">
                            From: <span className="font-medium text-foreground">{transcriptTitle}</span>
                          </p>
                        )}
                        {hasQuote && (
                          <>
                            <p className="text-xs font-medium text-muted-foreground uppercase">Source Quote</p>
                            <p className="text-sm italic border-l-2 border-primary/30 pl-2">"{deal.ebitda_source_quote}"</p>
                          </>
                        )}
                        {isManual && !hasQuote && (
                          <p className="text-xs text-muted-foreground">Value was entered manually by a team member.</p>
                        )}
                        {deal.ebitda_is_inferred && (
                          <p className="text-xs text-amber-600">Inferred from other financial data</p>
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
          revenue_confidence: deal.revenue_confidence,
          ebitda_confidence: deal.ebitda_confidence,
        }}
        onSave={async (data) => {
          const { _manualEdit, ...financialData } = data;
          const updates: Record<string, any> = { ...financialData };

          // When manually editing financials, mark source as manual in extraction_sources
          if (_manualEdit) {
            const existingSources = (deal.extraction_sources as Record<string, any>) || {};
            const manualSource = { source: 'manual', timestamp: new Date().toISOString() };
            const sourceUpdates: Record<string, any> = { ...existingSources };
            if (data.revenue !== undefined) {
              sourceUpdates.revenue = manualSource;
              sourceUpdates.revenue_confidence = manualSource;
              sourceUpdates.revenue_source_quote = manualSource;
            }
            if (data.ebitda !== undefined) {
              sourceUpdates.ebitda = manualSource;
              sourceUpdates.ebitda_confidence = manualSource;
              sourceUpdates.ebitda_source_quote = manualSource;
            }
            updates.extraction_sources = sourceUpdates;
            // Clear source quotes since this is now manually entered
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
          await updateDealMutation.mutateAsync({ owner_response: response } as any);
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
        }}
      />

      {/* End Market / Customers - Enhanced with 3 fields */}
      <CustomerTypesCard
        customerTypes={deal.customer_types}
        customerConcentration={deal.customer_concentration != null ? String(deal.customer_concentration) : undefined}
        customerGeography={deal.customer_geography ?? undefined}
        onSave={async (data) => {
          await updateDealMutation.mutateAsync({ 
            customer_types: data.customerTypes,
            customer_concentration: data.customerConcentration ? parseFloat(data.customerConcentration) : null,
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

      {/* Match Stats */}
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
        dealId={dealId!}
        transcripts={transcripts || []}
        isLoading={transcriptsLoading}
        dealInfo={{
          company_name: deal.internal_company_name || deal.title,
          main_contact_email: deal.main_contact_email,
        }}
        contactEmail={deal.main_contact_email ?? null}
        contactName={deal.main_contact_name ?? null}
        companyName={deal.internal_company_name || deal.title || ''}
        onSyncComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
        }}
        onTranscriptLinked={() => {
          queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-transcripts', dealId] });
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
              toast.error(data?.error || "Failed to analyze notes");
            }
          } catch (error: any) {
            toast.error(error.message || "Failed to analyze notes");
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

      {/* AI Buyer Chat */}
      <DealBuyerChat
        listingId={dealId!}
        dealName={deal.internal_company_name || deal.title}
        dealGeography={deal.address_state ? [deal.address_state] : []}
        dealRevenue={deal.revenue}
        approvedCount={scoreStats?.approved || 0}
        passedCount={scoreStats?.passed || 0}
        pendingCount={(scoreStats?.count || 0) - (scoreStats?.approved || 0) - (scoreStats?.passed || 0)}
      />
    </div>
  );
};

export default ReMarketingDealDetail;
