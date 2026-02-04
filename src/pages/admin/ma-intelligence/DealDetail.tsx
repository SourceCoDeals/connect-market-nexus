import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Sparkles, Building2, DollarSign, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DealScoreBadge } from "@/components/ma-intelligence";
import type { MADeal } from "@/lib/ma-intelligence/types";

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deal, setDeal] = useState<MADeal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (id) {
      loadDeal();
    }
  }, [id]);

  const loadDeal = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setDeal(data as any);
    } catch (error: any) {
      toast({
        title: "Error loading deal",
        description: error.message,
        variant: "destructive",
      });
      navigate("/admin/ma-intelligence/deals");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnrich = async () => {
    if (!deal) return;

    try {
      await supabase.functions.invoke("enrich-deal", {
        body: { dealId: deal.id },
      });

      toast({
        title: "Enrichment started",
        description: "Deal enrichment is running in the background",
      });

      setTimeout(() => {
        loadDeal();
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Error enriching deal",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Deal not found</h3>
          <Button onClick={() => navigate("/admin/ma-intelligence/deals")}>
            Back to Deals
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/ma-intelligence/deals")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{deal.deal_name}</h1>
              {deal.company_website && (
                <p className="text-muted-foreground">{deal.company_website}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={deal.status === "active" ? "default" : "secondary"}>
            {deal.status || "Unknown"}
          </Badge>
          {deal.deal_score !== null && deal.deal_score !== undefined && (
            <DealScoreBadge score={deal.deal_score} />
          )}
          <Button variant="outline" onClick={handleEnrich}>
            <Sparkles className="w-4 h-4 mr-2" />
            Enrich
          </Button>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {deal.headquarters || "—"}
              {deal.location_count && (
                <div className="text-xs text-muted-foreground mt-1">
                  {deal.location_count} location{deal.location_count !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {deal.revenue
                ? `$${deal.revenue >= 1000000 ? `${(deal.revenue / 1000000).toFixed(1)}M` : `${(deal.revenue / 1000).toFixed(0)}K`}`
                : "—"}
              {deal.revenue_confidence && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {deal.revenue_confidence}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">EBITDA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {deal.ebitda_amount
                ? `$${deal.ebitda_amount >= 1000000 ? `${(deal.ebitda_amount / 1000000).toFixed(1)}M` : `${(deal.ebitda_amount / 1000).toFixed(0)}K`}`
                : deal.ebitda_percentage
                ? `${deal.ebitda_percentage}%`
                : "—"}
              {deal.ebitda_confidence && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {deal.ebitda_confidence}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {deal.employee_count || "—"}
              {deal.founded_year && (
                <div className="text-xs text-muted-foreground mt-1">
                  Founded: {deal.founded_year}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="matches">Buyer Matches</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Company Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Company Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {deal.company_overview || "No company overview available"}
              </p>
            </CardContent>
          </Card>

          {/* Key Details Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Industry & Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm font-medium">Industry Type</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.industry_type || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Service Mix</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.service_mix || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm font-medium">Business Model</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.business_model || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Ownership Structure</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.ownership_structure || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Geography */}
          {deal.geography && deal.geography.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Geographic Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {deal.geography.map((location, i) => (
                    <Badge key={i} variant="secondary">
                      <MapPin className="w-3 h-3 mr-1" />
                      {location}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="financials" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium">Amount</div>
                  <div className="text-2xl font-bold">
                    {deal.revenue
                      ? `$${deal.revenue >= 1000000 ? `${(deal.revenue / 1000000).toFixed(1)}M` : `${(deal.revenue / 1000).toFixed(0)}K`}`
                      : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deal.revenue_confidence && (
                    <Badge variant="outline">{deal.revenue_confidence} confidence</Badge>
                  )}
                  {deal.revenue_is_inferred && (
                    <Badge variant="secondary">Inferred</Badge>
                  )}
                </div>
                {deal.revenue_source_quote && (
                  <div className="text-sm border-l-2 border-primary pl-3 italic">
                    "{deal.revenue_source_quote}"
                  </div>
                )}
              </CardContent>
            </Card>

            {/* EBITDA Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">EBITDA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium">Amount</div>
                  <div className="text-2xl font-bold">
                    {deal.ebitda_amount
                      ? `$${deal.ebitda_amount >= 1000000 ? `${(deal.ebitda_amount / 1000000).toFixed(1)}M` : `${(deal.ebitda_amount / 1000).toFixed(0)}K`}`
                      : deal.ebitda_percentage
                      ? `${deal.ebitda_percentage}% margin`
                      : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deal.ebitda_confidence && (
                    <Badge variant="outline">{deal.ebitda_confidence} confidence</Badge>
                  )}
                  {deal.ebitda_is_inferred && (
                    <Badge variant="secondary">Inferred</Badge>
                  )}
                </div>
                {deal.ebitda_source_quote && (
                  <div className="text-sm border-l-2 border-primary pl-3 italic">
                    "{deal.ebitda_source_quote}"
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Financial Notes */}
          {deal.financial_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Financial Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{deal.financial_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Follow-up Questions */}
          {deal.financial_followup_questions && deal.financial_followup_questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Financial Follow-up Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {deal.financial_followup_questions.map((question, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Customer Base */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer Base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm font-medium">End Market Customers</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.end_market_customers || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Customer Geography</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.customer_geography || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Customer Concentration</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.customer_concentration || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Operational Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm font-medium">Technology Systems</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.technology_systems || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Real Estate</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.real_estate || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Growth Trajectory</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.growth_trajectory || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Risks */}
          {deal.key_risks && deal.key_risks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key Risks</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {deal.key_risks.map((risk, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-destructive">⚠</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Competitive Position */}
          {deal.competitive_position && (
            <Card>
              <CardHeader>
                <CardTitle>Competitive Position</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{deal.competitive_position}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium">Contact Name</div>
                <div className="text-sm text-muted-foreground">
                  {deal.contact_name || "—"}
                </div>
              </div>
              {deal.contact_title && (
                <div>
                  <div className="text-sm font-medium">Title</div>
                  <div className="text-sm text-muted-foreground">{deal.contact_title}</div>
                </div>
              )}
              {deal.contact_email && (
                <div>
                  <div className="text-sm font-medium">Email</div>
                  <a
                    href={`mailto:${deal.contact_email}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {deal.contact_email}
                  </a>
                </div>
              )}
              {deal.contact_phone && (
                <div>
                  <div className="text-sm font-medium">Phone</div>
                  <a
                    href={`tel:${deal.contact_phone}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {deal.contact_phone}
                  </a>
                </div>
              )}
              {deal.contact_linkedin && (
                <div>
                  <div className="text-sm font-medium">LinkedIn</div>
                  <a
                    href={deal.contact_linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View Profile
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Owner Goals */}
          {deal.owner_goals && (
            <Card>
              <CardHeader>
                <CardTitle>Owner Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{deal.owner_goals}</p>
              </CardContent>
            </Card>
          )}

          {/* Special Requirements */}
          {deal.special_requirements && (
            <Card>
              <CardHeader>
                <CardTitle>Special Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{deal.special_requirements}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buyer Matches</CardTitle>
              <CardDescription>
                Top scoring buyers for this deal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4" />
                <p>Buyer matching scores will appear here</p>
                <Button variant="outline" className="mt-4">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Score Against Buyers
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
