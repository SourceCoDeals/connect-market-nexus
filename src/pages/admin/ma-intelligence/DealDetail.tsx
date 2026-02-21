import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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
import { ChipInput } from "@/components/ui/chip-input";
import {
  Loader2,
  ArrowLeft,
  Sparkles,
  MoreVertical,
  Archive,
  Trash2,
  DollarSign,
  MapPin,
  Users,
  TrendingUp,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DealScoreBadge } from "@/components/ma-intelligence";
import { DealDataSection } from "@/components/ma-intelligence/DealDataSection";
import { DealActivitySection } from "@/components/ma-intelligence/DealActivitySection";
import { DealTranscriptsTab } from "@/components/ma-intelligence/DealTranscriptsTab";
import { DealMatchedBuyersTab } from "@/components/ma-intelligence/DealMatchedBuyersTab";
import { AddTranscriptDialog } from "@/components/ma-intelligence/AddTranscriptDialog";
import type { MADeal } from "@/lib/ma-intelligence/types";

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deal, setDeal] = useState<MADeal | null>(null);
  const [tracker, setTracker] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isAddTranscriptDialogOpen, setIsAddTranscriptDialogOpen] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState<Partial<MADeal>>({});

  // Settings state
  const [geoWeightMultiplier, setGeoWeightMultiplier] = useState(1.0);
  const [sizeWeightMultiplier, setSizeWeightMultiplier] = useState(1.0);
  const [serviceWeightMultiplier, setServiceWeightMultiplier] = useState(1.0);
  const [customScoringInstructions, setCustomScoringInstructions] = useState("");

  useEffect(() => {
    if (id) {
      loadDeal();
      loadScoringAdjustments();
    }
  }, [id]);

  const loadDeal = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          tracker:industry_trackers(id, name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      const dealData = data as any;
      setDeal(dealData);
      setTracker(dealData.tracker);
      setFormData(dealData);
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

  const loadScoringAdjustments = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("deal_scoring_adjustments")
        .select("*")
        .eq("listing_id", id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        // Map from actual schema (adjustment_value) to UI state
        setGeoWeightMultiplier(data.adjustment_value || 1.0);
        setSizeWeightMultiplier(1.0);
        setServiceWeightMultiplier(1.0);
        setCustomScoringInstructions(data.reason || "");
      }
    } catch (error: any) {
      console.error("Error loading scoring adjustments:", error);
    }
  };

  const handleEnrich = async () => {
    if (!deal) return;

    try {
      const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueDealEnrichment([deal.id]);

      toast({
        title: "Enrichment started",
        description: "Deal enrichment is running in the background",
      });

      // Data will refresh via queue polling; do a deferred reload as fallback
      setTimeout(loadDeal, 5000);
    } catch (error: any) {
      toast({
        title: "Error enriching deal",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCalculateScore = async () => {
    if (!deal) return;

    try {
      await supabase.functions.invoke("score-deal-buyers", {
        body: { dealId: deal.id },
      });

      toast({
        title: "Score calculation started",
        description: "Deal scoring is running in the background",
      });

      // Data will refresh via queue polling; do a deferred reload as fallback
      setTimeout(loadDeal, 5000);
    } catch (error: any) {
      toast({
        title: "Error calculating score",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleArchive = async () => {
    if (!deal) return;
    if (!confirm("Are you sure you want to archive this deal?")) return;

    try {
      // Use deleted_at timestamp for soft delete (deals table doesn't have 'archived' column)
      const { error } = await supabase
        .from("deals")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deal.id);

      if (error) throw error;

      toast({
        title: "Deal archived",
        description: "The deal has been archived successfully",
      });

      navigate("/admin/ma-intelligence/deals");
    } catch (error: any) {
      toast({
        title: "Error archiving deal",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deal) return;
    if (
      !confirm(
        "Are you sure you want to delete this deal? This action cannot be undone."
      )
    )
      return;

    try {
      const { error } = await supabase.from("deals").delete().eq("id", deal.id);

      if (error) throw error;

      toast({
        title: "Deal deleted",
        description: "The deal has been deleted successfully",
      });

      navigate("/admin/ma-intelligence/deals");
    } catch (error: any) {
      toast({
        title: "Error deleting deal",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveSection = async (section: string) => {
    if (!deal) return;

    try {
      // Extract only schema-compatible fields
      const updateData: Record<string, unknown> = {};
      const schemaFields = [
        'deal_name', 'company_website', 'company_address', 'company_overview',
        'industry_type', 'service_mix', 'business_model', 'end_market_customers',
        'customer_concentration', 'customer_geography', 'headquarters', 'location_count',
        'employee_count', 'founded_year', 'ownership_structure', 'revenue',
        'revenue_confidence', 'ebitda_amount', 'ebitda_percentage', 'ebitda_confidence',
        'financial_notes', 'owner_goals', 'special_requirements', 'contact_name',
        'contact_title', 'contact_email', 'contact_phone', 'contact_linkedin',
        'additional_info', 'transcript_link', 'geography'
      ];
      
      for (const key of schemaFields) {
        if (key in formData) {
          updateData[key] = (formData as Record<string, unknown>)[key];
        }
      }

      const { error } = await supabase
        .from("deals")
        .update(updateData)
        .eq("id", deal.id);

      if (error) throw error;

      toast({
        title: "Changes saved",
        description: "Deal information has been updated successfully",
      });

      setEditingSection(null);
      loadDeal();
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
    setFormData(deal || {});
  };

  const handleSaveScoringAdjustments = async () => {
    if (!deal) return;

    try {
      // Use the actual schema: listing_id, adjustment_type, adjustment_value, reason
      const { error } = await supabase.from("deal_scoring_adjustments").upsert({
        listing_id: deal.id,
        adjustment_type: "weight_multiplier",
        adjustment_value: geoWeightMultiplier,
        reason: customScoringInstructions || null,
      });

      if (error) throw error;

      toast({
        title: "Scoring adjustments saved",
        description: "Custom scoring weights have been updated",
      });
    } catch (error: any) {
      toast({
        title: "Error saving scoring adjustments",
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
                <a
                  href={deal.company_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {deal.company_website}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tracker && (
            <Badge
              variant="outline"
              className="cursor-pointer"
              onClick={() => navigate(`/admin/ma-intelligence/trackers/${tracker.id}`)}
            >
              {tracker.name}
            </Badge>
          )}
          {deal.deal_score !== null && deal.deal_score !== undefined && (
            <DealScoreBadge score={deal.deal_score} />
          )}
          <Badge variant={deal.status === "active" ? "default" : "secondary"}>
            {deal.status || "Unknown"}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="w-4 h-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCalculateScore}>
                <TrendingUp className="w-4 h-4 mr-2" />
                Calculate Score
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEnrich}>
                <Sparkles className="w-4 h-4 mr-2" />
                Enrich Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsAddTranscriptDialogOpen(true)}>
                <FileText className="w-4 h-4 mr-2" />
                Add Transcript
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="w-4 h-4 mr-2" />
                Archive Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Deal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deal.revenue
                ? `$${
                    deal.revenue >= 1000000
                      ? `${(deal.revenue / 1000000).toFixed(1)}M`
                      : `${(deal.revenue / 1000).toFixed(0)}K`
                  }`
                : "—"}
            </div>
            {deal.revenue_confidence && (
              <p className="text-xs text-muted-foreground mt-1">
                {deal.revenue_confidence} confidence
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              EBITDA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deal.ebitda_amount
                ? `$${
                    deal.ebitda_amount >= 1000000
                      ? `${(deal.ebitda_amount / 1000000).toFixed(1)}M`
                      : `${(deal.ebitda_amount / 1000).toFixed(0)}K`
                  }`
                : deal.ebitda_percentage
                ? `${deal.ebitda_percentage}%`
                : "—"}
            </div>
            {deal.ebitda_confidence && (
              <p className="text-xs text-muted-foreground mt-1">
                {deal.ebitda_confidence} confidence
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deal.headquarters || "—"}
            </div>
            {deal.location_count && (
              <p className="text-xs text-muted-foreground mt-1">
                {deal.location_count} location{deal.location_count !== 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deal.employee_count || "—"}
            </div>
            {deal.founded_year && (
              <p className="text-xs text-muted-foreground mt-1">
                Founded {deal.founded_year}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="matched-buyers">Matched Buyers</TabsTrigger>
          <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Company Information Section */}
          <DealDataSection
            title="Company Information"
            description="Basic company details and contact information"
            isEditing={editingSection === "company"}
            onEdit={() => setEditingSection("company")}
            onSave={() => handleSaveSection("company")}
            onCancel={() => handleCancelEdit("company")}
          >
            {editingSection === "company" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={formData.deal_name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, deal_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Website</Label>
                    <Input
                      type="url"
                      value={formData.company_website || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, company_website: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Company Address</Label>
                  <Input
                    value={formData.company_address || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, company_address: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Contact Name</Label>
                    <Input
                      value={formData.contact_name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Title</Label>
                    <Input
                      value={formData.contact_title || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_title: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input
                      type="email"
                      value={formData.contact_email || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input
                      type="tel"
                      value={formData.contact_phone || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_phone: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Company Name</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.deal_name}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Company Website</div>
                    <div className="text-sm">
                      {deal.company_website ? (
                        <a
                          href={deal.company_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {deal.company_website}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Company Address</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.company_address || "—"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Primary Contact</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.contact_name || "—"}
                      {deal.contact_title && ` • ${deal.contact_title}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Contact Info</div>
                    <div className="text-sm">
                      {deal.contact_email && (
                        <a
                          href={`mailto:${deal.contact_email}`}
                          className="text-primary hover:underline block"
                        >
                          {deal.contact_email}
                        </a>
                      )}
                      {deal.contact_phone && (
                        <a
                          href={`tel:${deal.contact_phone}`}
                          className="text-primary hover:underline block"
                        >
                          {deal.contact_phone}
                        </a>
                      )}
                      {!deal.contact_email && !deal.contact_phone && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DealDataSection>

          {/* Business Details Section */}
          <DealDataSection
            title="Business Details"
            description="Industry, services, and business model information"
            isEditing={editingSection === "business"}
            onEdit={() => setEditingSection("business")}
            onSave={() => handleSaveSection("business")}
            onCancel={() => handleCancelEdit("business")}
          >
            {editingSection === "business" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input
                    value={formData.industry_type || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, industry_type: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Description</Label>
                  <Textarea
                    value={formData.company_overview || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, company_overview: e.target.value })
                    }
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Service Mix</Label>
                  <Textarea
                    value={formData.service_mix || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, service_mix: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Model</Label>
                  <Input
                    value={formData.business_model || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, business_model: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer Industries</Label>
                  <Input
                    value={formData.end_market_customers || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, end_market_customers: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer Geographic Reach</Label>
                  <Input
                    value={formData.customer_geography || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_geography: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Industry</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.industry_type || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Business Description</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {deal.company_overview || "No description available"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Service Mix</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.service_mix || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Business Model</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.business_model || "—"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Customer Industries</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.end_market_customers || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">
                      Customer Geographic Reach
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {deal.customer_geography || "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DealDataSection>

          {/* Financial Information Section */}
          <DealDataSection
            title="Financial Information"
            description="Revenue, EBITDA, and financial metrics"
            isEditing={editingSection === "financial"}
            onEdit={() => setEditingSection("financial")}
            onSave={() => handleSaveSection("financial")}
            onCancel={() => handleCancelEdit("financial")}
          >
            {editingSection === "financial" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Revenue ($)</Label>
                    <Input
                      type="number"
                      value={formData.revenue || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          revenue: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>EBITDA ($)</Label>
                    <Input
                      type="number"
                      value={formData.ebitda_amount || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ebitda_amount: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>EBITDA Percentage (%)</Label>
                    <Input
                      type="number"
                      value={formData.ebitda_percentage || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ebitda_percentage: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employees</Label>
                    <Input
                      type="number"
                      value={formData.employee_count || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          employee_count: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Year Founded</Label>
                  <Input
                    type="number"
                    value={formData.founded_year || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        founded_year: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Financial Notes</Label>
                  <Textarea
                    value={formData.financial_notes || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, financial_notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Revenue</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.revenue
                        ? `$${
                            deal.revenue >= 1000000
                              ? `${(deal.revenue / 1000000).toFixed(1)}M`
                              : `${(deal.revenue / 1000).toFixed(0)}K`
                          }`
                        : "—"}
                      {deal.revenue_confidence && ` (${deal.revenue_confidence})`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">EBITDA</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.ebitda_amount
                        ? `$${
                            deal.ebitda_amount >= 1000000
                              ? `${(deal.ebitda_amount / 1000000).toFixed(1)}M`
                              : `${(deal.ebitda_amount / 1000).toFixed(0)}K`
                          }`
                        : deal.ebitda_percentage
                        ? `${deal.ebitda_percentage}%`
                        : "—"}
                      {deal.ebitda_confidence && ` (${deal.ebitda_confidence})`}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Employees</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.employee_count || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Year Founded</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.founded_year || "—"}
                    </div>
                  </div>
                </div>
                {deal.industry_kpis && Object.keys(deal.industry_kpis).length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Industry KPIs</div>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(deal.industry_kpis, null, 2)}
                    </pre>
                  </div>
                )}
                {deal.financial_notes && (
                  <div>
                    <div className="text-sm font-medium mb-1">Financial Notes</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {deal.financial_notes}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DealDataSection>

          {/* Location Information Section */}
          <DealDataSection
            title="Location Information"
            description="Headquarters and operating locations"
            isEditing={editingSection === "location"}
            onEdit={() => setEditingSection("location")}
            onSave={() => handleSaveSection("location")}
            onCancel={() => handleCancelEdit("location")}
          >
            {editingSection === "location" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Headquarters</Label>
                  <Input
                    value={formData.headquarters || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, headquarters: e.target.value })
                    }
                    placeholder="City, State, Country"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Geographic Footprint</Label>
                  <ChipInput
                    value={formData.geography || []}
                    onChange={(value) =>
                      setFormData({ ...formData, geography: value })
                    }
                    placeholder="Add location and press Enter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of Locations</Label>
                  <Input
                    type="number"
                    value={formData.location_count || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location_count: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Headquarters</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.headquarters || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Geographic Footprint</div>
                  <div className="flex flex-wrap gap-1">
                    {deal.geography && deal.geography.length > 0 ? (
                      deal.geography.map((location, i) => (
                        <Badge key={i} variant="secondary">
                          {location}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Number of Locations</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.location_count || "—"}
                  </div>
                </div>
              </div>
            )}
          </DealDataSection>

          {/* Owner Information Section */}
          <DealDataSection
            title="Owner Information"
            description="Owner motivations and transition goals"
            isEditing={editingSection === "owner"}
            onEdit={() => setEditingSection("owner")}
            onSave={() => handleSaveSection("owner")}
            onCancel={() => handleCancelEdit("owner")}
          >
            {editingSection === "owner" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Owner Goals</Label>
                  <Textarea
                    value={formData.owner_goals || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, owner_goals: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Special Requirements</Label>
                  <Textarea
                    value={formData.special_requirements || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, special_requirements: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Owner Goals</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {deal.owner_goals || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Special Requirements</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {deal.special_requirements || "—"}
                  </div>
                </div>
              </div>
            )}
          </DealDataSection>

          {/* Deal Status Section */}
          <DealDataSection
            title="Deal Status"
            description="Current status and metadata"
            isEditing={editingSection === "status"}
            onEdit={() => setEditingSection("status")}
            onSave={() => handleSaveSection("status")}
            onCancel={() => handleCancelEdit("status")}
          >
            {editingSection === "status" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Status</div>
                    <div className="text-sm text-muted-foreground">
                      <Badge
                        variant={deal.status === "active" ? "default" : "secondary"}
                      >
                        {deal.status || "Unknown"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Created</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(deal.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">Last Updated</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(deal.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Last Enriched</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.last_enriched_at
                        ? new Date(deal.last_enriched_at).toLocaleDateString()
                        : "Never"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DealDataSection>
        </TabsContent>

        {/* Matched Buyers Tab */}
        <TabsContent value="matched-buyers">
          <DealMatchedBuyersTab dealId={deal.id} />
        </TabsContent>

        {/* Transcripts Tab */}
        <TabsContent value="transcripts">
          <DealTranscriptsTab dealId={deal.id} />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <DealActivitySection dealId={deal.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Adjustments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Geography Weight Multiplier</Label>
                    <span className="text-sm font-medium">{geoWeightMultiplier}x</span>
                  </div>
                  <Slider
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={[geoWeightMultiplier]}
                    onValueChange={([value]) => setGeoWeightMultiplier(value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Size Weight Multiplier</Label>
                    <span className="text-sm font-medium">{sizeWeightMultiplier}x</span>
                  </div>
                  <Slider
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={[sizeWeightMultiplier]}
                    onValueChange={([value]) => setSizeWeightMultiplier(value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Service Weight Multiplier</Label>
                    <span className="text-sm font-medium">
                      {serviceWeightMultiplier}x
                    </span>
                  </div>
                  <Slider
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={[serviceWeightMultiplier]}
                    onValueChange={([value]) => setServiceWeightMultiplier(value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Custom Scoring Instructions</Label>
                  <Textarea
                    value={customScoringInstructions}
                    onChange={(e) => setCustomScoringInstructions(e.target.value)}
                    rows={4}
                    placeholder="Add any custom instructions for scoring this deal..."
                  />
                </div>

                <Button onClick={handleSaveScoringAdjustments}>
                  Save Scoring Adjustments
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Extraction Sources</div>
                  {deal.extraction_sources &&
                  Object.keys(deal.extraction_sources).length > 0 ? (
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(deal.extraction_sources, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No extraction sources available
                    </p>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Last Enriched</div>
                  <div className="text-sm text-muted-foreground">
                    {deal.last_enriched_at
                      ? new Date(deal.last_enriched_at).toLocaleString()
                      : "Never"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dangerous Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleArchive}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Deal
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Deal
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Transcript Dialog */}
      <AddTranscriptDialog
        dealId={deal.id}
        isOpen={isAddTranscriptDialogOpen}
        onClose={() => setIsAddTranscriptDialogOpen(false)}
        onAdd={() => {
          // Reload transcripts if we're on that tab
          if (activeTab === "transcripts") {
            loadDeal();
          }
        }}
      />
    </div>
  );
}
