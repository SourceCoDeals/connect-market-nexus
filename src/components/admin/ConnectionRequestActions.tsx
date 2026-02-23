import { useState, useEffect, useRef } from "react";
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
  ExternalLink,
  Building2,
  User,
  Link2,
} from "lucide-react";
import { UserNotesSection } from "./UserNotesSection";
import { User as UserType, Listing } from "@/types";
import { BuyerDealsOverview } from "./BuyerDealsOverview";
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

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [activeTab, setActiveTab] = useState<"thread" | "notes">("thread");

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
        body: "Request accepted. We will begin the documentation process.",
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

  const handleDocumentAccessToggle = (
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

  return (
    <div className="space-y-4 bg-sourceco-background rounded-xl p-5">
      {/* ── DECISION BANNER ── */}
      {requestStatus === "pending" && requestId && (
        <div className="rounded-xl border-2 border-sourceco/40 shadow-lg overflow-hidden">
          {/* Amber header */}
          <div className="bg-gradient-to-r from-sourceco-muted to-sourceco-muted/60 border-b border-sourceco/30 px-5 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sourceco flex items-center justify-center shrink-0">
              <Scale className="h-4 w-4 text-sourceco-foreground" />
            </div>
            <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Decision Required</p>
              <p className="text-xs text-muted-foreground">Review this connection request and accept or decline</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-sourceco/20 border border-sourceco/40 rounded-md px-2.5 py-1">
              Awaiting Action
            </span>
          </div>

          {/* Deal context */}
          {listing && (
            <div className="px-5 py-3 bg-primary/5 border-b border-border/40">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Requested Deal</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{listing.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {listing.category}{listing.location ? ` · ${listing.location}` : ''}
                    {listing.revenue ? ` · Revenue: $${Number(listing.revenue).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-5 py-3.5 flex items-center gap-3 bg-sourceco-muted/30">
            <Button
              onClick={handleAccept}
              disabled={updateStatus.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-emerald-500/25 transition-all"
              size="sm"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept Request
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(true)}
              disabled={updateStatus.isPending}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
              size="sm"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Decline
            </Button>
          </div>
        </div>
      )}

      {/* Status banner — approved */}
      {requestStatus === "approved" && requestId && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Request Approved</p>
              <p className="text-xs text-emerald-700">Next steps: send NDA, share full materials, add to pipeline</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToPending}
            disabled={updateStatus.isPending}
            className="text-xs h-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-200/50"
          >
            <Undo2 className="h-3 w-3 mr-1" />
            Undo
          </Button>
        </div>
      )}

      {/* Status banner — rejected */}
      {requestStatus === "rejected" && requestId && (
        <div className="rounded-xl bg-gradient-to-r from-red-50 to-red-100/50 border border-red-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">Request Declined</p>
              <p className="text-xs text-red-700">This buyer has been notified.</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToPending}
            disabled={updateStatus.isPending}
            className="text-xs h-7 text-red-700 hover:text-red-800 hover:bg-red-200/50"
          >
            <Undo2 className="h-3 w-3 mr-1" />
            Undo
          </Button>
        </div>
      )}

      {/* Status banner — on hold */}
      {requestStatus === "on_hold" && requestId && (
        <div className="rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">On Hold</p>
              <p className="text-xs text-amber-700">This request is paused for review.</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToPending}
            disabled={updateStatus.isPending}
            className="text-xs h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-200/50"
          >
            <Undo2 className="h-3 w-3 mr-1" />
            Undo
          </Button>
        </div>
      )}

      {/* Document status + access for approved */}
      {requestStatus === "approved" && listing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Document Status */}
          <div className="bg-primary/[0.03] border border-primary/15 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
              <FileText className="h-3.5 w-3.5" />
              Document Status
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                <span className="text-xs font-medium">NDA</span>
                <div className="flex items-center gap-1.5">
                  {getDocStatusDot(hasNDA)}
                  <span className="text-xs text-muted-foreground">{hasNDA ? "Signed" : "Required"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                <span className="text-xs font-medium">Fee Agreement</span>
                <div className="flex items-center gap-1.5">
                  {getDocStatusDot(hasFeeAgreement)}
                  <span className="text-xs text-muted-foreground">{hasFeeAgreement ? "Signed" : "Required"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Document Access */}
          <TooltipProvider>
            <div className="bg-primary/[0.03] border border-primary/15 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
                <Eye className="h-3.5 w-3.5" />
                Document Access
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                  <span className="text-xs font-medium">Teaser</span>
                  <Switch
                    checked={accessRecord?.can_view_teaser ?? false}
                    onCheckedChange={(checked) => handleDocumentAccessToggle("can_view_teaser", checked)}
                    disabled={updateAccess.isPending}
                    className="scale-75"
                  />
                </div>
                <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">Full Memo</span>
                    {!hasFeeAgreement && (
                      <Tooltip>
                        <TooltipTrigger asChild><Lock className="h-3 w-3 text-amber-500" /></TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Requires signed fee agreement</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Switch
                    checked={accessRecord?.can_view_full_memo ?? false}
                    onCheckedChange={(checked) => handleDocumentAccessToggle("can_view_full_memo", checked)}
                    disabled={updateAccess.isPending || !hasFeeAgreement}
                    className="scale-75"
                  />
                </div>
                <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">Data Room</span>
                    {!hasFeeAgreement && (
                      <Tooltip>
                        <TooltipTrigger asChild><Lock className="h-3 w-3 text-amber-500" /></TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Requires signed fee agreement</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Switch
                    checked={accessRecord?.can_view_data_room ?? false}
                    onCheckedChange={(checked) => handleDocumentAccessToggle("can_view_data_room", checked)}
                    disabled={updateAccess.isPending || !hasFeeAgreement}
                    className="scale-75"
                  />
                </div>
              </div>
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* ── TWO-COLUMN LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* ── LEFT: Conversation Thread ── */}
        <div className="bg-primary/[0.03] border-2 border-primary/15 rounded-xl overflow-hidden shadow-md">
          {/* Tab bar */}
          <div className="border-b border-primary/10 px-5 flex items-center bg-primary/[0.04]">
            <button
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors mr-4 ${
                activeTab === "thread"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("thread")}
            >
              Conversation Thread
            </button>
            <button
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "notes"
                  ? "border-primary text-foreground"
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
              buyerName={`${user.first_name} ${user.last_name}`}
              buyerInitials={buyerInitials}
              buyerMessage={userMessage}
              submittedAt={createdAt}
            />
          )}

          {activeTab === "notes" && (
            <div className="p-5 bg-sourceco-muted/20">
              <div className="bg-sourceco/10 border border-sourceco/30 rounded-lg px-4 py-2.5 mb-4 text-xs text-primary flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Internal notes are only visible to your team — buyers cannot see these.
              </div>
              <UserNotesSection userId={user.id} userName={`${user.first_name} ${user.last_name}`} />
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="space-y-4">
          {/* Buyer Information */}
          <div className="bg-primary/[0.03] border border-primary/15 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-primary/10 bg-primary/[0.05]">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Buyer Information
              </p>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <SidebarField label="Type">
                <span className={`text-xs font-semibold ${tierInfo.color}`}>
                  {tierInfo.description}
                </span>
              </SidebarField>
              <SidebarField label="Email">
                <span className="text-xs font-medium text-foreground">{user.email}</span>
              </SidebarField>
              <SidebarField label="Company">
                {user.website ? (
                  <a href={processUrl(user.website)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 group">
                    {user.company || user.company_name || 'Company'}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ) : (
                  <span className="text-xs font-medium text-foreground">{user.company || user.company_name || '—'}</span>
                )}
              </SidebarField>
              {user.linkedin_profile && (
                <SidebarField label="LinkedIn">
                  <a href={processUrl(user.linkedin_profile)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:text-primary/80">
                    View Profile ↗
                  </a>
                </SidebarField>
              )}
              {user.aum && (
                <SidebarField label="AUM">
                  <span className="text-xs font-medium text-foreground">{user.aum}</span>
                </SidebarField>
              )}

              {/* Profile Completeness */}
              <div className="pt-2 mt-1 border-t border-border/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-muted-foreground font-medium">Profile Completeness</span>
                  <span className={`text-[11px] font-bold ${completeness >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {completeness}%
                  </span>
                </div>
                <div className="h-1.5 bg-border/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      completeness >= 70
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : 'bg-gradient-to-r from-amber-500 to-red-400'
                    }`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Deal Information */}
          {listing && (
            <div className="bg-primary/[0.03] border border-primary/15 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-primary/10 bg-primary/[0.05]">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  Requested Deal
                </p>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                <SidebarField label="Deal">
                  <button
                    onClick={() => window.open(`/listing/${listing.id}`, '_blank')}
                    className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 group text-right"
                  >
                    <span className="truncate max-w-[160px]">{listing.title}</span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                </SidebarField>
                <SidebarField label="Category">
                  <span className="text-xs font-medium text-foreground">{listing.category}</span>
                </SidebarField>
                {listing.location && (
                  <SidebarField label="Location">
                    <span className="text-xs font-medium text-foreground">{listing.location}</span>
                  </SidebarField>
                )}
                {listing.revenue && (
                  <SidebarField label="Revenue">
                    <span className="text-xs font-semibold text-emerald-600">
                      ${Number(listing.revenue).toLocaleString()}
                    </span>
                  </SidebarField>
                )}
              </div>
            </div>
          )}

          {/* General Notes (compact) */}
          <div className="bg-primary/[0.03] border border-primary/15 rounded-xl overflow-hidden shadow-sm">
            <UserNotesSection userId={user.id} userName={`${user.first_name} ${user.last_name}`} />
          </div>

          {/* Other Deals by Buyer */}
          {userRequests.length > 1 && (
            <div className="bg-primary/[0.03] border border-primary/15 rounded-xl overflow-hidden shadow-sm">
              <BuyerDealsOverview
                requests={userRequests}
                currentRequestId={requestId}
              />
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
              <span className="font-medium text-foreground">{user.first_name} {user.last_name}</span> from{" "}
              <span className="font-medium text-foreground">{user.company || user.company_name || 'Unknown Firm'}</span>{" "}
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
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={updateStatus.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sidebar Field Helper ───

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/10 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
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
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 shadow-sm">
                {buyerInitials}
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[15px] font-semibold text-foreground">{buyerName}</span>
                <span className="text-xs text-muted-foreground">
                  {submittedAt ? format(new Date(submittedAt), 'MMM d, yyyy') : ''}
                </span>
              </div>
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 shrink-0 font-medium px-2.5 py-1">
                <Link2 className="h-3 w-3 mr-1.5" />
                Connection Request
              </Badge>
            </div>
            <div className="ml-12">
              <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl rounded-tl-sm px-5 py-4 shadow-md">
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-3 text-center mx-auto max-w-md">
                <p className="text-sm text-amber-800">{msg.body}</p>
                <span className="text-xs text-amber-600 mt-1 block">
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
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    SC
                  </div>
                </div>
                <div className="mr-10 bg-muted text-foreground rounded-2xl rounded-tr-sm px-5 py-4 max-w-[85%] shadow-sm">
                  <p className="text-sm leading-relaxed">{msg.body}</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-[10px] font-bold shadow-sm">
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
      <div className="border-t-2 border-primary/10 p-5 bg-primary/[0.03]">
        <div className="border-2 border-primary/20 rounded-xl overflow-hidden focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-all bg-background">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/30">
            <span className="text-xs text-muted-foreground">⌘ + Enter to send</span>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMsg.isPending}
              className="h-9 px-5 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
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
