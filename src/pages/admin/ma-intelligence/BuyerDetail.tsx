import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Sparkles, Building2, FileText, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { IntelligenceBadge } from "@/components/ma-intelligence/IntelligenceBadge";
import { getIntelligenceCoverage, calculateIntelligencePercentage } from "@/lib/ma-intelligence/types";
import type { MABuyer } from "@/lib/ma-intelligence/types";

export default function BuyerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [buyer, setBuyer] = useState<MABuyer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (id) {
      loadBuyer();
    }
  }, [id]);

  const loadBuyer = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setBuyer(data as any);
    } catch (error: any) {
      toast({
        title: "Error loading buyer",
        description: error.message,
        variant: "destructive",
      });
      navigate("/admin/ma-intelligence/buyers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnrich = async () => {
    if (!buyer) return;

    try {
      await supabase.functions.invoke("enrich-buyer", {
        body: { buyer_id: buyer.id },
      });

      toast({
        title: "Enrichment started",
        description: "Buyer enrichment is running in the background",
      });

      setTimeout(() => {
        loadBuyer();
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Error enriching buyer",
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

  if (!buyer) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Buyer not found</h3>
          <Button onClick={() => navigate("/admin/ma-intelligence/buyers")}>
            Back to Buyers
          </Button>
        </div>
      </div>
    );
  }

  const coverage = getIntelligenceCoverage(buyer);
  const percentage = calculateIntelligencePercentage(buyer);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/ma-intelligence/buyers")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{buyer.pe_firm_name}</h1>
              {buyer.platform_company_name && (
                <p className="text-muted-foreground">
                  Platform: {buyer.platform_company_name}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IntelligenceBadge coverage={coverage} />
          <Badge variant="secondary">{percentage}% complete</Badge>
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
              {buyer.hq_city && buyer.hq_state
                ? `${buyer.hq_city}, ${buyer.hq_state}`
                : buyer.hq_state || "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue Sweet Spot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {buyer.revenue_sweet_spot
                ? `$${buyer.revenue_sweet_spot}M`
                : buyer.min_revenue || buyer.max_revenue
                ? `$${buyer.min_revenue || 0}M - $${buyer.max_revenue || "∞"}M`
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">EBITDA Sweet Spot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {buyer.ebitda_sweet_spot
                ? `$${buyer.ebitda_sweet_spot}M`
                : buyer.min_ebitda || buyer.max_ebitda
                ? `$${buyer.min_ebitda || 0}M - $${buyer.max_ebitda || "∞"}M`
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Acquisitions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {buyer.total_acquisitions || 0} total
              {buyer.acquisition_frequency && (
                <span className="text-muted-foreground ml-1">
                  • {buyer.acquisition_frequency}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="thesis">Investment Thesis</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="activity">Activity & History</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Business Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Business Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {buyer.business_summary || "No business summary available"}
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
                  <div className="text-sm font-medium">Industry Vertical</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.industry_vertical || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Services Offered</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.services_offered || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Target Services</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.target_services?.join(", ") || "—"}
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
                  <div className="text-sm font-medium">Business Type</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.business_type || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Revenue Model</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.revenue_model || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Business Model Preferences</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.business_model_prefs || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Exclusions</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.business_model_exclusions?.join(", ") || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio */}
          {buyer.portfolio_companies && buyer.portfolio_companies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Companies</CardTitle>
                <CardDescription>
                  {buyer.num_platforms} platform{(buyer.num_platforms || 0) !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {buyer.portfolio_companies.map((company, i) => (
                    <Badge key={i} variant="secondary">
                      {company}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="thesis" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Investment Thesis</CardTitle>
                  <CardDescription>Strategic priorities and acquisition criteria</CardDescription>
                </div>
                {buyer.thesis_confidence && (
                  <Badge
                    variant={
                      buyer.thesis_confidence === "High"
                        ? "default"
                        : buyer.thesis_confidence === "Medium"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {buyer.thesis_confidence} Confidence
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Thesis Summary</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {buyer.thesis_summary || "No thesis summary available"}
                </p>
              </div>

              {buyer.strategic_priorities && (
                <div>
                  <h4 className="font-medium mb-2">Strategic Priorities</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {buyer.strategic_priorities}
                  </p>
                </div>
              )}

              {buyer.deal_breakers && buyer.deal_breakers.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Deal Breakers</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {buyer.deal_breakers.map((breaker, i) => (
                      <li key={i}>• {breaker}</li>
                    ))}
                  </ul>
                </div>
              )}

              {buyer.key_quotes && buyer.key_quotes.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Key Quotes</h4>
                  <div className="space-y-2">
                    {buyer.key_quotes.map((quote, i) => (
                      <div key={i} className="border-l-2 border-primary pl-3 italic text-sm">
                        "{quote}"
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Size Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Size Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium">Revenue Range</div>
                  <div className="text-sm text-muted-foreground">
                    ${buyer.min_revenue || 0}M - ${buyer.max_revenue || "∞"}M
                    {buyer.revenue_sweet_spot && ` (sweet spot: $${buyer.revenue_sweet_spot}M)`}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">EBITDA Range</div>
                  <div className="text-sm text-muted-foreground">
                    ${buyer.min_ebitda || 0}M - ${buyer.max_ebitda || "∞"}M
                    {buyer.ebitda_sweet_spot && ` (sweet spot: $${buyer.ebitda_sweet_spot}M)`}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Preferred EBITDA</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.preferred_ebitda ? `$${buyer.preferred_ebitda}M` : "—"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Geographic Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Geographic Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium">Target Geographies</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.target_geographies?.join(", ") || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Geographic Footprint</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.geographic_footprint?.join(", ") || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Exclusions</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.geographic_exclusions?.join(", ") || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Owner Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Owner Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium">Owner Roll Requirement</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.owner_roll_requirement || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Transition Goals</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.owner_transition_goals || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Employee Owner Preference</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.employee_owner || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deal Structure */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deal Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Add-on Only</div>
                  <Badge variant={buyer.addon_only ? "default" : "outline"}>
                    {buyer.addon_only ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Platform Only</div>
                  <Badge variant={buyer.platform_only ? "default" : "outline"}>
                    {buyer.platform_only ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Fee Agreement</div>
                  <Badge
                    variant={
                      buyer.fee_agreement_status === "Active"
                        ? "default"
                        : buyer.fee_agreement_status === "Expired"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {buyer.fee_agreement_status || "None"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          {/* Recent Acquisitions */}
          {buyer.recent_acquisitions && buyer.recent_acquisitions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Acquisitions</CardTitle>
                <CardDescription>
                  Last acquisition: {buyer.last_acquisition_date || "Unknown"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {buyer.recent_acquisitions.map((acq, i) => (
                    <div key={i} className="border-l-2 pl-3 space-y-1">
                      <div className="font-medium">{acq.company}</div>
                      {acq.date && <div className="text-sm text-muted-foreground">{acq.date}</div>}
                      {acq.location && (
                        <div className="text-sm text-muted-foreground">{acq.location}</div>
                      )}
                      {acq.description && (
                        <div className="text-sm text-muted-foreground">{acq.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Call History */}
          {buyer.call_history && buyer.call_history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Call History</CardTitle>
                <CardDescription>
                  Last call: {buyer.last_call_date || "Unknown"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {buyer.call_history.map((call, i) => (
                    <div key={i} className="border-l-2 pl-3 space-y-1">
                      {call.date && <div className="text-sm font-medium">{call.date}</div>}
                      {call.notes && (
                        <div className="text-sm text-muted-foreground">{call.notes}</div>
                      )}
                      {call.url && (
                        <a
                          href={call.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          View transcript
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>Import contacts from CSV or add manually</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4" />
                <p>Contact management coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
