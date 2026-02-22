import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  MapPin,
  Globe,
  Linkedin,
  Users,
  BarChart3,
  Brain,
  Phone,
  Mail,
  Plus,
  Trash2,
  FileSignature,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { BuyerNotesSection } from "@/components/remarketing/buyer-detail/BuyerNotesSection";
import { FirefliesTranscriptSearch } from "@/components/buyers/FirefliesTranscriptSearch";

const PEFirmDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isAddPlatformDialogOpen, setIsAddPlatformDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    linkedin_url: "",
    is_primary: false,
  });
  const [newPlatform, setNewPlatform] = useState({
    company_name: "",
    company_website: "",
    universe_id: "",
    thesis_summary: "",
  });

  // Fetch the PE firm record
  const { data: firm, isLoading: firmLoading } = useQuery({
    queryKey: ["remarketing", "pe-firm", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select(
          `
          *,
          universe:remarketing_buyer_universes(id, name),
          firm_agreement:firm_agreements!remarketing_buyers_marketplace_firm_id_fkey(
            id,
            nda_signed,
            nda_signed_at,
            fee_agreement_signed,
            fee_agreement_signed_at,
            primary_company_name
          )
        `
        )
        .eq("id", id!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch platform companies linked to this PE firm (by matching pe_firm_name to firm's company_name)
  const { data: platforms = [], isLoading: platformsLoading } = useQuery({
    queryKey: ["remarketing", "pe-firm-platforms", firm?.company_name],
    queryFn: async () => {
      if (!firm?.company_name) return [];

      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select(
          `
          id,
          company_name,
          company_website,
          buyer_type,
          data_completeness,
          business_summary,
          thesis_summary,
          hq_city,
          hq_state,
          has_fee_agreement,
          marketplace_firm_id,
          universe:remarketing_buyer_universes(id, name)
        `
        )
        .eq("pe_firm_name", firm.company_name)
        .neq("buyer_type", "pe_firm")
        .eq("archived", false)
        .order("company_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!firm?.company_name,
  });

  // Fetch contacts for this PE firm
  const { data: contacts = [] } = useQuery({
    queryKey: ["remarketing", "contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remarketing_buyer_contacts")
        .select("*")
        .eq("buyer_id", id!)
        .order("is_primary", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch deal scores across all platforms under this firm
  const platformIds = useMemo(() => platforms.map((p) => p.id), [platforms]);
  const { data: dealScores = [] } = useQuery({
    queryKey: ["remarketing", "pe-firm-deal-activity", platformIds],
    queryFn: async () => {
      if (platformIds.length === 0) return [];

      const allScores: Array<{
        id: string;
        composite_score: number;
        tier: string | null;
        status: string | null;
        created_at: string;
        buyer_id: string;
        listing: { id: string; title: string | null } | null;
      }> = [];
      for (let i = 0; i < platformIds.length; i += 100) {
        const chunk = platformIds.slice(i, i + 100);
        const { data, error } = await supabase
          .from("remarketing_scores")
          .select(
            `
            id,
            composite_score,
            tier,
            status,
            created_at,
            buyer_id,
            listing:listings(id, title)
          `
          )
          .in("buyer_id", chunk)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("Error fetching deal scores:", error);
          continue;
        }
        allScores.push(...(data || []));
      }
      return allScores;
    },
    enabled: platformIds.length > 0,
  });

  // Fetch transcripts for this PE firm
  const { data: transcripts = [] } = useQuery({
    queryKey: ["remarketing", "transcripts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buyer_transcripts")
        .select("*")
        .eq("buyer_id", id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch universes for add platform dialog
  const { data: universes } = useQuery({
    queryKey: ["remarketing", "universes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remarketing_buyer_universes")
        .select("id, name")
        .eq("archived", false)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Deal activity aggregation
  const dealStats = useMemo(() => {
    const totalScored = dealScores.length;
    const approved = dealScores.filter((s) => s.status === "approved").length;
    const pending = dealScores.filter((s) => s.status === "pending").length;
    const passed = dealScores.filter((s) => s.status === "passed").length;
    const responseRate = totalScored > 0 ? Math.round((approved / totalScored) * 100) : 0;
    return { totalScored, approved, pending, passed, responseRate };
  }, [dealScores]);

  // Mutations
  const updateFirmMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { error } = await supabase
        .from("remarketing_buyers")
        .update(data)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "pe-firm", id] });
      toast.success("Firm updated");
    },
    onError: () => {
      toast.error("Failed to update firm");
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("remarketing_buyer_contacts")
        .insert([{ ...newContact, buyer_id: id! }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "contacts", id] });
      toast.success("Contact added");
      setIsContactDialogOpen(false);
      setNewContact({ name: "", email: "", phone: "", role: "", linkedin_url: "", is_primary: false });
    },
    onError: () => {
      toast.error("Failed to add contact");
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from("remarketing_buyer_contacts")
        .delete()
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "contacts", id] });
      toast.success("Contact deleted");
    },
    onError: () => {
      toast.error("Failed to delete contact");
    },
  });

  const addPlatformMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("remarketing_buyers").insert({
        company_name: newPlatform.company_name,
        company_website: newPlatform.company_website || null,
        buyer_type: "platform",
        pe_firm_name: firm?.company_name,
        universe_id: newPlatform.universe_id || null,
        thesis_summary: newPlatform.thesis_summary || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "pe-firm-platforms"] });
      toast.success(`${newPlatform.company_name} added as a platform company`);
      setIsAddPlatformDialogOpen(false);
      setNewPlatform({ company_name: "", company_website: "", universe_id: "", thesis_summary: "" });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Get buyer type label
  const getFirmTypeLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      pe_firm: "PE Firm",
      independent_sponsor: "Independent Sponsor",
      search_fund: "Search Fund",
      family_office: "Family Office",
    };
    return labels[type || ""] || type || "Sponsor";
  };

  if (firmLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Firm Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This PE firm or sponsor record could not be found.
          </p>
          <Button asChild>
            <Link to="/admin/buyers">Back to All Buyers</Link>
          </Button>
        </div>
      </div>
    );
  }

  const hqLocation = [firm.hq_city, firm.hq_state].filter(Boolean).join(", ");

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" asChild className="mt-1">
              <Link to="/admin/buyers?tab=pe_firm">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <div className="space-y-1">
              {/* Firm Name + Type Badge */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{firm.company_name}</h1>
                <Badge variant="outline" className="text-sm">
                  {getFirmTypeLabel(firm.buyer_type)}
                </Badge>
                {firm.has_fee_agreement && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <FileSignature className="h-3 w-3 mr-1" />
                    Fee Agreement
                  </Badge>
                )}
                {firm.firm_agreement?.nda_signed && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">NDA Signed</Badge>
                )}
              </div>

              {/* Meta info row */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {firm.company_website && (
                  <a
                    href={
                      firm.company_website.startsWith("http")
                        ? firm.company_website
                        : `https://${firm.company_website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>
                      {firm.company_website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {firm.buyer_linkedin && (
                  <a
                    href={firm.buyer_linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Linkedin className="h-3.5 w-3.5" />
                    <span>LinkedIn</span>
                  </a>
                )}
                {hqLocation && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{hqLocation}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span>{platforms.length} Platform Companies</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/buyers/${firm.id}`)}>
              View as Buyer
            </Button>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="platforms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="platforms" className="text-sm">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Platform Companies ({platforms.length})
          </TabsTrigger>
          <TabsTrigger value="contacts" className="text-sm">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="text-sm">
            <Brain className="mr-1.5 h-3.5 w-3.5" />
            Intelligence
          </TabsTrigger>
          <TabsTrigger value="deal-activity" className="text-sm">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Deal Activity ({dealStats.totalScored})
          </TabsTrigger>
          <TabsTrigger value="notes-calls" className="text-sm">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Notes & Calls ({transcripts.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── Platform Companies Tab ─── */}
        <TabsContent value="platforms" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Platform Companies</h3>
              <p className="text-sm text-muted-foreground">
                Operating companies under {firm.company_name} in our system
              </p>
            </div>
            <Button size="sm" onClick={() => setIsAddPlatformDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Platform Company
            </Button>
          </div>

          {platformsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : platforms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="font-medium text-muted-foreground">
                  No platform companies connected yet
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a platform company to start tracking their deal activity
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsAddPlatformDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Platform Company
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {platforms.map((platform) => (
                <Card
                  key={platform.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/admin/buyers/${platform.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">
                            {platform.company_name}
                          </span>
                          {platform.data_completeness === "high" && (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-xs px-1.5 py-0">
                              Enriched
                            </Badge>
                          )}
                        </div>
                        {(platform.universe as { name?: string } | null)?.name && (
                          <Badge variant="secondary" className="text-xs">
                            {(platform.universe as { name?: string } | null)?.name}
                          </Badge>
                        )}
                        {platform.company_website && (
                          <a
                            href={platform.company_website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {platform.company_website
                              .replace(/^https?:\/\//, "")
                              .replace(/\/$/, "")}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {(platform.business_summary || platform.thesis_summary) && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {platform.business_summary || platform.thesis_summary}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                        {platform.has_fee_agreement && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                            Fee Agmt
                          </Badge>
                        )}
                        {platform.marketplace_firm_id && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                            Marketplace
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Contacts Tab ─── */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Firm Contacts</CardTitle>
                  <CardDescription>
                    Partners, VPs, and deal team members at {firm.company_name}
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setIsContactDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No contacts added yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>LinkedIn</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          {contact.name}
                          {contact.is_primary && (
                            <Badge variant="secondary" className="ml-2">
                              Primary
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{contact.role || "—"}</TableCell>
                        <TableCell>
                          {contact.email ? (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.phone ? (
                            <a
                              href={`tel:${contact.phone}`}
                              className="flex items-center gap-1 hover:underline"
                            >
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.linkedin_url ? (
                            <a
                              href={contact.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <Linkedin className="h-3 w-3" />
                              Profile
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (confirm("Delete this contact?")) {
                                deleteContactMutation.mutate(contact.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Intelligence Tab ─── */}
        <TabsContent value="intelligence" className="space-y-4">
          {/* Firm Notes */}
          <BuyerNotesSection
            notes={firm.notes || null}
            onSave={async (notes) => {
              await updateFirmMutation.mutateAsync({ notes });
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Investment Strategy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Investment Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                {firm.thesis_summary ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {firm.thesis_summary}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No investment strategy documented yet. Add from call transcripts or
                    manually.
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    const strategy = prompt(
                      "Investment Strategy:",
                      firm.thesis_summary || ""
                    );
                    if (strategy !== null) {
                      updateFirmMutation.mutate({ thesis_summary: strategy });
                    }
                  }}
                >
                  Edit Strategy
                </Button>
              </CardContent>
            </Card>

            {/* Target Industries */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Target Industries</CardTitle>
              </CardHeader>
              <CardContent>
                {(firm.target_industries?.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {firm.target_industries!.map((ind: string) => (
                      <Badge key={ind} variant="secondary" className="text-xs">
                        {ind}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No target industries documented yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Deal Structure Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deal Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Revenue Range:</span>
                    <p className="font-medium">
                      {firm.target_revenue_min || firm.target_revenue_max
                        ? `$${(firm.target_revenue_min ? (firm.target_revenue_min / 1000000).toFixed(1) : "?")}M – $${(firm.target_revenue_max ? (firm.target_revenue_max / 1000000).toFixed(1) : "?")}M`
                        : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">EBITDA Range:</span>
                    <p className="font-medium">
                      {firm.target_ebitda_min || firm.target_ebitda_max
                        ? `$${(firm.target_ebitda_min ? (firm.target_ebitda_min / 1000000).toFixed(1) : "?")}M – $${(firm.target_ebitda_max ? (firm.target_ebitda_max / 1000000).toFixed(1) : "?")}M`
                        : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Acquisition Appetite:</span>
                    <p className="font-medium">{firm.acquisition_appetite || "Not specified"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timeline:</span>
                    <p className="font-medium">{firm.acquisition_timeline || "Not specified"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Geographic Focus */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Geographic Focus</CardTitle>
              </CardHeader>
              <CardContent>
                {(firm.target_geographies?.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {firm.target_geographies!.map((geo: string) => (
                      <Badge key={geo} variant="secondary" className="text-xs">
                        {geo}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No geographic preferences documented yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Deal Activity Tab ─── */}
        <TabsContent value="deal-activity" className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{dealStats.totalScored}</p>
                <p className="text-xs text-muted-foreground">Deals Scored</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{dealStats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{dealStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{dealStats.passed}</p>
                <p className="text-xs text-muted-foreground">Passed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{dealStats.responseRate}%</p>
                <p className="text-xs text-muted-foreground">Approval Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Deal Table */}
          <Card>
            <CardHeader>
              <CardTitle>Deal History Across All Platforms</CardTitle>
              <CardDescription>
                All deals scored and sent across {firm.company_name}'s platform companies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dealScores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No deal activity yet across any platforms</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealScores.map((score) => {
                      const platform = platforms.find(
                        (p) => p.id === score.buyer_id
                      );
                      return (
                        <TableRow key={score.id}>
                          <TableCell>
                            {score.listing?.id ? (
                              <Link
                                to={`/admin/remarketing/matching/${score.listing.id}`}
                                className="font-medium hover:underline"
                              >
                                {score.listing?.title || "Unknown"}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {platform ? (
                              <Link
                                to={`/admin/buyers/${platform.id}`}
                                className="text-sm hover:underline"
                              >
                                {platform.company_name}
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {Math.round(score.composite_score)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                score.tier === "A"
                                  ? "default"
                                  : score.tier === "B"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              Tier {score.tier}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                score.status === "approved"
                                  ? "default"
                                  : score.status === "passed"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {score.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(score.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Notes & Calls Tab ─── */}
        <TabsContent value="notes-calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Find Call Transcripts</CardTitle>
              <CardDescription>
                Search your Fireflies call history to link firm-level conversations with{" "}
                {firm.company_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FirefliesTranscriptSearch
                buyerId={firm.id}
                companyName={firm.company_name || ""}
                peFirmName={firm.company_name}
                platformWebsite={firm.company_website}
                contacts={contacts.filter((c) => c.email).map((c) => ({ email: c.email! }))}
                onTranscriptLinked={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["remarketing", "transcripts", id],
                  });
                }}
              />
            </CardContent>
          </Card>

          {/* Transcript list */}
          {transcripts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Linked Transcripts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transcripts.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {t.title || (t as any).file_name || "Transcript"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {t.source || "manual"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Add Contact Dialog ─── */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a contact at {firm.company_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Name *</Label>
              <Input
                id="contact_name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Phone</Label>
              <Input
                id="contact_phone"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_role">Role</Label>
              <Input
                id="contact_role"
                placeholder="e.g., Managing Partner, VP Business Development"
                value={newContact.role}
                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_linkedin">LinkedIn URL</Label>
              <Input
                id="contact_linkedin"
                placeholder="https://linkedin.com/in/..."
                value={newContact.linkedin_url}
                onChange={(e) =>
                  setNewContact({ ...newContact, linkedin_url: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addContactMutation.mutate()}
              disabled={!newContact.name || addContactMutation.isPending}
            >
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Platform Company Dialog ─── */}
      <Dialog open={isAddPlatformDialogOpen} onOpenChange={setIsAddPlatformDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Platform Company</DialogTitle>
            <DialogDescription>
              Add a new platform company under {firm.company_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Company Name *</Label>
              <Input
                id="platform_name"
                placeholder="e.g., Airo Mechanical"
                value={newPlatform.company_name}
                onChange={(e) =>
                  setNewPlatform({ ...newPlatform, company_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform_website">Website</Label>
              <Input
                id="platform_website"
                placeholder="https://example.com"
                value={newPlatform.company_website}
                onChange={(e) =>
                  setNewPlatform({ ...newPlatform, company_website: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform_universe">Buyer Universe</Label>
              <select
                id="platform_universe"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={newPlatform.universe_id}
                onChange={(e) =>
                  setNewPlatform({ ...newPlatform, universe_id: e.target.value })
                }
              >
                <option value="">No universe</option>
                {universes?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform_thesis">Investment Thesis</Label>
              <Textarea
                id="platform_thesis"
                placeholder="Brief description of this platform's acquisition focus..."
                value={newPlatform.thesis_summary}
                onChange={(e) =>
                  setNewPlatform({ ...newPlatform, thesis_summary: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddPlatformDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => addPlatformMutation.mutate()}
              disabled={
                !newPlatform.company_name.trim() || addPlatformMutation.isPending
              }
            >
              {addPlatformMutation.isPending ? "Adding..." : "Add Platform"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PEFirmDetail;
