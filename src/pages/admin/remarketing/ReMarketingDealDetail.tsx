import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  ExternalLink,
  Globe,
  MapPin,
  Sparkles,
  Target,
  Users,
  History,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ScoreTierBadge, getTierFromScore } from "@/components/remarketing";
import { DealTranscriptSection } from "@/components/remarketing/DealTranscriptSection";
import {
  GeneralNotesSection,
  ExecutiveSummaryCard,
  ServicesBusinessModelCard,
  GeographicCoverageCard,
  OwnerGoalsCard,
  PrimaryContactCard,
  CustomerTypesCard,
  CompanyOverviewCard,
} from "@/components/remarketing/deal-detail";

const ReMarketingDealDetail = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isEnriching, setIsEnriching] = useState(false);

  // Fetch deal/listing data
  const { data: deal, isLoading: dealLoading } = useQuery({
    queryKey: ['remarketing', 'deal', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', dealId)
        .single();

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
      return data;
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
      deal.website,
      deal.executive_summary,
      deal.service_mix,
      deal.geographic_states,
    ];
    
    const filledFields = fields.filter(f => f !== null && f !== undefined && f !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const dataCompleteness = calculateDataCompleteness();

  // Handle website enrichment
  const handleEnrichFromWebsite = async () => {
    if (!deal) return;
    
    setIsEnriching(true);
    try {
      toast.info("Website enrichment feature coming soon");
    } catch (error) {
      toast.error("Failed to enrich from website");
    } finally {
      setIsEnriching(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "Not specified";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/remarketing/deals')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{deal.title}</h1>
            {deal.category && (
              <Badge variant="secondary">{deal.category}</Badge>
            )}
            <Badge variant={dataCompleteness >= 80 ? 'default' : 'outline'}>
              {dataCompleteness}% Data
            </Badge>
            <Badge variant={deal.status === 'active' ? 'default' : 'secondary'} className="capitalize">
              {deal.status}
            </Badge>
          </div>
          {deal.location && (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              {deal.location}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tier && <ScoreTierBadge tier={tier} size="lg" />}
        </div>
      </div>

      {/* Transcripts Section */}
      <DealTranscriptSection dealId={dealId!} transcripts={transcripts || []} isLoading={transcriptsLoading} />

      {/* General Notes Section */}
      <GeneralNotesSection
        notes={deal.general_notes}
        onSave={async (notes) => {
          await updateDealMutation.mutateAsync({ general_notes: notes });
        }}
        onAnalyze={async () => {
          toast.info("AI notes analysis coming soon");
        }}
      />

      {/* Actions Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            {deal.website && (
              <Button variant="outline" className="gap-2" asChild>
                <a href={deal.website.startsWith('http') ? deal.website : `https://${deal.website}`} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4" />
                  View Website
                </a>
              </Button>
            )}
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleEnrichFromWebsite}
              disabled={isEnriching}
            >
              {isEnriching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Enrich from Website
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <Link to={`/admin/remarketing/matching/${dealId}`}>
                <Target className="h-4 w-4" />
                View Buyer Matches ({scoreStats?.count || 0})
              </Link>
            </Button>
            <Button variant="outline" className="gap-2">
              <History className="h-4 w-4" />
              Buyer History
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout - Company & Financial */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CompanyOverviewCard
          website={deal.website}
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
          onSave={async (data) => {
            await updateDealMutation.mutateAsync({
              website: data.website,
              address: data.address,
              founded_year: data.foundedYear,
              industry: data.industry,
              number_of_locations: data.numberOfLocations,
              location_radius_requirement: data.locationRadiusRequirement,
            });
          }}
        />

        {/* Financial Overview */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Revenue</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatCurrency(deal.revenue)}</span>
                {deal.revenue && (
                  <Badge variant="outline" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">EBITDA</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatCurrency(deal.ebitda)}</span>
                {deal.ebitda && (
                  <Badge variant="outline" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">EBITDA Margin</span>
              <span className="font-medium">
                {deal.revenue && deal.ebitda 
                  ? `${((deal.ebitda / deal.revenue) * 100).toFixed(1)}%`
                  : 'Not calculable'
                }
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Custom Metric</span>
              <span className="font-medium">
                {deal.custom_metric_value || 'Not specified'}
                {deal.custom_metric_label && ` (${deal.custom_metric_label})`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

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
          businessModel={deal.business_model}
          onSave={async (data) => {
            await updateDealMutation.mutateAsync({
              service_mix: data.serviceMix,
              business_model: data.businessModel,
            });
          }}
        />

        <GeographicCoverageCard
          states={deal.geographic_states}
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

      {/* Primary Contact */}
      <PrimaryContactCard
        name={deal.primary_contact_name}
        email={deal.primary_contact_email}
        phone={deal.primary_contact_phone}
        onSave={async (data) => {
          await updateDealMutation.mutateAsync({
            primary_contact_name: data.name,
            primary_contact_email: data.email,
            primary_contact_phone: data.phone,
          });
        }}
      />

      {/* End Market / Customers */}
      <CustomerTypesCard
        customerTypes={deal.customer_types}
        onSave={async (types) => {
          await updateDealMutation.mutateAsync({ customer_types: types });
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

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground text-center space-x-4">
        <span>Created: {format(new Date(deal.created_at), 'MMM d, yyyy h:mm a')}</span>
        <span>Updated: {format(new Date(deal.updated_at), 'MMM d, yyyy h:mm a')}</span>
      </div>
    </div>
  );
};

export default ReMarketingDealDetail;
