import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipInput } from "@/components/ui/chip-input";
import {
  Loader2,
  ArrowLeft,
  Sparkles,
  MoreVertical,
  Archive,
  Trash2,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { IntelligenceBadge } from "@/components/ma-intelligence";
import { getIntelligenceCoverage, calculateIntelligencePercentage } from "@/lib/ma-intelligence/types";
import type { MABuyer } from "@/lib/ma-intelligence/types";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import { BuyerDealHistoryTab } from "@/components/ma-intelligence/BuyerDealHistoryTab";
import { BuyerContactsTab } from "@/components/ma-intelligence/BuyerContactsTab";
import { BuyerActivitySection } from "@/components/ma-intelligence/BuyerActivitySection";
import { BuyerAgreementsPanel } from "@/components/ma-intelligence/BuyerAgreementsPanel";
import { PassReasonDialog } from "@/components/ma-intelligence/PassReasonDialog";
import { BuyerNotesSection } from "@/components/remarketing/buyer-detail/BuyerNotesSection";

export default function BuyerDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("dealId");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [buyer, setBuyer] = useState<MABuyer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isPassDialogOpen, setIsPassDialogOpen] = useState(false);
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState<Partial<MABuyer>>({});

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
      const buyerData = data as any as MABuyer;
      setBuyer(buyerData);
      setFormData(buyerData);
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
      const { queueBuyerEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueBuyerEnrichment([buyer.id]);

      toast({
        title: "Enrichment started",
        description: "Buyer enrichment is running in the background",
      });

      // Data will refresh via queue polling; do a deferred reload as fallback
      setTimeout(loadBuyer, 5000);
    } catch (error: any) {
      toast({
        title: "Error enriching buyer",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleArchive = async () => {
    if (!buyer) return;
    if (!confirm("Are you sure you want to archive this buyer?")) return;

    try {
      const { error } = await supabase
        .from("remarketing_buyers")
        .update({ archived: true })
        .eq("id", buyer.id);

      if (error) throw error;

      toast({
        title: "Buyer archived",
        description: "The buyer has been archived successfully",
      });

      navigate("/admin/ma-intelligence/buyers");
    } catch (error: any) {
      toast({
        title: "Error archiving buyer",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!buyer) return;
    if (!confirm("Are you sure you want to delete this buyer? This action cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("remarketing_buyers")
        .delete()
        .eq("id", buyer.id);

      if (error) throw error;

      toast({
        title: "Buyer deleted",
        description: "The buyer has been deleted successfully",
      });

      navigate("/admin/ma-intelligence/buyers");
    } catch (error: any) {
      toast({
        title: "Error deleting buyer",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveForDeal = async () => {
    if (!buyer || !dealId) return;

    try {
      // Check if a score record exists
      const { data: existingScore } = await supabase
        .from("buyer_deal_scores")
        .select("id")
        .eq("buyer_id", buyer.id)
        .eq("deal_id", dealId)
        .single();

      if (existingScore) {
        // Update existing record
        const { error } = await supabase
          .from("buyer_deal_scores")
          .update({ selected_for_outreach: true })
          .eq("id", existingScore.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase.from("buyer_deal_scores").insert({
          buyer_id: buyer.id,
          deal_id: dealId,
          selected_for_outreach: true,
          scored_at: new Date().toISOString(),
        });

        if (error) throw error;
      }

      toast({
        title: "Buyer approved",
        description: "This buyer has been approved for the deal",
      });
    } catch (error: any) {
      toast({
        title: "Error approving buyer",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveSection = async (section: string) => {
    if (!buyer) return;

    try {
      // Extract only schema-compatible fields to avoid type errors
      const updateData: Record<string, unknown> = {};
      const schemaFields = [
        'pe_firm_name', 'pe_firm_website', 'pe_firm_linkedin', 'platform_company_name',
        'platform_website', 'buyer_linkedin', 'hq_city', 'hq_state', 'hq_country',
        'hq_region', 'other_office_locations', 'business_summary', 'industry_vertical',
        'business_type', 'services_offered', 'business_model', 'revenue_model',
        'go_to_market_strategy', 'num_platforms', 'total_acquisitions',
        'last_acquisition_date', 'acquisition_frequency', 'acquisition_appetite',
        'acquisition_timeline', 'min_revenue', 'max_revenue',
        'min_ebitda', 'max_ebitda', 'preferred_ebitda',
        'target_geographies', 'geographic_footprint', 'geographic_exclusions',
        'acquisition_geography', 'service_regions', 'target_services', 'target_industries',
        'industry_exclusions', 'thesis_summary', 'thesis_confidence',
        'service_mix_prefs', 'business_model_prefs',
        'addon_only', 'platform_only', 'has_fee_agreement', 'fee_agreement_status'
      ];
      
      for (const key of schemaFields) {
        if (key in formData) {
          updateData[key] = (formData as Record<string, unknown>)[key];
        }
      }

      const { error } = await supabase
        .from("remarketing_buyers")
        .update(updateData)
        .eq("id", buyer.id);

      if (error) throw error;

      toast({
        title: "Changes saved",
        description: "Buyer information has been updated successfully",
      });

      setEditingSection(null);
      loadBuyer();
    } catch (error: any) {
      toast({
        title: "Error saving changes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = (section: string) => {
    setEditingSection(null);
    setFormData(buyer || {});
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
              <h1 className="text-2xl font-bold">
                {buyer.platform_company_name || buyer.pe_firm_name}
              </h1>
              {buyer.platform_company_name && (
                <p className="text-muted-foreground">
                  PE Firm: {buyer.pe_firm_name}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IntelligenceBadge coverage={coverage} />
          <Badge variant="secondary">{percentage}% complete</Badge>
          {buyer.fee_agreement_status && (
            <Badge
              variant={
                buyer.fee_agreement_status === "Active"
                  ? "default"
                  : buyer.fee_agreement_status === "Expired"
                  ? "secondary"
                  : "outline"
              }
            >
              {buyer.fee_agreement_status}
            </Badge>
          )}
          {buyer.addon_only && <Badge variant="outline">Add-on Only</Badge>}
          {buyer.platform_only && <Badge variant="outline">Platform Only</Badge>}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="w-4 h-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEnrich}>
                <Sparkles className="w-4 h-4 mr-2" />
                Enrich Buyer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="w-4 h-4 mr-2" />
                Archive Buyer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Buyer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Deal Context Banner */}
      {dealId && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Viewing in deal context</span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleApproveForDeal}>
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve for this Deal
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPassDialogOpen(true)}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Pass on this Deal
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
            <CardTitle className="text-sm font-medium">Revenue Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {buyer.min_revenue || buyer.max_revenue
                ? `$${buyer.min_revenue || 0}M - $${buyer.max_revenue || "∞"}M`
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">EBITDA Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {buyer.min_ebitda || buyer.max_ebitda
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
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="deal-history">Deal History</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* General Notes Section */}
          <BuyerNotesSection
            notes={buyer.notes}
            onSave={async (notes) => {
              try {
                const { error } = await supabase
                  .from('remarketing_buyers')
                  .update({ notes })
                  .eq('id', buyer.id);

                if (error) throw error;
                setBuyer({ ...buyer, notes });
              } catch (error: any) {
                throw new Error(error.message || 'Failed to save notes');
              }
            }}
            isAnalyzing={isAnalyzingNotes}
            onAnalyze={async (notes) => {
              setIsAnalyzingNotes(true);
              try {
                const { data, error } = await supabase.functions.invoke('analyze-buyer-notes', {
                  body: { buyerId: buyer.id, notesText: notes }
                });

                if (error) throw error;

                if (data?.success) {
                  toast({
                    title: "Notes analyzed successfully",
                    description: `Extracted ${data.fieldsUpdated?.length || 0} fields from notes`,
                  });
                  loadBuyer();
                } else {
                  throw new Error(data?.error || "Failed to analyze notes");
                }
              } catch (error: any) {
                toast({
                  title: "Error analyzing notes",
                  description: error.message || "Failed to analyze notes",
                  variant: "destructive",
                });
              } finally {
                setIsAnalyzingNotes(false);
              }
            }}
          />

          {/* Business Summary Section */}
          <BuyerDataSection
            title="Business Summary"
            description="Core business information and overview"
            isEditing={editingSection === "business"}
            onEdit={() => setEditingSection("business")}
            onSave={() => handleSaveSection("business")}
            onCancel={() => handleCancelEdit("business")}
          >
            {editingSection === "business" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Business Summary</Label>
                  <Textarea
                    value={formData.business_summary || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, business_summary: e.target.value })
                    }
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Industry Vertical</Label>
                  <Input
                    value={formData.industry_vertical || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, industry_vertical: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Services Offered</Label>
                  <Textarea
                    value={formData.services_offered || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, services_offered: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Model</Label>
                  <Textarea
                    value={formData.business_model || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, business_model: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Business Summary</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {buyer.business_summary || "No business summary available"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Industry Vertical</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.industry_vertical || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Services Offered</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.services_offered || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Business Model</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.business_model || "—"}
                  </div>
                </div>
              </div>
            )}
          </BuyerDataSection>

          {/* Thesis & Preferences Section */}
          <BuyerDataSection
            title="Thesis & Preferences"
            description="Investment thesis and strategic preferences"
            isEditing={editingSection === "thesis"}
            onEdit={() => setEditingSection("thesis")}
            onSave={() => handleSaveSection("thesis")}
            onCancel={() => handleCancelEdit("thesis")}
          >
            {editingSection === "thesis" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Thesis Summary</Label>
                  <Textarea
                    value={formData.thesis_summary || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, thesis_summary: e.target.value })
                    }
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Thesis Confidence</Label>
                  <Select
                    value={formData.thesis_confidence || ""}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, thesis_confidence: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select confidence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Service Mix Preferences</Label>
                  <Textarea
                    value={formData.service_mix_prefs || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, service_mix_prefs: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Services</Label>
                  <ChipInput
                    value={formData.target_services || []}
                    onChange={(value) =>
                      setFormData({ ...formData, target_services: value })
                    }
                    placeholder="Add service and press Enter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Required Capabilities</Label>
                  <ChipInput
                    value={formData.required_capabilities || []}
                    onChange={(value) =>
                      setFormData({ ...formData, required_capabilities: value })
                    }
                    placeholder="Add capability and press Enter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Industries</Label>
                  <ChipInput
                    value={formData.target_industries || []}
                    onChange={(value) =>
                      setFormData({ ...formData, target_industries: value })
                    }
                    placeholder="Add industry and press Enter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Industry Exclusions</Label>
                  <ChipInput
                    value={formData.industry_exclusions || []}
                    onChange={(value) =>
                      setFormData({ ...formData, industry_exclusions: value })
                    }
                    placeholder="Add exclusion and press Enter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Model Preferences</Label>
                  <Textarea
                    value={formData.business_model_prefs || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, business_model_prefs: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Model Exclusions</Label>
                  <ChipInput
                    value={formData.business_model_exclusions || []}
                    onChange={(value) =>
                      setFormData({ ...formData, business_model_exclusions: value })
                    }
                    placeholder="Add exclusion and press Enter"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium mb-1">Thesis Summary</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {buyer.thesis_summary || "No thesis summary available"}
                    </div>
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
                <div>
                  <div className="text-sm font-medium mb-1">Service Mix Preferences</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.service_mix_prefs || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Target Services</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.target_services && buyer.target_services.length > 0 ? (
                      buyer.target_services.map((service, i) => (
                        <Badge key={i} variant="secondary">
                          {service}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Required Capabilities</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.required_capabilities && buyer.required_capabilities.length > 0 ? (
                      buyer.required_capabilities.map((cap, i) => (
                        <Badge key={i} variant="secondary">
                          {cap}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Target Industries</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.target_industries && buyer.target_industries.length > 0 ? (
                      buyer.target_industries.map((ind, i) => (
                        <Badge key={i} variant="secondary">
                          {ind}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Industry Exclusions</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.industry_exclusions && buyer.industry_exclusions.length > 0 ? (
                      buyer.industry_exclusions.map((exc, i) => (
                        <Badge key={i} variant="outline">
                          {exc}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Business Model Preferences</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.business_model_prefs || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Business Model Exclusions</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.business_model_exclusions &&
                    buyer.business_model_exclusions.length > 0 ? (
                      buyer.business_model_exclusions.map((exc, i) => (
                        <Badge key={i} variant="outline">
                          {exc}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </BuyerDataSection>

          {/* Size Criteria Section */}
          <BuyerDataSection
            title="Size Criteria"
            description="Revenue and EBITDA preferences"
            isEditing={editingSection === "size"}
            onEdit={() => setEditingSection("size")}
            onSave={() => handleSaveSection("size")}
            onCancel={() => handleCancelEdit("size")}
          >
            {editingSection === "size" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Revenue ($M)</Label>
                  <Input
                    type="number"
                    value={formData.min_revenue || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_revenue: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Revenue ($M)</Label>
                  <Input
                    type="number"
                    value={formData.max_revenue || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_revenue: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min EBITDA ($M)</Label>
                  <Input
                    type="number"
                    value={formData.min_ebitda || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_ebitda: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max EBITDA ($M)</Label>
                  <Input
                    type="number"
                    value={formData.max_ebitda || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_ebitda: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Preferred EBITDA ($M)</Label>
                  <Input
                    type="number"
                    value={formData.preferred_ebitda || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferred_ebitda: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">Revenue Range</div>
                  <div className="text-sm text-muted-foreground">
                    ${buyer.min_revenue || 0}M - ${buyer.max_revenue || "∞"}M
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">EBITDA Range</div>
                  <div className="text-sm text-muted-foreground">
                    ${buyer.min_ebitda || 0}M - ${buyer.max_ebitda || "∞"}M
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Preferred EBITDA</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.preferred_ebitda ? `$${buyer.preferred_ebitda}M` : "—"}
                  </div>
                </div>
              </div>
            )}
          </BuyerDataSection>

          {/* Geographic Preferences Section */}
          <BuyerDataSection
            title="Geographic Preferences"
            description="Target locations and geographic focus"
            isEditing={editingSection === "geography"}
            onEdit={() => setEditingSection("geography")}
            onSave={() => handleSaveSection("geography")}
            onCancel={() => handleCancelEdit("geography")}
          >
            {editingSection === "geography" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Geographic Footprint</Label>
                  <ChipInput
                    value={formData.geographic_footprint || []}
                    onChange={(value) =>
                      setFormData({ ...formData, geographic_footprint: value })
                    }
                    placeholder="Add location and press Enter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Geographies</Label>
                  <ChipInput
                    value={formData.target_geographies || []}
                    onChange={(value) =>
                      setFormData({ ...formData, target_geographies: value })
                    }
                    placeholder="Add geography and press Enter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Geographic Exclusions</Label>
                  <ChipInput
                    value={formData.geographic_exclusions || []}
                    onChange={(value) =>
                      setFormData({ ...formData, geographic_exclusions: value })
                    }
                    placeholder="Add exclusion and press Enter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Acquisition Geography</Label>
                  <ChipInput
                    value={formData.acquisition_geography || []}
                    onChange={(value) =>
                      setFormData({ ...formData, acquisition_geography: value })
                    }
                    placeholder="Add geography and press Enter"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>HQ City</Label>
                    <Input
                      value={formData.hq_city || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, hq_city: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HQ State</Label>
                    <Input
                      value={formData.hq_state || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, hq_state: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HQ Country</Label>
                    <Input
                      value={formData.hq_country || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, hq_country: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Other Office Locations</Label>
                  <ChipInput
                    value={formData.other_office_locations || []}
                    onChange={(value) =>
                      setFormData({ ...formData, other_office_locations: value })
                    }
                    placeholder="Add office location and press Enter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Service Regions</Label>
                  <ChipInput
                    value={formData.service_regions || []}
                    onChange={(value) =>
                      setFormData({ ...formData, service_regions: value })
                    }
                    placeholder="Add region and press Enter"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Geographic Footprint</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.geographic_footprint && buyer.geographic_footprint.length > 0 ? (
                      buyer.geographic_footprint.map((loc, i) => (
                        <Badge key={i} variant="secondary">
                          {loc}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Target Geographies</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.target_geographies && buyer.target_geographies.length > 0 ? (
                      buyer.target_geographies.map((geo, i) => (
                        <Badge key={i} variant="secondary">
                          {geo}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Geographic Exclusions</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.geographic_exclusions && buyer.geographic_exclusions.length > 0 ? (
                      buyer.geographic_exclusions.map((exc, i) => (
                        <Badge key={i} variant="outline">
                          {exc}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">HQ City</div>
                    <div className="text-sm text-muted-foreground">{buyer.hq_city || "—"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">HQ State</div>
                    <div className="text-sm text-muted-foreground">{buyer.hq_state || "—"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">HQ Country</div>
                    <div className="text-sm text-muted-foreground">
                      {buyer.hq_country || "—"}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Other Office Locations</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.other_office_locations &&
                    buyer.other_office_locations.length > 0 ? (
                      buyer.other_office_locations.map((loc, i) => (
                        <Badge key={i} variant="secondary">
                          {loc}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </BuyerDataSection>

          {/* Acquisition Strategy Section */}
          <BuyerDataSection
            title="Acquisition Strategy"
            description="Deal preferences and acquisition history"
            isEditing={editingSection === "acquisition"}
            onEdit={() => setEditingSection("acquisition")}
            onSave={() => handleSaveSection("acquisition")}
            onCancel={() => handleCancelEdit("acquisition")}
          >
            {editingSection === "acquisition" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="addon_only"
                      checked={formData.addon_only || false}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, addon_only: !!checked })
                      }
                    />
                    <Label htmlFor="addon_only">Add-on Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="platform_only"
                      checked={formData.platform_only || false}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, platform_only: !!checked })
                      }
                    />
                    <Label htmlFor="platform_only">Platform Only</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Acquisitions</Label>
                    <Input
                      type="number"
                      value={formData.total_acquisitions || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          total_acquisitions: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Acquisition Frequency</Label>
                    <Input
                      value={formData.acquisition_frequency || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          acquisition_frequency: e.target.value,
                        })
                      }
                      placeholder="e.g., 2-3 per year"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Last Acquisition Date</Label>
                    <Input
                      type="date"
                      value={formData.last_acquisition_date || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          last_acquisition_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Acquisition Appetite</Label>
                    <Select
                      value={formData.acquisition_appetite || ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, acquisition_appetite: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select appetite" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Selective">Selective</SelectItem>
                        <SelectItem value="Opportunistic">Opportunistic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Acquisition Timeline</Label>
                  <Input
                    value={formData.acquisition_timeline || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, acquisition_timeline: e.target.value })
                    }
                    placeholder="e.g., Next 12 months"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Add-on Only:</span>
                    <Badge variant={buyer.addon_only ? "default" : "outline"}>
                      {buyer.addon_only ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Platform Only:</span>
                    <Badge variant={buyer.platform_only ? "default" : "outline"}>
                      {buyer.platform_only ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Total Acquisitions</div>
                    <div className="text-sm text-muted-foreground">
                      {buyer.total_acquisitions || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Acquisition Frequency</div>
                    <div className="text-sm text-muted-foreground">
                      {buyer.acquisition_frequency || "—"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Last Acquisition Date</div>
                    <div className="text-sm text-muted-foreground">
                      {buyer.last_acquisition_date || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Acquisition Appetite</div>
                    <div className="text-sm text-muted-foreground">
                      {buyer.acquisition_appetite || "—"}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Acquisition Timeline</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.acquisition_timeline || "—"}
                  </div>
                </div>
              </div>
            )}
          </BuyerDataSection>

          {/* Owner Transition Section */}
          <BuyerDataSection
            title="Owner Transition"
            description="Owner requirements and transition preferences"
            isEditing={editingSection === "owner"}
            onEdit={() => setEditingSection("owner")}
            onSave={() => handleSaveSection("owner")}
            onCancel={() => handleCancelEdit("owner")}
          >
            {editingSection === "owner" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Owner Roll Requirement</Label>
                  <Textarea
                    value={formData.owner_roll_requirement || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        owner_roll_requirement: e.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner Transition Goals</Label>
                  <Textarea
                    value={formData.owner_transition_goals || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        owner_transition_goals: e.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employee Owner</Label>
                  <Input
                    value={formData.employee_owner || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, employee_owner: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Owner Roll Requirement</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.owner_roll_requirement || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Owner Transition Goals</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.owner_transition_goals || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Employee Owner</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.employee_owner || "—"}
                  </div>
                </div>
              </div>
            )}
          </BuyerDataSection>

          {/* Portfolio & Operations Section */}
          <BuyerDataSection
            title="Portfolio & Operations"
            description="Portfolio companies and operational details"
            isEditing={editingSection === "portfolio"}
            onEdit={() => setEditingSection("portfolio")}
            onSave={() => handleSaveSection("portfolio")}
            onCancel={() => handleCancelEdit("portfolio")}
          >
            {editingSection === "portfolio" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Number of Platforms</Label>
                  <Input
                    type="number"
                    value={formData.num_platforms || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        num_platforms: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Portfolio Companies</Label>
                  <ChipInput
                    value={formData.portfolio_companies || []}
                    onChange={(value) =>
                      setFormData({ ...formData, portfolio_companies: value })
                    }
                    placeholder="Add company and press Enter"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Number of Platforms</div>
                  <div className="text-sm text-muted-foreground">
                    {buyer.num_platforms || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Portfolio Companies</div>
                  <div className="flex flex-wrap gap-1">
                    {buyer.portfolio_companies && buyer.portfolio_companies.length > 0 ? (
                      buyer.portfolio_companies.map((company, i) => (
                        <Badge key={i} variant="secondary">
                          {company}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                {buyer.recent_acquisitions && buyer.recent_acquisitions.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Recent Acquisitions</div>
                    <div className="space-y-3">
                      {buyer.recent_acquisitions.map((acq, i) => (
                        <div key={i} className="border-l-2 pl-3 space-y-1">
                          <div className="font-medium text-sm">{acq.company}</div>
                          {acq.date && (
                            <div className="text-xs text-muted-foreground">{acq.date}</div>
                          )}
                          {acq.location && (
                            <div className="text-xs text-muted-foreground">{acq.location}</div>
                          )}
                          {acq.description && (
                            <div className="text-xs text-muted-foreground">
                              {acq.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </BuyerDataSection>

          {/* Contact Information Section */}
          <BuyerDataSection
            title="Contact Information"
            description="Website and social media links"
            isEditing={editingSection === "contact"}
            onEdit={() => setEditingSection("contact")}
            onSave={() => handleSaveSection("contact")}
            onCancel={() => handleCancelEdit("contact")}
          >
            {editingSection === "contact" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform Website</Label>
                  <Input
                    type="url"
                    value={formData.platform_website || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, platform_website: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>PE Firm Website</Label>
                  <Input
                    type="url"
                    value={formData.pe_firm_website || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, pe_firm_website: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buyer LinkedIn</Label>
                  <Input
                    type="url"
                    value={formData.buyer_linkedin || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, buyer_linkedin: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>PE Firm LinkedIn</Label>
                  <Input
                    type="url"
                    value={formData.pe_firm_linkedin || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, pe_firm_linkedin: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">Platform Website</div>
                  <div className="text-sm">
                    {buyer.platform_website ? (
                      <a
                        href={buyer.platform_website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {buyer.platform_website}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">PE Firm Website</div>
                  <div className="text-sm">
                    {buyer.pe_firm_website ? (
                      <a
                        href={buyer.pe_firm_website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {buyer.pe_firm_website}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Buyer LinkedIn</div>
                  <div className="text-sm">
                    {buyer.buyer_linkedin ? (
                      <a
                        href={buyer.buyer_linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {buyer.buyer_linkedin}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">PE Firm LinkedIn</div>
                  <div className="text-sm">
                    {buyer.pe_firm_linkedin ? (
                      <a
                        href={buyer.pe_firm_linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {buyer.pe_firm_linkedin}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </BuyerDataSection>
        </TabsContent>

        {/* Agreements Tab */}
        <TabsContent value="agreements">
          <BuyerAgreementsPanel buyerId={buyer.id} marketplaceFirmId={(buyer as any).marketplace_firm_id} hasFeeAgreement={buyer.has_fee_agreement || false} feeAgreementSource={(buyer as any).fee_agreement_source} />
        </TabsContent>

        <TabsContent value="deal-history">
          <BuyerDealHistoryTab buyerId={buyer.id} />
        </TabsContent>

        <TabsContent value="contacts">
          <BuyerContactsTab buyerId={buyer.id} />
        </TabsContent>

        <TabsContent value="transcripts">
          <Card>
            <CardHeader>
              <CardTitle>Transcripts & Calls</CardTitle>
              <CardDescription>
                Call recordings and transcript analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p>Transcript management coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <BuyerActivitySection buyerId={buyer.id} />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Buyer settings and data management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Data Management</h4>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Last enriched: {buyer.data_last_updated || "Never"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Created: {new Date(buyer.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Data Completeness</h4>
                <div className="text-sm text-muted-foreground">{percentage}% complete</div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Actions</h4>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleArchive}>
                    <Archive className="w-4 h-4 mr-2" />
                    Archive Buyer
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Buyer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pass Reason Dialog */}
      {dealId && (
        <PassReasonDialog
          buyerId={buyer.id}
          dealId={dealId}
          isOpen={isPassDialogOpen}
          onClose={() => setIsPassDialogOpen(false)}
          onPass={() => {
            toast({
              title: "Passed on deal",
              description: "The buyer has been marked as passed for this deal",
            });
            loadBuyer();
          }}
        />
      )}
    </div>
  );
}
