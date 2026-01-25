import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  StructuredCriteriaPanel, 
  DocumentUploadSection,
  MAGuideEditor,
  UniverseTemplates,
  ScoringBehaviorPanelEnhanced,
  BuyerTableEnhanced,
  UniverseDealsTable,
  TargetBuyerTypesPanel,
  IndustryKPIPanel,
  BuyerTableToolbar,
  AddDealToUniverseDialog,
  DealCSVImport,
  BuyerFitCriteriaDialog,
  TrackerNotesSection,
  AIResearchSection,
  CriteriaValidationAlert
} from "@/components/remarketing";
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
  LayoutTemplate,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Clock,
  Pencil,
  TrendingUp,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Default buyer types configuration
const DEFAULT_BUYER_TYPES: TargetBuyerTypeConfig[] = [
  { id: 'large_mso', rank: 1, name: 'Large MSOs', description: 'Multi-state operators with 50+ locations seeking add-on acquisitions.', locations_min: 50, locations_max: 500, revenue_per_location: 2500000, deal_requirements: 'Prefer deals with $2M+ revenue', enabled: true },
  { id: 'regional_mso', rank: 2, name: 'Regional MSOs', description: 'Regional operators with 10-50 locations expanding within their footprint.', locations_min: 10, locations_max: 50, revenue_per_location: 2000000, deal_requirements: 'Looking for tuck-in acquisitions', enabled: true },
  { id: 'pe_backed', rank: 3, name: 'PE-Backed Platforms', description: 'Private equity portfolio companies actively deploying capital.', locations_min: 5, locations_max: 100, revenue_per_location: 1500000, deal_requirements: 'Need clean financials', enabled: true },
  { id: 'independent_sponsor', rank: 4, name: 'Independent Sponsors', description: 'Dealmakers with committed capital seeking platform investments.', locations_min: 1, locations_max: 10, revenue_per_location: 1000000, deal_requirements: 'Flexible on structure', enabled: true },
  { id: 'small_local', rank: 5, name: 'Small Local Buyers', description: 'Owner-operators looking to expand from 1-5 locations.', locations_min: 1, locations_max: 5, revenue_per_location: 800000, deal_requirements: 'Often need SBA financing', enabled: true },
  { id: 'local_strategic', rank: 6, name: 'Local Strategics', description: 'Established local businesses seeking adjacent market expansion.', locations_min: 2, locations_max: 15, revenue_per_location: 1200000, deal_requirements: 'Looking for synergies', enabled: true },
];

const ReMarketingUniverseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

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
  const [targetBuyerTypes, setTargetBuyerTypes] = useState<TargetBuyerTypeConfig[]>(DEFAULT_BUYER_TYPES);
  const [industryKPIs, setIndustryKPIs] = useState<{ id: string; name: string; weight: number; threshold_min?: number; threshold_max?: number; unit?: string; description?: string }[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [buyerFitOpen, setBuyerFitOpen] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [addDealDialogOpen, setAddDealDialogOpen] = useState(false);
  const [addDealDefaultTab, setAddDealDefaultTab] = useState<'existing' | 'new'>('existing');
  const [importDealsDialogOpen, setImportDealsDialogOpen] = useState(false);
  const [isScoringAllDeals, setIsScoringAllDeals] = useState(false);
  const [isEnrichingAllDeals, setIsEnrichingAllDeals] = useState(false);
  const [showCriteriaEdit, setShowCriteriaEdit] = useState(false);

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
  const { data: buyers } = useQuery({
    queryKey: ['remarketing', 'buyers', 'universe', id],
    queryFn: async () => {
      if (isNew) return [];
      
      const { data, error } = await supabase
        .from('remarketing_buyers')
        .select('id, company_name, company_website, buyer_type, pe_firm_name, hq_city, hq_state, thesis_summary, data_completeness, target_geographies, geographic_footprint')
        .eq('universe_id', id)
        .eq('archived', false)
        .order('company_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !isNew
  });

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
            id, title, location, revenue, ebitda, 
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
    }
  }, [universe]);

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
        ma_guide_content: maGuideContent
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

  const totalWeight = formData.geography_weight + formData.size_weight + 
    formData.service_weight + formData.owner_goals_weight;

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

      {/* Scoring Behavior Accordion */}
      {!isNew && (
        <ScoringBehaviorPanelEnhanced
          scoringBehavior={scoringBehavior}
          weights={{
            geography: formData.geography_weight,
            size: formData.size_weight,
            service: formData.service_weight,
            ownerGoals: formData.owner_goals_weight,
          }}
          onScoringBehaviorChange={setScoringBehavior}
          onWeightsChange={(weights) => setFormData(prev => ({
            ...prev,
            geography_weight: weights.geography,
            size_weight: weights.size,
            service_weight: weights.service,
            owner_goals_weight: weights.ownerGoals,
          }))}
          onSave={() => saveMutation.mutate()}
          readOnly={false}
        />
      )}

      {/* Buyer Fit Criteria Accordion */}
      {!isNew && (
        <Collapsible open={buyerFitOpen} onOpenChange={setBuyerFitOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">Buyer Fit Criteria</CardTitle>
                    <Badge variant="secondary" className="ml-2">
                      {targetBuyerTypes.filter(t => t.enabled).length} types
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCriteriaEdit(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {buyerFitOpen ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-6">
                {/* Target Buyer Types */}
                <TargetBuyerTypesPanel
                  buyerTypes={targetBuyerTypes}
                  onBuyerTypesChange={setTargetBuyerTypes}
                />

                {/* Additional Criteria Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Size Criteria Card */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Size Criteria</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Revenue:</span>
                        <span>{sizeCriteria.revenue_min ? `$${(sizeCriteria.revenue_min/1000000).toFixed(1)}M` : '-'} - {sizeCriteria.revenue_max ? `$${(sizeCriteria.revenue_max/1000000).toFixed(1)}M` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">EBITDA:</span>
                        <span>{sizeCriteria.ebitda_min ? `$${(sizeCriteria.ebitda_min/1000000).toFixed(1)}M` : '-'} - {sizeCriteria.ebitda_max ? `$${(sizeCriteria.ebitda_max/1000000).toFixed(1)}M` : '-'}</span>
                      </div>
                      {sizeCriteria.locations_min !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Locations:</span>
                          <span>{sizeCriteria.locations_min} - {sizeCriteria.locations_max || '∞'}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Service Criteria Card */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Service / Product Mix</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      {serviceCriteria.required_services && serviceCriteria.required_services.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {serviceCriteria.required_services.slice(0, 3).map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                          {serviceCriteria.required_services.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{serviceCriteria.required_services.length - 3}</Badge>
                          )}
                        </div>
                      )}
                      {serviceCriteria.excluded_services && serviceCriteria.excluded_services.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {serviceCriteria.excluded_services.slice(0, 2).map((s, i) => (
                            <Badge key={i} variant="destructive" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      )}
                      {serviceCriteria.business_model && (
                        <div className="text-xs text-muted-foreground">Model: {serviceCriteria.business_model}</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Geography Criteria Card */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Geography</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      {geographyCriteria.target_regions && geographyCriteria.target_regions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {geographyCriteria.target_regions.map((r, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                          ))}
                        </div>
                      )}
                      {geographyCriteria.coverage && (
                        <div className="text-xs text-muted-foreground capitalize">Coverage: {geographyCriteria.coverage}</div>
                      )}
                      {geographyCriteria.hq_requirements && (
                        <div className="text-xs text-muted-foreground line-clamp-2">{geographyCriteria.hq_requirements}</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Criteria Validation Alert */}
      {!isNew && (
        <CriteriaValidationAlert
          sizeCriteria={sizeCriteria}
          geographyCriteria={geographyCriteria}
          serviceCriteria={serviceCriteria}
          buyerTypesCriteria={buyerTypesCriteria}
          scoringBehavior={scoringBehavior}
        />
      )}

      {/* Quick Import from Notes */}
      {!isNew && id && (
        <TrackerNotesSection
          universeName={formData.name}
          onApplyCriteria={(criteria) => {
            if (criteria.size_criteria) setSizeCriteria(prev => ({ ...prev, ...criteria.size_criteria }));
            if (criteria.geography_criteria) setGeographyCriteria(prev => ({ ...prev, ...criteria.geography_criteria }));
            if (criteria.service_criteria) setServiceCriteria(prev => ({ ...prev, ...criteria.service_criteria }));
            if (criteria.buyer_types_criteria) setBuyerTypesCriteria(prev => ({ ...prev, ...criteria.buyer_types_criteria }));
            if (criteria.scoring_behavior) setScoringBehavior(prev => ({ ...prev, ...criteria.scoring_behavior }));
            toast.success('Criteria extracted and applied');
          }}
        />
      )}

      {/* AI Research M&A Guide Generation */}
      {!isNew && id && (
        <AIResearchSection
          universeName={formData.name}
          existingContent={maGuideContent}
          onGuideGenerated={(guide, extractedCriteria) => {
            setMaGuideContent(guide);
            if (extractedCriteria) {
              if (extractedCriteria.size_criteria) setSizeCriteria(prev => ({ ...prev, ...extractedCriteria.size_criteria }));
              if (extractedCriteria.geography_criteria) setGeographyCriteria(prev => ({ ...prev, ...extractedCriteria.geography_criteria }));
              if (extractedCriteria.service_criteria) setServiceCriteria(prev => ({ ...prev, ...extractedCriteria.service_criteria }));
              if (extractedCriteria.buyer_types_criteria) setBuyerTypesCriteria(prev => ({ ...prev, ...extractedCriteria.buyer_types_criteria }));
            }
            toast.success('M&A Guide generated and criteria extracted');
          }}
        />
      )}

      {/* Supporting Documents */}
      {!isNew && id && (
        <DocumentUploadSection
          universeId={id}
          documents={documents}
          onDocumentsChange={setDocuments}
        />
      )}

      {/* Industry KPI */}
      {!isNew && id && (
        <IndustryKPIPanel 
          kpis={industryKPIs}
          onKPIsChange={setIndustryKPIs}
        />
      )}

      {/* Buyers/Deals Tabs */}
      {!isNew && (
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
                />
              </CardHeader>
              <CardContent className="p-0">
                <BuyerTableEnhanced
                  buyers={filteredBuyers}
                  showPEColumn={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {universeDeals?.length || 0} deals
                    </span>
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
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        if (!universeDeals?.length) {
                          toast.error('No deals to enrich');
                          return;
                        }
                        setIsEnrichingAllDeals(true);
                        try {
                          let enriched = 0;
                          for (const deal of universeDeals) {
                            if (deal.listing?.id && !deal.listing.enriched_at) {
                              await supabase.functions.invoke('enrich-deal', {
                                body: { dealId: deal.listing.id }
                              });
                              enriched++;
                            }
                          }
                          toast.success(`Enriched ${enriched} deals`);
                          refetchDeals();
                        } catch (error) {
                          toast.error('Failed to enrich deals');
                        } finally {
                          setIsEnrichingAllDeals(false);
                        }
                      }}
                      disabled={isEnrichingAllDeals || !universeDeals?.length}
                    >
                      {isEnrichingAllDeals ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      Enrich All Deals
                    </Button>
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
                        body: { listingId, universeId: id }
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
    </div>
  );
};

export default ReMarketingUniverseDetail;
