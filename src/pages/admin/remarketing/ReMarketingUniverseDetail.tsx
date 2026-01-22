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
  UniverseTemplates
} from "@/components/remarketing";
import { 
  SizeCriteria, 
  GeographyCriteria, 
  ServiceCriteria, 
  BuyerTypesCriteria,
  ScoringBehavior,
  DocumentReference
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
  SlidersHorizontal,
  BookOpen,
  LayoutTemplate
} from "lucide-react";
import { toast } from "sonner";

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
  const [isParsing, setIsParsing] = useState(false);

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
        .select('*')
        .eq('universe_id', id)
        .eq('archived', false)
        .order('company_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !isNew
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
      // Load structured criteria from JSONB columns
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
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? 'New Universe' : formData.name || 'Universe'}
            </h1>
            <p className="text-muted-foreground">
              {isNew ? 'Create a new buyer universe' : 'Edit universe settings and criteria'}
            </p>
          </div>
        </div>
        <Button 
          onClick={() => saveMutation.mutate()}
          disabled={!formData.name || saveMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <Tabs defaultValue={isNew ? "templates" : "details"} className="space-y-6">
        <TabsList className="flex-wrap">
          {isNew && (
            <TabsTrigger value="templates">
              <LayoutTemplate className="mr-2 h-4 w-4" />
              Templates
            </TabsTrigger>
          )}
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
          {!isNew && (
            <TabsTrigger value="buyers">
              <Users className="mr-2 h-4 w-4" />
              Buyers ({buyers?.length || 0})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Templates Tab (New Universe Only) */}
        {isNew && (
          <TabsContent value="templates">
            <UniverseTemplates onApplyTemplate={handleApplyTemplate} />
          </TabsContent>
        )}

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
                    placeholder="Describe your ideal buyer fit criteria in natural language. For example: 'PE firms focused on home services with existing HVAC or plumbing platforms, targeting $5M-$30M revenue businesses in the Southeast...'"
                    value={formData.fit_criteria}
                    onChange={(e) => setFormData({ ...formData, fit_criteria: e.target.value })}
                    rows={6}
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter criteria above then click "AI Parse" to auto-fill structured fields below
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Structured Criteria */}
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
                <div className="flex items-center justify-between">
                  <Label>Geography ({formData.geography_weight}%)</Label>
                </div>
                <Slider
                  value={[formData.geography_weight]}
                  onValueChange={([value]) => setFormData({ ...formData, geography_weight: value })}
                  max={100}
                  step={5}
                />
                <p className="text-sm text-muted-foreground">
                  How important is geographic overlap between buyer presence and deal location?
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Size Fit ({formData.size_weight}%)</Label>
                </div>
                <Slider
                  value={[formData.size_weight]}
                  onValueChange={([value]) => setFormData({ ...formData, size_weight: value })}
                  max={100}
                  step={5}
                />
                <p className="text-sm text-muted-foreground">
                  How important is revenue/EBITDA fit with buyer's target range?
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Service Mix ({formData.service_weight}%)</Label>
                </div>
                <Slider
                  value={[formData.service_weight]}
                  onValueChange={([value]) => setFormData({ ...formData, service_weight: value })}
                  max={100}
                  step={5}
                />
                <p className="text-sm text-muted-foreground">
                  How important is service/industry alignment?
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Owner Goals ({formData.owner_goals_weight}%)</Label>
                </div>
                <Slider
                  value={[formData.owner_goals_weight]}
                  onValueChange={([value]) => setFormData({ ...formData, owner_goals_weight: value })}
                  max={100}
                  step={5}
                />
                <p className="text-sm text-muted-foreground">
                  How important is alignment with owner's exit goals?
                </p>
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
          <div className="space-y-6">
            <MAGuideEditor
              content={maGuideContent}
              onChange={setMaGuideContent}
              universeName={formData.name}
              fitCriteria={formData.fit_criteria}
            />
            {!isNew && id && (
              <DocumentUploadSection
                universeId={id}
                documents={documents}
                onDocumentsChange={setDocuments}
              />
            )}
          </div>
        </TabsContent>

        {/* Buyers Tab */}
        {!isNew && (
          <TabsContent value="buyers">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Buyers in Universe</CardTitle>
                    <CardDescription>
                      {buyers?.length || 0} buyers assigned to this universe
                    </CardDescription>
                  </div>
                  <Button asChild>
                    <Link to="/admin/remarketing/buyers">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Buyers
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {buyers?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No buyers in this universe yet</p>
                    <Button variant="link" asChild className="mt-2">
                      <Link to="/admin/remarketing/buyers">Import buyers</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {buyers?.map((buyer) => (
                      <div key={buyer.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{buyer.company_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {buyer.buyer_type?.replace('_', ' ') || 'Unknown type'}
                          </p>
                        </div>
                        <Badge variant={
                          buyer.data_completeness === 'high' ? 'default' :
                          buyer.data_completeness === 'medium' ? 'secondary' :
                          'outline'
                        }>
                          {buyer.data_completeness || 'low'} data
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default ReMarketingUniverseDetail;
