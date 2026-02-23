import { useState, useEffect, useRef } from "react";
import { useConnectionRequestFirm } from "@/hooks/admin/use-connection-request-firm";
import { SendAgreementDialog } from "@/components/docuseal/SendAgreementDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Shield,
  CheckCircle,
  XCircle,
  Send,
  Lock,
  Eye,
  Undo2,
  Scale,
  Link2,
} from "lucide-react";
import { UserNotesSection } from "./UserNotesSection";
import { User as UserType, Listing } from "@/types";

import { useUpdateConnectionRequestStatus } from "@/hooks/admin/use-connection-request-status";
import { useUserConnectionRequests } from "@/hooks/admin/use-user-connection-requests";
import { useUpdateAccess } from "@/hooks/admin/data-room/use-data-room";
import {
  useConnectionMessages,
  useSendMessage,
  useMarkMessagesReadByAdmin,
} from "@/hooks/use-connection-messages";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { getBuyerTier, getProfileCompletionDetails } from "@/lib/buyer-metrics";
import { processUrl } from "@/lib/url-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConnectionRequestActionsProps {
  user: UserType;
  listing?: Listing;
  requestId?: string;
  requestStatus?: "pending" | "approved" | "rejected" | "on_hold";
  userMessage?: string;
  createdAt?: string;
  // Legacy props — kept for call-site compatibility
  followedUp?: boolean;
  negativeFollowedUp?: boolean;
  onEmailSent?: () => void;
  onLocalStateUpdate?: (
    updatedUser: UserType,
    updatedFollowedUp?: boolean,
    updatedNegativeFollowedUp?: boolean
  ) => void;
}

export function ConnectionRequestActions({
  user,
  listing,
  requestId,
  requestStatus = "pending",
  userMessage,
  createdAt,
}: ConnectionRequestActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateStatus = useUpdateConnectionRequestStatus();
  const updateAccess = useUpdateAccess();
  const sendMessage = useSendMessage();
  const { data: firmInfo } = useConnectionRequestFirm(requestId || null);

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [sendAgreementOpen, setSendAgreementOpen] = useState(false);
  const [sendAgreementType, setSendAgreementType] = useState<'nda' | 'fee_agreement'>('nda');
  const [rejectNote, setRejectNote] = useState("");
  const [activeTab, setActiveTab] = useState<"thread" | "notes">("thread");
  const [pendingAccessToggle, setPendingAccessToggle] = useState<{
    field: "can_view_teaser" | "can_view_full_memo" | "can_view_data_room";
    newValue: boolean;
    label: string;
  } | null>(null);

  // Fetch all connection requests for this user (for BuyerDealsOverview)
  const { data: userRequests = [] } = useUserConnectionRequests(user.id);

  // Fetch current data room access for this buyer + listing
  const { data: accessRecord } = useQuery({
    queryKey: ["buyer-access", listing?.id, user.id],
    queryFn: async () => {
      if (!listing?.id) return null;
      const { data, error } = await supabase
        .from("data_room_access")
        .select("id, can_view_teaser, can_view_full_memo, can_view_data_room")
        .eq("deal_id", listing.id)
        .eq("marketplace_user_id", user.id)
        .is("revoked_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!listing?.id,
  });

  const hasFeeAgreement = user.fee_agreement_signed || false;
  const hasNDA = user.nda_signed || false;

  // ─── Decision Handlers ───

  const handleAccept = async () => {
    if (!requestId) return;
    try {
      await updateStatus.mutateAsync({ requestId, status: "approved" });
      await sendMessage.mutateAsync({
        connection_request_id: requestId,
        body: "We have sent you a brief overview of the deal. Please let us know if you are still interested.",
        sender_role: "admin",
        message_type: "decision",
      });
      toast({ title: "Request approved", description: "Buyer has been notified." });
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Could not complete the action.",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!requestId) return;
    const note = rejectNote.trim();
    try {
      await updateStatus.mutateAsync({
        requestId,
        status: "rejected",
        notes: note || undefined,
      });
      await sendMessage.mutateAsync({
        connection_request_id: requestId,
        body: note || "Request declined.",
        sender_role: "admin",
        message_type: "decision",
      });
      setShowRejectDialog(false);
      setRejectNote("");
      toast({ title: "Request declined", description: "Buyer has been notified." });
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Could not complete the action.",
        variant: "destructive",
      });
    }
  };

  const handleResetToPending = () => {
    if (!requestId) return;
    updateStatus.mutate({ requestId, status: "pending" });
  };

  // ─── Document Access ───

  const requestAccessToggle = (
    field: "can_view_teaser" | "can_view_full_memo" | "can_view_data_room",
    newValue: boolean
  ) => {
    if (!listing?.id) return;
    if (
      (field === "can_view_full_memo" || field === "can_view_data_room") &&
      newValue &&
      !hasFeeAgreement
    ) {
      toast({
        title: "Fee Agreement Required",
        description:
          "A signed fee agreement is required before releasing the full memo or data room access.",
        variant: "destructive",
      });
      return;
    }
    const labels: Record<string, string> = {
      can_view_teaser: "Teaser",
      can_view_full_memo: "Full Memo",
      can_view_data_room: "Data Room",
    };
    setPendingAccessToggle({ field, newValue, label: labels[field] });
  };

  const confirmAccessToggle = () => {
    if (!pendingAccessToggle || !listing?.id) return;
    const { field, newValue } = pendingAccessToggle;
    updateAccess.mutate(
      {
        deal_id: listing.id,
        marketplace_user_id: user.id,
        can_view_teaser:
          field === "can_view_teaser"
            ? newValue
            : (accessRecord?.can_view_teaser ?? false),
        can_view_full_memo:
          field === "can_view_full_memo"
            ? newValue
            : (accessRecord?.can_view_full_memo ?? false),
        can_view_data_room:
          field === "can_view_data_room"
            ? newValue
            : (accessRecord?.can_view_data_room ?? false),
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ["buyer-access", listing?.id, user.id],
          });
        },
      }
    );
    setPendingAccessToggle(null);
  };

  const getDocStatusDot = (signed: boolean) => (
    <div
      className={`w-2 h-2 rounded-full ${
        signed ? "bg-emerald-500" : "bg-amber-500"
      }`}
    />
  );

  const tierInfo = getBuyerTier(user);
  const completionDetails = getProfileCompletionDetails(user);
  const completeness = completionDetails.percentage;
  const buyerInitials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();

  const buyerName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const firmName = user.company || user.company_name || '';
  const buyerEmail = user.email || '';
  const formattedDate = createdAt ? format(new Date(createdAt), 'MMM d, yyyy') : '';
  const aum = user.aum;

  const otherRequests = userRequests.filter(r => r.id !== requestId);

  return (
    <div className="space-y-5">
      {/* ── DECISION BANNER ── */}
       {requestStatus === "pending" && requestId && (
        <div className="bg-sourceco rounded-xl overflow-hidden shadow-md">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sourceco-foreground/15 flex items-center justify-center shrink-0">
                <Scale className="h-5 w-5 text-sourceco-foreground" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-sourceco-foreground">Decision Required</p>
                <p className="text-sm text-sourceco-foreground/75">Review this connection request — only approved requests advance to the active pipeline</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sourceco-foreground/80 bg-sourceco-foreground/15 rounded-full px-3 py-1">
                Awaiting Action
              </span>
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(true)}
                disabled={updateStatus.isPending}
                size="sm"
                className="border-sourceco-foreground/30 text-sourceco-foreground bg-transparent hover:bg-sourceco-foreground/10 hover:border-sourceco-foreground/50"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Decline
              </Button>
              <Button
                onClick={handleAccept}
                disabled={updateStatus.isPending}
                size="sm"
                className="bg-sourceco-foreground text-sourceco shadow-sm hover:bg-sourceco-foreground/90"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Accept Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status banner — approved */}
      {requestStatus === "approved" && requestId && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Request Approved</p>
              <p className="text-xs text-emerald-700">This buyer has been moved to the pipeline.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleResetToPending} disabled={updateStatus.isPending} className="text-xs h-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-200/50">
            <Undo2 className="h-3 w-3 mr-1" /> Undo
          </Button>
        </div>
      )}

      {/* Status banner — rejected */}
      {requestStatus === "rejected" && requestId && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">Request Declined</p>
              <p className="text-xs text-red-700">This buyer has been notified.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleResetToPending} disabled={updateStatus.isPending} className="text-xs h-7 text-red-700 hover:text-red-800 hover:bg-red-200/50">
            <Undo2 className="h-3 w-3 mr-1" /> Undo
          </Button>
        </div>
      )}

      {/* Status banner — on hold */}
      {requestStatus === "on_hold" && requestId && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">On Hold</p>
              <p className="text-xs text-amber-700">This request is paused for review.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleResetToPending} disabled={updateStatus.isPending} className="text-xs h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-200/50">
            <Undo2 className="h-3 w-3 mr-1" /> Undo
          </Button>
        </div>
      )}

      {/* Document status + access for approved */}
      {requestStatus === "approved" && listing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
              <FileText className="h-3.5 w-3.5" /> Document Status
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                <span className="text-xs font-medium">NDA</span>
                <div className="flex items-center gap-1.5">{getDocStatusDot(hasNDA)}<span className="text-xs text-muted-foreground">{hasNDA ? "Signed" : "Required"}</span></div>
              </div>
              <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                <span className="text-xs font-medium">Fee Agreement</span>
                <div className="flex items-center gap-1.5">{getDocStatusDot(hasFeeAgreement)}<span className="text-xs text-muted-foreground">{hasFeeAgreement ? "Signed" : "Required"}</span></div>
              </div>
            </div>
          </div>
          <TooltipProvider>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
                <Eye className="h-3.5 w-3.5" /> Document Access
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                  <span className="text-xs font-medium">Teaser</span>
                  <Switch checked={accessRecord?.can_view_teaser ?? false} onCheckedChange={(checked) => requestAccessToggle("can_view_teaser", checked)} disabled={updateAccess.isPending} className="scale-75" />
                </div>
                <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">Full Memo</span>
                    {!hasFeeAgreement && <Tooltip><TooltipTrigger asChild><Lock className="h-3 w-3 text-amber-500" /></TooltipTrigger><TooltipContent side="top" className="text-xs">Requires signed fee agreement</TooltipContent></Tooltip>}
                  </div>
                  <Switch checked={accessRecord?.can_view_full_memo ?? false} onCheckedChange={(checked) => requestAccessToggle("can_view_full_memo", checked)} disabled={updateAccess.isPending || !hasFeeAgreement} className="scale-75" />
                </div>
                <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">Data Room</span>
                    {!hasFeeAgreement && <Tooltip><TooltipTrigger asChild><Lock className="h-3 w-3 text-amber-500" /></TooltipTrigger><TooltipContent side="top" className="text-xs">Requires signed fee agreement</TooltipContent></Tooltip>}
                  </div>
                  <Switch checked={accessRecord?.can_view_data_room ?? false} onCheckedChange={(checked) => requestAccessToggle("can_view_data_room", checked)} disabled={updateAccess.isPending || !hasFeeAgreement} className="scale-75" />
                </div>
              </div>
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* ── TWO-COLUMN LAYOUT ── */}
      {/* Buyer Hero Card — full width */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Top row: Avatar + Name + AUM */}
        <div className="px-6 py-5 flex items-start gap-4">
          {/* Avatar */}
          <div className="w-[54px] h-[54px] rounded-full bg-primary border-2 border-sourceco flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>{buyerInitials}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{buyerName}</h2>
              {user.linkedin_profile && (
                <a href={processUrl(user.linkedin_profile)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-sourceco hover:underline">
                  LinkedIn ↗
                </a>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user.job_title ? `${user.job_title} at ` : ''}{firmName}
            </p>
            {buyerEmail && (
              <p className="text-sm text-muted-foreground/70 mt-0.5">✉ {buyerEmail}</p>
            )}
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              {tierInfo.description && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-foreground">{tierInfo.description}</span>
              )}
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sourceco/15 text-foreground">Marketplace</span>
              {firmName && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sourceco/10 text-sourceco">
                  {firmName}
                </span>
              )}
            </div>
          </div>

          {/* Right: AUM block */}
          <div className="text-right shrink-0 flex flex-col items-end gap-3">
            {aum && (
              <div className="bg-primary rounded-xl px-5 py-3 inline-block">
                <p className="text-2xl font-extrabold text-primary-foreground tracking-tight leading-none" style={{ fontFamily: 'Manrope, sans-serif' }}>{aum}</p>
                <p className="text-[10px] uppercase tracking-widest text-sourceco mt-1">Assets Under Mgmt.</p>
              </div>
            )}
            <div className="w-36">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">Profile</span>
                <span className={`text-xs font-bold ${completeness >= 70 ? 'text-sourceco' : 'text-muted-foreground'}`}>{completeness}%</span>
              </div>
              <div className="h-[5px] bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all bg-sourceco"
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: Company summary stats */}
        <div className="border-t border-border px-6 py-4 bg-muted/30">
          <div className="grid grid-cols-3 gap-6">
            {/* Company Description */}
            <div className="col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">About</p>
              <p className="text-sm text-foreground leading-relaxed">
                {user.bio || `${firmName || buyerName} — ${tierInfo.description || 'Marketplace buyer'}. ${user.business_categories && Array.isArray(user.business_categories) && user.business_categories.length > 0 ? `Focused on ${(user.business_categories as string[]).slice(0, 3).join(', ')}.` : 'No additional details on file.'}`}
              </p>
            </div>

            {/* Key stats */}
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Joined</p>
                <p className="text-sm font-medium text-foreground">{user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Request Date</p>
                <p className="text-sm font-medium text-foreground">{formattedDate || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-4">
          {/* Buyer Hero Card moved to full-width above grid */}

          {/* Tabs + Conversation */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {/* Tab bar */}
            <div className="border-b border-border px-5 flex items-center bg-muted/30">
              <button
                className={`py-3 px-1 text-[13.5px] font-medium border-b-2 transition-colors mr-5 ${
                  activeTab === "thread"
                    ? "border-sourceco text-sourceco font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("thread")}
              >
                Conversation Thread
              </button>
              <button
                className={`py-3 px-1 text-[13.5px] font-medium border-b-2 transition-colors ${
                  activeTab === "notes"
                    ? "border-sourceco text-sourceco font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("notes")}
              >
                Internal Notes
              </button>
            </div>

            {activeTab === "thread" && requestId && (
              <ConversationThread
                connectionRequestId={requestId}
                buyerName={buyerName}
                buyerInitials={buyerInitials}
                buyerMessage={userMessage}
                submittedAt={createdAt}
              />
            )}

            {activeTab === "notes" && (
              <div className="p-5 bg-muted/20">
                <div className="bg-muted/50 border border-border rounded-lg px-4 py-2.5 mb-4 text-xs text-foreground flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  Internal notes are only visible to your team — buyers cannot see these.
                </div>
                <UserNotesSection userId={user.id} userName={buyerName} />
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="space-y-4">



          {/* Agreements */}
          <SidebarCard title="Agreements">
            <div className="space-y-0">
              <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-b-0">
                <span className="text-base text-muted-foreground font-medium">NDA</span>
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${hasNDA ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-base font-semibold text-foreground">
                    {user.nda_signed ? 'Signed' : user.nda_email_sent ? 'Sent' : 'Not Sent'}
                  </span>
                  {!hasNDA && firmInfo?.firm_id && (
                    <button
                      onClick={() => { setSendAgreementType('nda'); setSendAgreementOpen(true); }}
                      className="text-sm font-bold text-sourceco-foreground bg-sourceco border border-sourceco rounded-md px-3 py-1 hover:bg-sourceco/90 transition-colors shadow-sm"
                    >
                      ↗ Send
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-base text-muted-foreground font-medium">Fee Agreement</span>
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${hasFeeAgreement ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-base font-semibold text-foreground">
                    {user.fee_agreement_signed ? 'Signed' : user.fee_agreement_email_sent ? 'Sent' : 'Not Sent'}
                  </span>
                  {!hasFeeAgreement && firmInfo?.firm_id && (
                    <button
                      onClick={() => { setSendAgreementType('fee_agreement'); setSendAgreementOpen(true); }}
                      className="text-sm font-bold text-sourceco-foreground bg-sourceco border border-sourceco rounded-md px-3 py-1 hover:bg-sourceco/90 transition-colors shadow-sm"
                    >
                      ↗ Send
                    </button>
                  )}
                </div>
              </div>
            </div>
          </SidebarCard>

          {/* Requested Deal */}
          {listing && (
            <SidebarCard title="Requested Deal">
              <div>
                {/* Tags */}
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {listing.category && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{listing.category}</span>
                  )}
                  {listing.location && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{listing.location}</span>
                  )}
                </div>
                {/* Title */}
                <button
                  onClick={() => window.open(`/listing/${listing.id}`, '_blank')}
                  className="text-base font-bold text-foreground hover:text-sourceco transition-colors text-left leading-snug"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {listing.title}
                </button>
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                  <div className="bg-muted/40 border border-border rounded-lg px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">EBITDA</p>
                    <p className="text-xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {listing.ebitda ? `$${Number(listing.ebitda).toLocaleString()}` : 'TBD'}
                    </p>
                  </div>
                  <div className="bg-muted/40 border border-border rounded-lg px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Ask Price</p>
                    <p className="text-xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {(listing as any).asking_price ? `$${Number((listing as any).asking_price).toLocaleString()}` : 'TBD'}
                    </p>
                  </div>
                </div>
              </div>
            </SidebarCard>
          )}

          {/* Other Active Interests */}
          {otherRequests.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-[1.2px] text-muted-foreground">Other Active Interests</h3>
                <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-sourceco/10 text-sourceco border border-sourceco/15">
                  {otherRequests.length}
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {otherRequests.map((req) => (
                  <a
                    key={req.id}
                    href={`/listing/${req.listing_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-snug">
                          {req.listing?.title || 'Unknown Listing'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {req.listing?.revenue ? `$${Number(req.listing.revenue).toLocaleString()}` : 'N/A'} · {req.listing?.location || 'N/A'}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap tracking-wide ${
                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                        req.status === 'rejected' ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Declined' : 'Pending'}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
              <div className="text-sm text-muted-foreground text-center py-3 border-t border-border/30 cursor-pointer hover:text-sourceco transition-colors">
                Follow-up actions apply to all active requests ›
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── REJECT CONFIRMATION DIALOG ── */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Reject this request?</DialogTitle>
            <DialogDescription className="text-sm">
              <span className="font-medium text-foreground">{buyerName}</span> from{" "}
              <span className="font-medium text-foreground">{firmName || 'Unknown Firm'}</span>{" "}
              will be notified that their connection request
              {listing ? ` for "${listing.title}"` : ''} was not approved. This action can be undone.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Add a reason for rejecting (optional)..."
            className="min-h-[80px] resize-none text-sm"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectNote(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={updateStatus.isPending} className="bg-red-600 hover:bg-red-700">
              <XCircle className="h-4 w-4 mr-2" /> Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DOCUMENT ACCESS CONFIRMATION DIALOG ── */}
      <Dialog open={!!pendingAccessToggle} onOpenChange={(open) => { if (!open) setPendingAccessToggle(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {pendingAccessToggle?.newValue ? "Grant" : "Revoke"} {pendingAccessToggle?.label} Access?
            </DialogTitle>
            <DialogDescription className="text-sm">
              {pendingAccessToggle?.newValue
                ? `This will allow ${buyerName} to view the ${pendingAccessToggle?.label}.`
                : `This will remove ${buyerName}'s access to the ${pendingAccessToggle?.label}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingAccessToggle(null)}>Cancel</Button>
            <Button onClick={confirmAccessToggle} disabled={updateAccess.isPending} className="bg-sourceco hover:bg-sourceco/90 text-sourceco-foreground">
              {pendingAccessToggle?.newValue ? "Grant Access" : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {firmInfo?.firm_id && (
        <SendAgreementDialog
          open={sendAgreementOpen}
          onOpenChange={setSendAgreementOpen}
          firmId={firmInfo.firm_id}
          documentType={sendAgreementType}
          buyerEmail={buyerEmail}
          buyerName={buyerName || buyerEmail}
          firmName={firmInfo.firm_name || undefined}
        />
      )}
    </div>
  );
}

// ─── Sidebar Card ───

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-border bg-muted/30">
        <h3 className="text-xs font-bold uppercase tracking-[1.2px] text-muted-foreground">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Conversation Thread ───

function ConversationThread({
  connectionRequestId,
  buyerName,
  buyerInitials,
  buyerMessage,
  submittedAt,
}: {
  connectionRequestId: string;
  buyerName: string;
  buyerInitials: string;
  buyerMessage?: string;
  submittedAt?: string;
}) {
  const { data: messages = [] } = useConnectionMessages(connectionRequestId);
  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesReadByAdmin();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (connectionRequestId) {
      markRead.mutate(connectionRequestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionRequestId, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMsg.mutate({
      connection_request_id: connectionRequestId,
      body: newMessage.trim(),
      sender_role: "admin",
    });
    setNewMessage("");
  };

  

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="min-h-[300px] max-h-[500px] overflow-y-auto p-6 space-y-5 bg-sourceco-muted/30">
        {/* Buyer's opening message — always first */}
        {buyerMessage && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-sourceco flex items-center justify-center text-sourceco-foreground text-xs font-bold shrink-0 shadow-sm">
                {buyerInitials}
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[15px] font-semibold text-foreground">{buyerName}</span>
                <span className="text-xs text-muted-foreground">
                  {submittedAt ? format(new Date(submittedAt), 'MMM d, yyyy') : ''}
                </span>
              </div>
              <Badge variant="outline" className="text-xs bg-sourceco/10 text-sourceco-muted-foreground border-sourceco/30 shrink-0 font-medium px-2.5 py-1">
                <Link2 className="h-3 w-3 mr-1.5" />
                Connection Request
              </Badge>
            </div>
            <div className="ml-12">
              <div className="bg-sourceco-muted border border-sourceco/30 text-foreground rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                <p className="text-sm leading-relaxed">{buyerMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* No messages empty state */}
        {messages.length === 0 && !buyerMessage && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <Send className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              No messages yet — respond below to start the conversation.
            </p>
          </div>
        )}

        {messages.length === 0 && buyerMessage && (
          <p className="text-sm text-muted-foreground italic text-center py-3">
            No replies yet — respond below to start the conversation.
          </p>
        )}

        {/* Subsequent messages */}
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.message_type === "decision" || msg.message_type === "system" ? (
              <div className="bg-sourceco/10 border border-sourceco/30 rounded-lg px-5 py-3 text-center mx-auto max-w-md">
                <p className="text-sm text-foreground">{msg.body}</p>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                </span>
              </div>
            ) : msg.sender_role === "admin" ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                  <span className="text-sm font-semibold text-foreground">You</span>
                  <div className="w-8 h-8 rounded-full bg-sourceco/20 flex items-center justify-center text-xs font-bold text-sourceco-muted-foreground">
                    SC
                  </div>
                </div>
                <div className="mr-10 bg-sourceco/10 border border-sourceco/20 text-foreground rounded-2xl rounded-tr-sm px-5 py-4 max-w-[85%] shadow-sm">
                  <p className="text-sm leading-relaxed">{msg.body}</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-sourceco flex items-center justify-center text-sourceco-foreground text-[10px] font-bold shadow-sm">
                    {buyerInitials}
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {msg.sender?.first_name || buyerName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="ml-10 bg-sourceco-muted/50 border border-sourceco/20 text-foreground rounded-2xl rounded-tl-sm px-5 py-4 max-w-[85%] shadow-sm">
                  <p className="text-sm leading-relaxed">{msg.body}</p>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-sourceco/20 p-5 bg-sourceco-muted/20">
        <div className="border border-sourceco/30 rounded-xl overflow-hidden focus-within:border-sourceco/60 focus-within:ring-2 focus-within:ring-sourceco/15 transition-all bg-background">
          <textarea
            rows={3}
            placeholder="Reply to this buyer..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="w-full border-none resize-none text-sm text-foreground bg-transparent px-5 py-4 focus:outline-none placeholder:text-muted-foreground/60"
          />
           <div className="flex items-center justify-between px-4 py-3 border-t border-sourceco/15 bg-sourceco-muted/20">
            <span className="text-xs text-muted-foreground">⌘ + Enter to send</span>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMsg.isPending}
              className="h-9 px-5 text-sm font-semibold bg-sourceco hover:bg-sourceco/90 text-sourceco-foreground shadow-sm"
            >
              <Send className="h-3.5 w-3.5 mr-2" />
              Send Reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
