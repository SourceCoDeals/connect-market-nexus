import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const usePEFirmData = () => {
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
          // Error fetching deal scores — skipping this chunk
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

  return {
    id,
    navigate,
    queryClient,
    firm,
    firmLoading,
    platforms,
    platformsLoading,
    contacts,
    dealScores,
    dealStats,
    transcripts,
    universes,
    isContactDialogOpen,
    setIsContactDialogOpen,
    isAddPlatformDialogOpen,
    setIsAddPlatformDialogOpen,
    newContact,
    setNewContact,
    newPlatform,
    setNewPlatform,
    updateFirmMutation,
    addContactMutation,
    deleteContactMutation,
    addPlatformMutation,
  };
};
