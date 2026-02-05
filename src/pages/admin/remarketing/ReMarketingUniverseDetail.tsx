import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  DocumentUploadSection,
  MAGuideEditor,
  UniverseTemplates,
  BuyerTableEnhanced,
  UniverseDealsTable,
  TargetBuyerTypesPanel,
  BuyerTableToolbar,
  AddDealToUniverseDialog,
  DealCSVImport,
  BuyerCSVImport,
  BuyerFitCriteriaDialog,
  AIResearchSection,
  ScoringStyleCard,
  BuyerFitCriteriaAccordion,
  StructuredCriteriaPanel,
  EnrichmentProgressIndicator,
  EnrichmentSummaryDialog,
  ReMarketingChat
} from "@/components/remarketing";
import type { EnrichmentSummary } from "@/hooks/useBuyerEnrichment";
import { 
  SizeCriteria, 
  GeographyCriteria, 
  ServiceCriteria, 
  BuyerTypesCriteria,
  ScoringBehavior,
  DocumentReference,
  TargetBuyerTypeConfig
} from "@/types/remarketing";
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
  Briefcase,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBuyerEnrichment } from "@/hooks/useBuyerEnrichment";
import { useBuyerEnrichmentQueue } from "@/hooks/useBuyerEnrichmentQueue";
import { useDealEnrichment } from "@/hooks/useDealEnrichment";
import { useAlignmentScoring } from "@/hooks/useAlignmentScoring";

const ReMarketingUniverseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  const aiResearchRef = useRef<{ scrollIntoView: () => void }>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fit_criteria: '',
    geography_weight: 35,
    size_weight: 25,
    service_weight: 25,
    owner_goals_weight: 15,
  });

  const [sizeCriteria, setSizeCriteria] = useState<SizeCriteria>({});
  const [geographyCriteria, setGeographyCriteria] = useState<GeographyCriteria>({});
  const [serviceCriteria, setServiceCriteria] = useState<ServiceCriteria>({});
  const [buyerTypesCriteria, setBuyerTypesCriteria] = useState<BuyerTypesCriteria>({
    include_pe_firms: true,
    include_platforms: true,
    include_strategic: true,
    include_family_office: true
  });
  const [scoringBehavior, setScoringBehavior] = useState<ScoringBehavior>({});
  const [documents, setDocuments] = useState<DocumentReference[]>([]);
  const [maGuideContent, setMaGuideContent] = useState("");
  const [targetBuyerTypes, setTargetBuyerTypes] = useState<TargetBuyerTypeConfig[]>([]);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [addDealDialogOpen, setAddDealDialogOpen] = useState(false);
  const [addDealDefaultTab, setAddDealDefaultTab] = useState<'existing' | 'new'>('existing');
  const [importDealsDialogOpen, setImportDealsDialogOpen] = useState(false);
  const [isScoringAllDeals, setIsScoringAllDeals] = useState(false);
  const [showCriteriaEdit, setShowCriteriaEdit] = useState(false);
  const [buyerProfilesOpen, setBuyerProfilesOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [showAIResearch, setShowAIResearch] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [importBuyersDialogOpen, setImportBuyersDialogOpen] = useState(false);
  const [isDeduping, setIsDeduping] = useState(false);
  const [showBuyerEnrichDialog, setShowBuyerEnrichDialog] = useState(false);
   const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);
   const [isRemovingSelected, setIsRemovingSelected] = useState(false);

  // Use the enrichment hook for proper batch processing with progress tracking (legacy - for direct enrichment)
  const { 
    progress: legacyEnrichmentProgress, 
    enrichBuyers: legacyEnrichBuyers, 
    cancel: legacyCancelEnrichment, 
    reset: legacyResetEnrichment 
  } = useBuyerEnrichment(id);

  // Use the queue-based enrichment for persistent background processing
  const {
    progress: queueProgress,
    summary: enrichmentSummary,
    showSummary: showEnrichmentSummary,
    dismissSummary: dismissEnrichmentSummary,
    queueBuyers,
    cancel: cancelQueueEnrichment,
    reset: resetQueueEnrichment,
  } = useBuyerEnrichmentQueue(id);

  // Use the deal enrichment hook for proper batch processing with progress tracking
  const { 
    progress: dealEnrichmentProgress, 
    enrichDeals, 
    cancel: cancelDealEnrichment, 
    reset: resetDealEnrichment 
  } = useDealEnrichment(id);

  // Use the alignment scoring hook
  const {
    isScoring: isScoringAlignment,
    progress: alignmentProgress,
    scoreBuyers: scoreAlignmentBuyers,
    cancel: cancelAlignmentScoring,
    reset: resetAlignmentScoring
  } = useAlignmentScoring(id);

  // Fetch universe if editing
  const { data: universe, isLoading } = useQuery({
    queryKey: ['remarketing', 'universe', id],
    queryFn: async () => {
      if (isNew) return null;
      
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !isNew
  });

  // Fetch buyers in this universe
  const { data: buyers, refetch: refetchBuyers, isLoading: buyersLoading } = useQuery({
    queryKey: ['remarketing', 'buyers', 'universe', id],
    queryFn: async () => {
      if (isNew) return [];
      
      console.log('[BuyerQuery] Fetching buyers for universe:', id);
      const { data, error } = await supabase
        .from('remarketing_buyers')
        .select('id, company_name, company_website, platform_website, pe_firm_website, buyer_type, pe_firm_name, hq_city, hq_state, business_summary, thesis_summary, data_completeness, target_geographies, geographic_footprint, alignment_score, alignment_reasoning, alignment_checked_at, has_fee_agreement')
        .eq('universe_id', id)
        .eq('archived', false)
        .order('alignment_score', { ascending: false, nullsFirst: false });
      
      if (error) {
        console.error('[BuyerQuery] Error fetching buyers:', error);
        throw error;
      }
      console.log('[BuyerQuery] Fetched', data?.length || 0, 'buyers');
      return data || [];
    },
    enabled: !isNew,
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    staleTime: 0, // Always consider data stale to ensure fresh fetches after invalidation
  });

  // Fetch buyer IDs that have transcripts - needed to determine Intel level
  // Without transcripts, max intel is "Some Intel" (not "Strong")
  const { data: buyerIdsWithTranscripts } = useQuery({
    queryKey: ['remarketing', 'buyer-transcripts', id],
    queryFn: async () => {
      if (isNew || !buyers?.length) return new Set<string>();
      
      const buyerIds = buyers.map(b => b.id);
      const { data, error } = await supabase
        .from('buyer_transcripts')
        .select('buyer_id')
        .in('buyer_id', buyerIds);
      
      if (error) {
        console.error('Error fetching transcripts:', error);
        return new Set<string>();
      }
      
      return new Set((data || []).map((t: any) => t.buyer_id));
    },
    enabled: !isNew && !!buyers?.length,
  });

  // Real-time subscription for buyer updates during enrichment
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  useEffect(() => {
    if (isNew || !id) return;
    
    // Cleanup any previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    const channel = supabase
      .channel(`universe-buyers:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "remarketing_buyers",
          filter: `universe_id=eq.${id}`,
        },
        (payload) => {
          // Refetch buyers list on any change (INSERT, UPDATE, DELETE)
          console.log('[Realtime] Buyer change detected:', payload.eventType);
          refetchBuyers();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log('[Realtime] Subscribed to universe buyers');
        }
      });
    
    channelRef.current = channel;
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [id, isNew, refetchBuyers]);

  // Fetch deals explicitly linked to this universe via junction table
  const { data: universeDeals, refetch: refetchDeals } = useQuery({
    queryKey: ['remarketing', 'universe-deals', id],
    queryFn: async () => {
      if (isNew) return [];
      
      const result = await (supabase as any)
        .from('remarketing_universe_deals')
        .select(`
          id,
          added_at,
          status,
          listing:listings(
            id, title, internal_company_name, location, revenue, ebitda, 
            enriched_at, geographic_states
          )
        `)
        .eq('universe_id', id)
        .eq('status', 'active')
        .order('added_at', { ascending: false });
      
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !isNew
  });

  // Fetch engagement stats from remarketing_scores for deals in this universe
  const { data: dealEngagementStats } = useQuery({
    queryKey: ['remarketing', 'deal-engagement', id],
    queryFn: async () => {
      if (isNew || !universeDeals?.length) return {};
      
      const listingIds = universeDeals.map((d: any) => d.listing?.id).filter(Boolean);
      if (listingIds.length === 0) return {};
      
      const { data: scores, error } = await supabase
        .from('remarketing_scores')
        .select('listing_id, status, composite_score')
        .eq('universe_id', id)
        .in('listing_id', listingIds);
      
      if (error) throw error;
      
      const stats: Record<string, { approved: number; interested: number; passed: number; avgScore: number; totalScore: number; count: number }> = {};
      
      scores?.forEach((score) => {
        if (!stats[score.listing_id]) {
          stats[score.listing_id] = { approved: 0, interested: 0, passed: 0, avgScore: 0, totalScore: 0, count: 0 };
        }
        const s = stats[score.listing_id];
        s.count++;
        s.totalScore += score.composite_score || 0;
        
        if (score.status === 'approved') s.approved++;
        else if (score.status === 'pending') s.interested++;
        else if (score.status === 'passed') s.passed++;
      });
      
      // Calculate averages
      Object.values(stats).forEach(s => {
        s.avgScore = s.count > 0 ? s.totalScore / s.count : 0;
      });
      
      return stats;
    },
    enabled: !isNew && !!universeDeals?.length
  });

  // Update form when universe loads
  useEffect(() => {
    if (universe) {
      setFormData({
        name: universe.name || '',
        description: universe.description || '',
        fit_criteria: universe.fit_criteria || '',
        geography_weight: universe.geography_weight || 35,
        size_weight: universe.size_weight || 25,
        service_weight: universe.service_weight || 25,
        owner_goals_weight: universe.owner_goals_weight || 15,
      });
      setSizeCriteria((universe.size_criteria as unknown as SizeCriteria) || {});
      setGeographyCriteria((universe.geography_criteria as unknown as GeographyCriteria) || {});
      setServiceCriteria((universe.service_criteria as unknown as ServiceCriteria) || {});
      setBuyerTypesCriteria((universe.buyer_types_criteria as unknown as BuyerTypesCriteria) || {
        include_pe_firms: true,
        include_platforms: true,
        include_strategic: true,
        include_family_office: true
      });
      setScoringBehavior((universe.scoring_behavior as unknown as ScoringBehavior) || {});
      setDocuments((universe.documents as unknown as DocumentReference[]) || []);
      setMaGuideContent(universe.ma_guide_content || '');
      
      // Load saved target buyer types from DB, fall back to defaults if empty
      const savedBuyerTypes = (universe as any).target_buyer_types as TargetBuyerTypeConfig[];
      if (savedBuyerTypes && savedBuyerTypes.length > 0) {
        setTargetBuyerTypes(savedBuyerTypes);
      }
    }
  }, [universe]);

  // Auto-sync M&A guide to Supporting Documents if guide exists but document entry is missing
  useEffect(() => {
    const syncGuideToDocuments = async () => {
      if (!id || isNew || !universe) return;
      
      const guideContent = universe.ma_guide_content;
      const existingDocs = (universe.documents as unknown as DocumentReference[]) || [];
      const hasGuideDoc = existingDocs.some((d: any) => d.type === 'ma_guide');
      
      // If there's substantial guide content but no document entry, create one
      if (guideContent && guideContent.length > 1000 && !hasGuideDoc) {
        console.log('[ReMarketingUniverseDetail] Guide exists but no document entry - syncing to Supporting Documents');
        
        try {
          // Call edge function to upload HTML to storage
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-guide-pdf`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                universeId: id,
                industryName: universe.name || 'M&A Guide',
                content: guideContent
              }),
            }
          );

          if (!response.ok) {
            console.error('[ReMarketingUniverseDetail] Failed to generate guide document:', response.status);
            return;
          }

          const data = await response.json();
          if (!data.success || !data.document) {
            console.error('[ReMarketingUniverseDetail] No document returned from generate-guide-pdf');
            return;
          }

          // Build updated documents array
          const updatedDocs = [...existingDocs, data.document];

          // Write back to database
          const { error: updateError } = await supabase
            .from('remarketing_buyer_universes')
            .update({ documents: updatedDocs })
            .eq('id', id);

          if (updateError) {
            console.error('[ReMarketingUniverseDetail] Failed to save document:', updateError);
            return;
          }

          // Update local state for immediate UI feedback
          setDocuments(updatedDocs);
          console.log('[ReMarketingUniverseDetail] Guide synced to Supporting Documents successfully');
        } catch (error) {
          console.error('[ReMarketingUniverseDetail] Error syncing guide to documents:', error);
        }
      }
    };

    syncGuideToDocuments();
  }, [universe, id, isNew]);

  // Handle template application
  const handleApplyTemplate = (templateConfig: {
    name: string;
    description: string;
    fit_criteria: string;
    size_criteria: SizeCriteria;
    geography_criteria: GeographyCriteria;
    service_criteria: ServiceCriteria;
    buyer_types_criteria: BuyerTypesCriteria;
    scoring_behavior: ScoringBehavior;
    geography_weight: number;
    size_weight: number;
    service_weight: number;
    owner_goals_weight: number;
  }) => {
    setFormData({
      name: templateConfig.name,
      description: templateConfig.description,
      fit_criteria: templateConfig.fit_criteria,
      geography_weight: templateConfig.geography_weight,
      size_weight: templateConfig.size_weight,
      service_weight: templateConfig.service_weight,
      owner_goals_weight: templateConfig.owner_goals_weight,
    });
    setSizeCriteria(templateConfig.size_criteria);
    setGeographyCriteria(templateConfig.geography_criteria);
    setServiceCriteria(templateConfig.service_criteria);
    setBuyerTypesCriteria(templateConfig.buyer_types_criteria);
    setScoringBehavior(templateConfig.scoring_behavior);
  };

  // Parse natural language criteria using AI
  const parseCriteria = async () => {
    if (!formData.fit_criteria.trim()) {
      toast.error('Please enter fit criteria text first');
      return;
    }
    
    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-fit-criteria', {
        body: {
          fit_criteria_text: formData.fit_criteria,
          universe_name: formData.name
        }
      });

      if (error) throw error;

      if (data) {
        if (data.size_criteria) setSizeCriteria(prev => ({ ...prev, ...data.size_criteria }));
        if (data.geography_criteria) setGeographyCriteria(prev => ({ ...prev, ...data.geography_criteria }));
        if (data.service_criteria) setServiceCriteria(prev => ({ ...prev, ...data.service_criteria }));
        if (data.buyer_types_criteria) setBuyerTypesCriteria(prev => ({ ...prev, ...data.buyer_types_criteria }));
        if (data.scoring_behavior) setScoringBehavior(prev => ({ ...prev, ...data.scoring_behavior }));
        
        toast.success(`Parsed criteria with ${Math.round((data.confidence || 0.5) * 100)}% confidence`);
      }
    } catch (error) {
      console.error('Failed to parse criteria:', error);
      toast.error('Failed to parse criteria');
    } finally {
      setIsParsing(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const saveData: any = {
        ...formData,
        size_criteria: sizeCriteria,
        geography_criteria: geographyCriteria,
        service_criteria: serviceCriteria,
        buyer_types_criteria: buyerTypesCriteria,
        scoring_behavior: scoringBehavior,
        documents: documents,
        ma_guide_content: maGuideContent,
        target_buyer_types: targetBuyerTypes
      };

      if (isNew) {
        const { data, error } = await supabase
          .from('remarketing_buyer_universes')
          .insert([saveData])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { error } = await supabase
          .from('remarketing_buyer_universes')
          .update(saveData)
          .eq('id', id);
        
        if (error) throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'universes'] });
      toast.success(isNew ? 'Universe created' : 'Universe saved');
      if (isNew && data?.id) {
        navigate(`/admin/remarketing/universes/${data.id}`);
      }
    },
    onError: () => {
      toast.error('Failed to save universe');
    }
  });

  // Handler for removing buyers from this universe (sets universe_id to null)
  // They remain in the all buyers list - just unlinked from this universe
  const handleRemoveBuyersFromUniverse = async (buyerIds: string[]) => {
    if (!buyerIds.length) return;
    
    const { error } = await supabase
      .from('remarketing_buyers')
      .update({ universe_id: null })
      .in('id', buyerIds);
    
    if (error) {
      toast.error('Failed to remove buyers from universe');
      throw error;
    }
    
    toast.success(`Removed ${buyerIds.length} buyer${buyerIds.length > 1 ? 's' : ''} from universe`);
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', id] });
  };

  // Handler for single buyer enrichment via row dropdown
  const handleEnrichSingleBuyer = async (buyerId: string) => {
    await queueBuyers([{ id: buyerId }]);
  };

  // Handler for single buyer removal from universe via row dropdown
  // Just unlinks from universe - buyer remains in All Buyers
  const handleDeleteBuyer = async (buyerId: string) => {
    const { error } = await supabase
      .from('remarketing_buyers')
      .update({ universe_id: null })
      .eq('id', buyerId);
    
    if (error) {
      toast.error('Failed to remove buyer');
      return;
    }
    
    toast.success('Buyer removed from universe');
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', 'universe', id] });
  };

   // Handler for bulk removal of selected buyers from universe
   const handleRemoveSelectedBuyers = async () => {
     if (!selectedBuyerIds.length) return;
     
     setIsRemovingSelected(true);
     try {
       await handleRemoveBuyersFromUniverse(selectedBuyerIds);
       setSelectedBuyerIds([]);
     } finally {
       setIsRemovingSelected(false);
     }
   };

  const totalWeight = formData.geography_weight + formData.size_weight + 
    formData.service_weight + formData.owner_goals_weight;

  // Handler for buyer enrichment with mode selection - uses queue for background processing
  const handleBuyerEnrichment = async (mode: 'all' | 'unenriched') => {
    setShowBuyerEnrichDialog(false);
    
    if (!buyers?.length) {
      toast.error('No buyers to enrich');
      return;
    }
    
    resetQueueEnrichment();
    
    // Filter based on mode
    const buyersToEnrich = mode === 'all' 
      ? buyers 
      : buyers.filter(b => b.data_completeness !== 'high');
    
    if (buyersToEnrich.length === 0) {
      toast.info('All buyers are already enriched');
      return;
    }
    
    // Queue for background processing (persists even when navigating away)
    await queueBuyers(buyersToEnrich.map(b => ({
      id: b.id,
      company_website: b.company_website,
      platform_website: b.platform_website,
      pe_firm_website: b.pe_firm_website
    })));
  };

  // Filter buyers by search
  const filteredBuyers = buyers?.filter(buyer => 
    !buyerSearch || 
    buyer.company_name.toLowerCase().includes(buyerSearch.toLowerCase()) ||
    buyer.pe_firm_name?.toLowerCase().includes(buyerSearch.toLowerCase())
  ) || [];

  if (!isNew && isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/remarketing/universes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
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
            <p className="text-muted-foreground">
              {isNew ? 'Create a new buyer universe' : 'Edit universe settings and criteria'}
            </p>
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

      {/* New Universe: Templates */}
      {isNew && (
        <UniverseTemplates onApplyTemplate={handleApplyTemplate} />
      )}

      {/* Main Tabs: Universe (default) vs Configuration */}
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

          {/* TAB 1: Universe - Buyers & Deals */}
          <TabsContent value="universe" className="space-y-4">
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
                      onAddBuyer={() => navigate('/admin/remarketing/buyers')}
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
                      buyers={filteredBuyers}
                      showPEColumn={true}
                      buyerIdsWithTranscripts={buyerIdsWithTranscripts}
                      selectable={true}
                      onRemoveFromUniverse={handleRemoveBuyersFromUniverse}
                      onEnrich={handleEnrichSingleBuyer}
                      onDelete={handleDeleteBuyer}
                       onSelectionChange={setSelectedBuyerIds}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="deals">
                {/* Deal Enrichment Progress Bar */}
                {dealEnrichmentProgress.isRunning && (
                  <div className="mb-4">
                    <EnrichmentProgressIndicator
                      completedCount={dealEnrichmentProgress.current}
                      totalCount={dealEnrichmentProgress.total}
                      progress={dealEnrichmentProgress.total > 0 ? (dealEnrichmentProgress.current / dealEnrichmentProgress.total) * 100 : 0}
                      estimatedTimeRemaining={dealEnrichmentProgress.total > 0 
                        ? `~${Math.ceil((dealEnrichmentProgress.total - dealEnrichmentProgress.current) * 2 / 60)} min` 
                        : undefined}
                      processingRate={dealEnrichmentProgress.current > 0 ? 30 : 0}
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
                              for (const deal of universeDeals) {
                                if (deal.listing?.id) {
                                  await supabase.functions.invoke('score-buyer-deal', {
                                    body: { bulk: true, listingId: deal.listing.id, universeId: id }
                                  });
                                }
                              }
                              toast.success(`Scored ${universeDeals.length} deals`);
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
                        {dealEnrichmentProgress.isRunning ? (
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
                      deals={universeDeals || []}
                      engagementStats={dealEngagementStats || {}}
                      onRemoveDeal={async (dealId, listingId) => {
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
                          await supabase.functions.invoke('score-buyer-deal', {
                            body: { bulk: true, listingId, universeId: id }
                          });
                          toast.success('Deal scored');
                          queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal-engagement', id] });
                        } catch (error) {
                          toast.error('Failed to score deal');
                        }
                      }}
                      onEnrichDeal={async (listingId) => {
                        try {
                          await supabase.functions.invoke('enrich-deal', {
                            body: { dealId: listingId }
                          });
                          toast.success('Deal enriched');
                          refetchDeals();
                        } catch (error) {
                          toast.error('Failed to enrich deal');
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
                  // Add the auto-generated guide document to the documents list
                  setDocuments(prev => {
                    // Remove any existing auto-generated guide to avoid duplicates
                    const filtered = prev.filter(d => !(d as any).type || (d as any).type !== 'ma_guide');
                    return [...filtered, doc];
                  });
                }}
                onGuideGenerated={(guide, extractedCriteria, buyerProfiles) => {
                  setMaGuideContent(guide);
                  if (extractedCriteria) {
                    if (extractedCriteria.size_criteria) setSizeCriteria(prev => ({ ...prev, ...extractedCriteria.size_criteria }));
                    if (extractedCriteria.geography_criteria) setGeographyCriteria(prev => ({ ...prev, ...extractedCriteria.geography_criteria }));
                    if (extractedCriteria.service_criteria) setServiceCriteria(prev => ({ ...prev, ...extractedCriteria.service_criteria }));
                    if (extractedCriteria.buyer_types_criteria) setBuyerTypesCriteria(prev => ({ ...prev, ...extractedCriteria.buyer_types_criteria }));
                  }
                  // Update target buyer types with AI-generated profiles
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
              maGuideDocument={documents.find(d => d.type === 'ma_guide')}
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
                          <CardTitle className="text-sm font-medium">Supporting Documents</CardTitle>
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
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* New Universe: Details & Settings Tabs */}
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
                <CardDescription>
                  Basic information about this buyer universe
                </CardDescription>
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
                  <Badge variant={totalWeight === 100 ? "default" : "destructive"} className="ml-2">
                    Total: {totalWeight}%
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Geography ({formData.geography_weight}%)</Label>
                  <Slider
                    value={[formData.geography_weight]}
                    onValueChange={([value]) => setFormData({ ...formData, geography_weight: value })}
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
                    onValueChange={([value]) => setFormData({ ...formData, owner_goals_weight: value })}
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
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers', 'universe', id] });
            setImportBuyersDialogOpen(false);
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

      {/* AI Chat - only show when not creating new */}
      {!isNew && id && (
        <ReMarketingChat
          context={{ type: "universe", universeId: id, universeName: universe?.name }}
        />
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
              Enrichment scrapes websites and extracts company data, 
              investment criteria, and M&A intelligence.
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
                  Re-enrich all {buyers?.filter(b => 
                    b.company_website || b.platform_website || b.pe_firm_website
                  ).length || 0} buyers (resets existing data)
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
                  Only enrich {buyers?.filter(b => 
                    b.data_completeness !== 'high' && 
                    (b.company_website || b.platform_website || b.pe_firm_website)
                  ).length || 0} buyers that haven't been enriched yet
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
          
          // Get failed buyer IDs from summary
          const failedBuyerIds = new Set(enrichmentSummary.errors.map(e => e.buyerId));
          const failedBuyers = buyers.filter(b => failedBuyerIds.has(b.id));
          
          if (failedBuyers.length > 0) {
            resetQueueEnrichment();
            await queueBuyers(failedBuyers.map(b => ({
              id: b.id,
              company_website: b.company_website,
              platform_website: b.platform_website,
              pe_firm_website: b.pe_firm_website
            })));
          }
        }}
      />
    </div>
  );
};

export default ReMarketingUniverseDetail;
