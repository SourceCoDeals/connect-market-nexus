import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Building2, ExternalLink, MapPin, Users, Pencil,
  Sparkles, BarChart3, Phone, Mail, Linkedin, Plus, Trash2,
  Globe2, Target, Clock, FileSignature, Brain, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { BuyerNotesSection } from "@/components/remarketing/buyer-detail/BuyerNotesSection";
import { IntelligenceBadge } from "@/components/remarketing";
import { BuyerAgreementsPanel } from "@/components/ma-intelligence/BuyerAgreementsPanel";
import { FirefliesTranscriptSearch } from "@/components/buyers/FirefliesTranscriptSearch";
import { TranscriptsListCard } from "@/components/remarketing/buyer-detail/TranscriptsListCard";
import { ExtractionSummaryDialog } from "@/components/remarketing/buyer-detail/ExtractionSummaryDialog";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";

const SPONSOR_TYPE_STYLES: Record<string, string> = {
  pe_firm: "bg-purple-100 text-purple-800 border-purple-200",
  private_equity: "bg-purple-100 text-purple-800 border-purple-200",
  independent_sponsor: "bg-blue-100 text-blue-800 border-blue-200",
  family_office: "bg-amber-100 text-amber-800 border-amber-200",
  search_fund: "bg-teal-100 text-teal-800 border-teal-200",
};

function formatSponsorType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bPe\b/, "PE")
    .replace(/\bPe /g, "PE ");
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  linkedin_url: string | null;
  is_primary: boolean | null;
}

interface Transcript {
  id: string;
  transcript_text: string;
  source: string | null;
  file_name: string | null;
  file_url: string | null;
  processed_at: string | null;
  extracted_data: Record<string, unknown> | null;
  created_at: string;
}

const PEFirmDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "", email: "", phone: "", role: "", linkedin_url: "", is_primary: false,
  });

  // Fetch the PE firm record
  const { data: firm, isLoading } = useQuery({
    queryKey: ["remarketing", "pe-firm", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch platform companies linked to this PE firm (by matching pe_firm_name to company_name)
  const { data: platforms = [] } = useQuery({
    queryKey: ["remarketing", "pe-firm-platforms", firm?.company_name],
    queryFn: async () => {
      if (!firm?.company_name) return [];
      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select(`
          id, company_name, company_website, buyer_type, data_completeness,
          thesis_summary, hq_city, hq_state, industry_vertical,
          has_fee_agreement, marketplace_firm_id,
          universe:remarketing_buyer_universes(id, name)
        `)
        .eq("pe_firm_name", firm.company_name)
        .neq("buyer_type", "pe_firm")
        .eq("archived", false)
        .order("company_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!firm?.company_name,
  });

  // Fetch deal scores across all platforms
  const platformIds = useMemo(() => platforms.map((p: any) => p.id), [platforms]);
  const { data: allScores = [] } = useQuery({
    queryKey: ["remarketing", "pe-firm-scores", platformIds],
    queryFn: async () => {
      if (platformIds.length === 0) return [];
      const allResults: any[] = [];
      for (let i = 0; i < platformIds.length; i += 50) {
        const chunk = platformIds.slice(i, i + 50);
        const { data, error } = await supabase
          .from("remarketing_scores")
          .select(`
            id, composite_score, tier, status, created_at,
            buyer_id,
            listing:listings(id, title)
          `)
          .in("buyer_id", chunk)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        allResults.push(...(data || []));
      }
      return allResults;
    },
    enabled: platformIds.length > 0,
  });

  // Fetch contacts for this PE firm buyer_id
  const { data: contacts = [] } = useQuery({
    queryKey: ["remarketing", "contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remarketing_buyer_contacts")
        .select("*")
        .eq("buyer_id", id)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return (data || []) as Contact[];
    },
  });

  // Fetch transcripts
  const { data: transcripts = [] } = useQuery({
    queryKey: ["remarketing", "transcripts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buyer_transcripts")
        .select("*")
        .eq("buyer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Transcript[];
    },
  });

  // Aggregated deal stats
  const dealStats = useMemo(() => {
    const total = allScores.length;
    const approved = allScores.filter((s: any) => s.status === "approved").length;
    const passed = allScores.filter((s: any) => s.status === "passed").length;
    const avgScore = total > 0 ? Math.round(allScores.reduce((sum: number, s: any) => sum + (s.composite_score || 0), 0) / total) : 0;
    return { total, approved, passed, avgScore };
  }, [allScores]);

  // Mutations
  const updateFirmMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { error } = await supabase
        .from("remarketing_buyers")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "pe-firm", id] });
      toast.success("Firm updated");
    },
    onError: () => toast.error("Failed to update firm"),
  });

  const addContactMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("remarketing_buyer_contacts")
        .insert([{ ...newContact, buyer_id: id }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "contacts", id] });
      toast.success("Contact added");
      setIsContactDialogOpen(false);
      setNewContact({ name: "", email: "", phone: "", role: "", linkedin_url: "", is_primary: false });
    },
    onError: () => toast.error("Failed to add contact"),
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
    onError: () => toast.error("Failed to delete contact"),
  });

  const addTranscriptMutation = useMutation({
    mutationFn: async ({
      text, source, fileName, fileUrl, triggerExtract,
    }: { text: string; source: string; fileName?: string; fileUrl?: string; triggerExtract?: boolean }) => {
      const { data, error } = await supabase
        .from("buyer_transcripts")
        .insert([{
          buyer_id: id,
          title: fileName || "Manual Transcript",
          transcript_text: text || null,
          source: source || "manual",
          file_url: fileUrl || null,
          extraction_status: "pending",
        } as any])
        .select("id")
        .single();
      if (error) throw error;
      const result = data as unknown as { id: string };
      return { transcriptId: result.id, transcriptText: text, source, triggerExtract: !!triggerExtract };
    },
    onSuccess: ({ transcriptId, transcriptText, source, triggerExtract }) => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "transcripts", id] });
      toast.success("Transcript added");
      if (triggerExtract && transcriptText?.trim()) {
        extractTranscriptMutation.mutate({ transcriptId, transcriptText, source });
      }
    },
    onError: () => toast.error("Failed to add transcript"),
  });

  const extractTranscriptMutation = useMutation({
    mutationFn: async (params: { transcriptId: string; transcriptText?: string; source?: string }) => {
      let textToExtract = params.transcriptText;
      let sourceToUse = params.source || "call";
      if (!textToExtract) {
        const transcript = transcripts.find((t) => t.id === params.transcriptId);
        if (transcript) {
          textToExtract = transcript.transcript_text;
          sourceToUse = transcript.source || "call";
        } else {
          const { data } = await supabase.from("buyer_transcripts").select("transcript_text, source").eq("id", params.transcriptId).single();
          const result = data as unknown as { transcript_text?: string; source?: string } | null;
          textToExtract = result?.transcript_text || "";
          sourceToUse = result?.source || "call";
        }
      }
      if (!textToExtract?.trim()) throw new Error("No transcript text available");
      const { data, error } = await invokeWithTimeout<any>("extract-transcript", {
        body: { buyerId: id, transcriptText: textToExtract, source: sourceToUse, transcriptId: params.transcriptId },
        timeoutMs: 120_000,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "transcripts", id] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "pe-firm", id] });
    },
    onError: (error: Error) => toast.error(`Extraction failed: ${error.message}`),
  });

  const deleteTranscriptMutation = useMutation({
    mutationFn: async (transcriptId: string) => {
      const { error } = await supabase.from("buyer_transcripts").delete().eq("id", transcriptId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarketing", "transcripts", id] });
      toast.success("Transcript deleted");
    },
    onError: () => toast.error("Failed to delete transcript"),
  });

  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number; isRunning: boolean }>({ current: 0, total: 0, isRunning: false });
  const [extractionSummary, setExtractionSummary] = useState<{
    open: boolean;
    results: Array<{ fileName?: string; insights?: any; error?: string }>;
    totalCount: number; successCount: number; errorCount: number;
  }>({ open: false, results: [], totalCount: 0, successCount: 0, errorCount: 0 });

  const handleExtractAll = async () => {
    if (transcripts.length === 0) return;
    setExtractionProgress({ current: 0, total: transcripts.length, isRunning: true });
    let successCount = 0, errorCount = 0;
    const results: Array<{ fileName?: string; insights?: any; error?: string }> = [];
    for (let i = 0; i < transcripts.length; i++) {
      try {
        const data = await extractTranscriptMutation.mutateAsync({ transcriptId: transcripts[i].id });
        successCount++;
        results.push({ fileName: transcripts[i].file_name || `Transcript ${i + 1}`, insights: data?.insights?.buyer });
      } catch (e: any) {
        errorCount++;
        results.push({ fileName: transcripts[i].file_name || `Transcript ${i + 1}`, error: e?.message || "Failed" });
      }
      setExtractionProgress({ current: i + 1, total: transcripts.length, isRunning: i < transcripts.length - 1 });
    }
    setExtractionProgress((prev) => ({ ...prev, isRunning: false }));
    setExtractionSummary({ open: true, results, totalCount: transcripts.length, successCount, errorCount });
  };

  const handleSingleExtractWithSummary = async (transcriptId: string) => {
    try {
      const transcript = transcripts.find((t) => t.id === transcriptId);
      const data = await extractTranscriptMutation.mutateAsync({ transcriptId });
      setExtractionSummary({ open: true, results: [{ fileName: transcript?.file_name || "Transcript", insights: data?.insights?.buyer }], totalCount: 1, successCount: 1, errorCount: 0 });
    } catch (e: any) {
      const transcript = transcripts.find((t) => t.id === transcriptId);
      setExtractionSummary({ open: true, results: [{ fileName: transcript?.file_name || "Transcript", error: e?.message || "Failed" }], totalCount: 1, successCount: 0, errorCount: 1 });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/buyers"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">PE Firm Not Found</h1>
        </div>
      </div>
    );
  }

  const hqLocation = [firm.hq_city, firm.hq_state, firm.hq_country].filter(Boolean).join(", ");
  const website = firm.company_website || firm.platform_website;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" asChild className="mt-1">
              <Link to="/admin/buyers?tab=pe_firm"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-purple-700" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{firm.company_name}</h1>
                {firm.buyer_type && (
                  <Badge
                    variant="outline"
                    className={`text-sm font-semibold ${SPONSOR_TYPE_STYLES[firm.buyer_type] || "bg-muted text-muted-foreground"}`}
                  >
                    {formatSponsorType(firm.buyer_type)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {website && (
                  <a
                    href={website.startsWith("http") ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
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
                  <span>{platforms.length} Platform{platforms.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Fee Agreement & Marketplace Status */}
              <div className="flex items-center gap-2 pt-1">
                <Badge
                  variant="outline"
                  className={firm.has_fee_agreement
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-muted text-muted-foreground"}
                >
                  <FileSignature className="h-3 w-3 mr-1" />
                  {firm.has_fee_agreement ? "Fee Agreement Active" : "No Fee Agreement"}
                </Badge>
                {firm.marketplace_firm_id && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Marketplace Connected
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/admin/buyers/${firm.id}`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Record
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-purple-50/50 border-purple-100">
          <CardContent className="p-4">
            <p className="text-xs text-purple-700 font-medium uppercase tracking-wide">Platforms</p>
            <p className="text-2xl font-bold text-purple-900">{platforms.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Deals Scored</p>
            <p className="text-2xl font-bold text-blue-900">{dealStats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 border-green-100">
          <CardContent className="p-4">
            <p className="text-xs text-green-700 font-medium uppercase tracking-wide">Approved</p>
            <p className="text-2xl font-bold text-green-900">{dealStats.approved}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 border-amber-100">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Avg Score</p>
            <p className="text-2xl font-bold text-amber-900">{dealStats.avgScore || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
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
            Deal Activity ({dealStats.total})
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-sm">
            <Phone className="mr-1.5 h-3.5 w-3.5" />
            Notes & Calls
          </TabsTrigger>
          <TabsTrigger value="agreements" className="text-sm">
            <FileSignature className="mr-1.5 h-3.5 w-3.5" />
            Agreements
          </TabsTrigger>
        </TabsList>

        {/* Platform Companies Tab */}
        <TabsContent value="platforms" className="space-y-4">
          {platforms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="mx-auto h-10 w-10 mb-3 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">No platform companies connected yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Platforms linked to {firm.company_name} will appear here
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/admin/buyers")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Platform Company
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {platforms.map((platform: any) => {
                const platformScores = allScores.filter((s: any) => s.buyer_id === platform.id);
                const approvedCount = platformScores.filter((s: any) => s.status === "approved").length;
                return (
                  <Card
                    key={platform.id}
                    className="cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => navigate(`/admin/buyers/${platform.id}`)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                            {platform.company_name}
                          </h3>
                          {platform.universe?.name && (
                            <Badge variant="secondary" className="text-[10px] mt-1">
                              {platform.universe.name}
                            </Badge>
                          )}
                        </div>
                        {platform.data_completeness === "high" && (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[10px] px-1.5 py-0 shrink-0">
                            Enriched
                          </Badge>
                        )}
                      </div>

                      {platform.company_website && (
                        <a
                          href={platform.company_website.startsWith("http") ? platform.company_website : `https://${platform.company_website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe2 className="h-3 w-3" />
                          {platform.company_website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      )}

                      {platform.thesis_summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {platform.thesis_summary}
                        </p>
                      )}

                      <div className="flex items-center gap-3 pt-1 border-t text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {platformScores.length} scored
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {approvedCount} approved
                        </span>
                        {platform.has_fee_agreement && (
                          <span className="flex items-center gap-1 text-green-600">
                            <FileSignature className="h-3 w-3" />
                            Fee Agmt
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Firm Contacts</CardTitle>
                  <CardDescription>Partners, VPs, and deal team members at {firm.company_name}</CardDescription>
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
                  <p>No firm contacts added yet</p>
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
                          {contact.is_primary && <Badge variant="secondary" className="ml-2">Primary</Badge>}
                        </TableCell>
                        <TableCell>{contact.role || "—"}</TableCell>
                        <TableCell>
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline">
                              <Mail className="h-3 w-3" />{contact.email}
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {contact.phone ? (
                            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:underline">
                              <Phone className="h-3 w-3" />{contact.phone}
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {contact.linkedin_url ? (
                            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Linkedin className="h-3 w-3" />Profile
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                            onClick={() => { if (confirm("Delete this contact?")) deleteContactMutation.mutate(contact.id); }}
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

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-4">
          <BuyerNotesSection
            notes={firm.notes || null}
            onSave={async (notes) => { await updateFirmMutation.mutateAsync({ notes }); }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Investment Strategy */}
            <Card className="bg-purple-50/30 border-purple-100">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Brain className="h-4 w-4" />
                  Investment Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {firm.thesis_summary ? (
                  <div className="space-y-2">
                    <p className="text-sm">{firm.thesis_summary}</p>
                    {firm.thesis_confidence && (
                      <Badge variant="outline" className={`text-xs ${
                        firm.thesis_confidence === "high" ? "bg-green-100 text-green-800" :
                        firm.thesis_confidence === "medium" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {firm.thesis_confidence.charAt(0).toUpperCase() + firm.thesis_confidence.slice(1)} confidence
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No investment strategy captured yet</p>
                )}
              </CardContent>
            </Card>

            {/* Target Criteria */}
            <Card className="bg-blue-50/30 border-blue-100">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Target className="h-4 w-4" />
                  Target Criteria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(firm.target_ebitda_min || firm.target_ebitda_max) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">EBITDA Range</span>
                    <span className="font-medium">
                      {firm.target_ebitda_min && firm.target_ebitda_max
                        ? `${formatCurrency(firm.target_ebitda_min)} – ${formatCurrency(firm.target_ebitda_max)}`
                        : firm.target_ebitda_min ? `${formatCurrency(firm.target_ebitda_min)}+`
                        : `Up to ${formatCurrency(firm.target_ebitda_max)}`}
                    </span>
                  </div>
                )}
                {(firm.target_revenue_min || firm.target_revenue_max) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Revenue Range</span>
                    <span className="font-medium">
                      {firm.target_revenue_min && firm.target_revenue_max
                        ? `${formatCurrency(firm.target_revenue_min)} – ${formatCurrency(firm.target_revenue_max)}`
                        : firm.target_revenue_min ? `${formatCurrency(firm.target_revenue_min)}+`
                        : `Up to ${formatCurrency(firm.target_revenue_max)}`}
                    </span>
                  </div>
                )}
                {firm.target_geographies?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Geographic Focus</span>
                    <div className="flex flex-wrap gap-1">
                      {firm.target_geographies.map((geo: string) => (
                        <Badge key={geo} variant="secondary" className="text-xs">{geo}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {firm.target_services?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Target Industries / Services</span>
                    <div className="flex flex-wrap gap-1">
                      {firm.target_services.map((svc: string) => (
                        <Badge key={svc} variant="secondary" className="text-xs">{svc}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {!firm.target_ebitda_min && !firm.target_ebitda_max && !firm.target_revenue_min && !firm.target_revenue_max && !firm.target_geographies?.length && !firm.target_services?.length && (
                  <p className="text-sm text-muted-foreground italic">No target criteria captured yet</p>
                )}
              </CardContent>
            </Card>

            {/* Acquisition Activity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  Acquisition Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {firm.total_acquisitions && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Acquisitions</span>
                    <span className="font-medium">{firm.total_acquisitions}</span>
                  </div>
                )}
                {firm.acquisition_frequency && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Frequency</span>
                    <span className="font-medium capitalize">{firm.acquisition_frequency}</span>
                  </div>
                )}
                {firm.acquisition_appetite && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Appetite</span>
                    <span className="font-medium capitalize">{firm.acquisition_appetite}</span>
                  </div>
                )}
                {firm.acquisition_timeline && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Timeline</span>
                    <span className="font-medium capitalize">{firm.acquisition_timeline}</span>
                  </div>
                )}
                {!firm.total_acquisitions && !firm.acquisition_frequency && !firm.acquisition_appetite && (
                  <p className="text-sm text-muted-foreground italic">No acquisition data captured yet</p>
                )}
              </CardContent>
            </Card>

            {/* Industry Focus */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Globe2 className="h-4 w-4" />
                  Industry Focus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {firm.industry_vertical && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Primary Vertical</span>
                    <Badge variant="secondary" className="text-xs">{firm.industry_vertical}</Badge>
                  </div>
                )}
                {firm.business_summary && (
                  <p className="text-sm text-muted-foreground">{firm.business_summary}</p>
                )}
                {!firm.industry_vertical && !firm.business_summary && (
                  <p className="text-sm text-muted-foreground italic">No industry data captured yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Deal Activity Tab */}
        <TabsContent value="deal-activity">
          <Card>
            <CardHeader>
              <CardTitle>Deal Activity Across All Platforms</CardTitle>
              <CardDescription>
                Aggregated scoring and outreach activity for all of {firm.company_name}'s platform companies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allScores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No deals scored across any platform yet</p>
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
                    {allScores.map((score: any) => {
                      const platform = platforms.find((p: any) => p.id === score.buyer_id);
                      return (
                        <TableRow key={score.id}>
                          <TableCell>
                            <Link
                              to={`/admin/remarketing/matching/${score.listing?.id}`}
                              className="font-medium hover:underline"
                            >
                              {score.listing?.title || "Unknown"}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/admin/buyers/${score.buyer_id}`}
                              className="text-sm hover:underline text-primary"
                            >
                              {platform?.company_name || "Unknown"}
                            </Link>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {Math.round(score.composite_score)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={score.tier === "A" ? "default" : score.tier === "B" ? "secondary" : "outline"}>
                              Tier {score.tier}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={score.status === "approved" ? "default" : score.status === "passed" ? "secondary" : "outline"}>
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

        {/* Notes & Calls Tab */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Find Call Transcripts</CardTitle>
              <CardDescription>
                Search your Fireflies call history to link relevant conversations with {firm.company_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FirefliesTranscriptSearch
                buyerId={firm.id}
                companyName={firm.company_name}
                peFirmName={firm.company_name}
                platformWebsite={website}
                contacts={contacts.map((c) => ({ email: c.email }))}
                onTranscriptLinked={() => {
                  queryClient.invalidateQueries({ queryKey: ["remarketing", "transcripts", id] });
                }}
              />
            </CardContent>
          </Card>

          <TranscriptsListCard
            transcripts={transcripts}
            buyerId={firm.id}
            onAddTranscript={(text, source, fileName, fileUrl, triggerExtract) =>
              addTranscriptMutation.mutateAsync({ text, source, fileName, fileUrl, triggerExtract })
            }
            onExtract={(transcriptId) => handleSingleExtractWithSummary(transcriptId)}
            onExtractAll={handleExtractAll}
            onDelete={(transcriptId) => {
              if (confirm("Delete this transcript?")) deleteTranscriptMutation.mutate(transcriptId);
            }}
            isAdding={addTranscriptMutation.isPending}
            isExtracting={extractTranscriptMutation.isPending || extractionProgress.isRunning}
            extractionProgress={extractionProgress.isRunning ? extractionProgress : undefined}
          />
        </TabsContent>

        {/* Agreements Tab */}
        <TabsContent value="agreements">
          <BuyerAgreementsPanel
            buyerId={firm.id}
            marketplaceFirmId={firm.marketplace_firm_id || null}
            hasFeeAgreement={firm.has_fee_agreement || false}
            feeAgreementSource={firm.fee_agreement_source || null}
          />
        </TabsContent>
      </Tabs>

      {/* Add Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Firm Contact</DialogTitle>
            <DialogDescription>Add a partner, VP, or deal team member at {firm.company_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Name *</Label>
              <Input id="contact_name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email</Label>
              <Input id="contact_email" type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Phone</Label>
              <Input id="contact_phone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_role">Role</Label>
              <Input id="contact_role" placeholder="e.g., Managing Partner, VP of BD" value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_linkedin">LinkedIn URL</Label>
              <Input id="contact_linkedin" placeholder="https://linkedin.com/in/..." value={newContact.linkedin_url} onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => addContactMutation.mutate()} disabled={!newContact.name || addContactMutation.isPending}>
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExtractionSummaryDialog
        open={extractionSummary.open}
        onOpenChange={(open) => setExtractionSummary((prev) => ({ ...prev, open }))}
        results={extractionSummary.results}
        totalCount={extractionSummary.totalCount}
        successCount={extractionSummary.successCount}
        errorCount={extractionSummary.errorCount}
      />
    </div>
  );
};

export default PEFirmDetail;
