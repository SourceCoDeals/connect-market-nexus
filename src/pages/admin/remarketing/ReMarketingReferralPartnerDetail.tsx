import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Copy,
  Edit,
  KeyRound,
  XCircle,
  Plus,
  Upload,
  Loader2,
  Building2,
  Mail,
  Phone,
  Calendar,
  Handshake,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AddPartnerDialog } from "@/components/remarketing/AddPartnerDialog";
import { AddDealDialog } from "@/components/remarketing/AddDealDialog";
import { DealImportDialog } from "@/components/remarketing/DealImportDialog";
import { SubmissionReviewQueue } from "@/components/remarketing/SubmissionReviewQueue";

const formatCurrency = (value: number | null) => {
  if (!value) return "-";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

export default function ReMarketingReferralPartnerDetail() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Fetch partner
  const { data: partner, isLoading: partnerLoading } = useQuery({
    queryKey: ["referral-partners", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_partners")
        .select("*")
        .eq("id", partnerId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });

  // Fetch deals for this partner
  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ["referral-partners", partnerId, "deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(
          `id, title, internal_company_name, location, revenue, ebitda, category, website,
           status, created_at, full_time_employees, address_city, address_state`
        )
        .eq("referral_partner_id", partnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });

  // Fetch pending submissions for this partner
  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ["referral-submissions", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_submissions")
        .select("*")
        .eq("referral_partner_id", partnerId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });

  // Copy share link
  const handleCopyShareLink = () => {
    if (!partner?.share_token) {
      toast.error("No share token available");
      return;
    }
    const url = `${window.location.origin}/referrals/${partner.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard");
  };

  // Reset password
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      const array = new Uint8Array(12);
      crypto.getRandomValues(array);
      const password = Array.from(array, (b) => chars[b % chars.length]).join("");

      const { data: hashResult } = await supabase.functions.invoke(
        "validate-referral-access",
        { body: { action: "hash-password", password } }
      );

      const hash = hashResult?.hash || password;
      const { error } = await supabase
        .from("referral_partners")
        .update({ share_password_hash: hash } as never)
        .eq("id", partnerId!);
      if (error) throw error;
      return password;
    },
    onSuccess: (password) => {
      toast.success(`New password: ${password}`, { duration: 15000 });
    },
    onError: (error) => {
      toast.error(`Failed to reset password: ${error.message}`);
    },
  });

  // Deactivate
  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("referral_partners")
        .update({ is_active: !partner?.is_active } as never)
        .eq("id", partnerId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId] });
      toast.success(partner?.is_active ? "Partner deactivated" : "Partner activated");
    },
  });

  // Handle deal created from AddDealDialog — tag it to this partner
  const handleDealCreated = async () => {
    // The AddDealDialog handles its own creation. We need to tag the most recent deal.
    // Instead, we pass referralPartnerId to AddDealDialog which will handle tagging.
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
  };

  // Handle import complete — tag imported deals to this partner
  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
  };

  const handleImportCompleteWithIds = async (importedIds: string[]) => {
    if (!partnerId || importedIds.length === 0) return;

    // Tag all imported deals with this referral partner
    for (const id of importedIds) {
      await supabase
        .from("listings")
        .update({ referral_partner_id: partnerId } as never)
        .eq("id", id);
    }

    // Update deal count
    const currentCount = partner?.deal_count || 0;
    await supabase
      .from("referral_partners")
      .update({ deal_count: currentCount + importedIds.length } as never)
      .eq("id", partnerId);

    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId] });
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    toast.success(`${importedIds.length} deals tagged to ${partner?.name}`);
  };

  if (partnerLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex-1 p-6">
        <Button variant="ghost" onClick={() => navigate("/admin/remarketing/referral-partners")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Partners
        </Button>
        <div className="text-center py-12 text-muted-foreground">Partner not found</div>
      </div>
    );
  }

  const pendingCount = submissions?.length || 0;

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Back + Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/remarketing/referral-partners")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Partners
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Handshake className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{partner.name}</h1>
                <Badge variant={partner.is_active ? "default" : "secondary"}>
                  {partner.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                {partner.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {partner.company}
                  </span>
                )}
                {partner.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {partner.email}
                  </span>
                )}
                {partner.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {partner.phone}
                  </span>
                )}
                {partner.created_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Added {format(new Date(partner.created_at), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddDealOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Deal
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Import Deals
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deactivateMutation.mutate()}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {partner.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </div>
      </div>

      {/* Share Link Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium mb-1">Partner Tracker Link</p>
              <p className="text-xs text-muted-foreground font-mono">
                {window.location.origin}/referrals/{partner.share_token || "..."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyShareLink}>
                <Copy className="h-3 w-3 mr-1" />
                Copy URL
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetPasswordMutation.mutate()}
                disabled={resetPasswordMutation.isPending}
              >
                <KeyRound className="h-3 w-3 mr-1" />
                Reset Password
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Submissions */}
      {pendingCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Pending Submissions
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                {pendingCount}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SubmissionReviewQueue
              submissions={submissions || []}
              isLoading={submissionsLoading}
              showPartnerColumn={false}
            />
          </CardContent>
        </Card>
      )}

      {/* Deals Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Referred Deals ({deals?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dealsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !deals?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No deals referred by this partner yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">EBITDA</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow
                    key={deal.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}
                  >
                    <TableCell className="font-medium">
                      {deal.internal_company_name || deal.title || "Untitled"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {deal.category || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {deal.address_city && deal.address_state
                        ? `${deal.address_city}, ${deal.address_state}`
                        : deal.location || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(deal.revenue)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(deal.ebitda)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {deal.full_time_employees || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(deal.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddPartnerDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingPartner={partner}
      />

      <AddDealDialog
        open={addDealOpen}
        onOpenChange={setAddDealOpen}
        onDealCreated={handleDealCreated}
        referralPartnerId={partnerId}
      />

      <DealImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
        onImportCompleteWithIds={handleImportCompleteWithIds}
        referralPartnerId={partnerId}
      />
    </div>
  );
}
