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
  MessageSquare,
  Send,
  Lock,
  Eye,
  FolderOpen,
  Undo2,
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
import { formatDistanceToNow } from "date-fns";

interface ConnectionRequestActionsProps {
  user: UserType;
  listing?: Listing;
  requestId?: string;
  requestStatus?: "pending" | "approved" | "rejected" | "on_hold";
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
}: ConnectionRequestActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateStatus = useUpdateConnectionRequestStatus();
  const updateAccess = useUpdateAccess();
  const sendMessage = useSendMessage();

  const [showRejectNote, setShowRejectNote] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  // Fetch all connection requests for this user (for BuyerDealsOverview)
  const { data: userRequests = [] } = useUserConnectionRequests(user.id);

  // Fetch current data room access for this buyer + listing
  const { data: accessRecord } = useQuery({
    queryKey: ["buyer-access", listing?.id, user.id],
    queryFn: async () => {
      if (!listing?.id) return null;
      const { data } = await supabase
        .from("data_room_access")
        .select("id, can_view_teaser, can_view_full_memo, can_view_data_room")
        .eq("deal_id", listing.id)
        .eq("marketplace_user_id", user.id)
        .is("revoked_at", null)
        .maybeSingle();
      return data;
    },
    enabled: !!listing?.id,
  });

  const hasFeeAgreement = user.fee_agreement_signed || false;
  const hasNDA = user.nda_signed || false;

  // ─── Decision Handlers ───

  const handleAccept = () => {
    if (!requestId) return;
    updateStatus.mutate({ requestId, status: "approved" });
    sendMessage.mutate({
      connection_request_id: requestId,
      body: "Request accepted. We will begin the documentation process.",
      sender_role: "admin",
      message_type: "decision",
    });
  };

  const handleReject = () => {
    if (!requestId) return;
    const note = rejectNote.trim();
    updateStatus.mutate({
      requestId,
      status: "rejected",
      notes: note || undefined,
    });
    sendMessage.mutate({
      connection_request_id: requestId,
      body: note || "Request declined.",
      sender_role: "admin",
      message_type: "decision",
    });
    setShowRejectNote(false);
    setRejectNote("");
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

  // ─── Status dot helper ───

  const getDocStatusDot = (signed: boolean) => (
    <div
      className={`w-2 h-2 rounded-full ${
        signed ? "bg-emerald-500" : "bg-amber-500"
      }`}
    />
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left Column ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Decision — pending only */}
          {requestStatus === "pending" && requestId && (
            <div className="bg-card border border-border/40 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-primary" />
                Decision
              </h3>
              {!showRejectNote ? (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleAccept}
                    disabled={updateStatus.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectNote(true)}
                    disabled={updateStatus.isPending}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    size="sm"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Add a reason for rejecting this request..."
                    className="text-xs min-h-[60px] resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleReject}
                      disabled={updateStatus.isPending}
                    >
                      <XCircle className="h-3 w-3 mr-1.5" />
                      Confirm Reject
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowRejectNote(false);
                        setRejectNote("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status banner — non-pending */}
          {requestStatus !== "pending" && requestId && (
            <div
              className={`flex items-center justify-between py-2 px-4 rounded-lg border ${
                requestStatus === "approved"
                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                  : requestStatus === "rejected"
                    ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                    : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {requestStatus === "approved" && (
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                )}
                {requestStatus === "rejected" && (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                {requestStatus === "on_hold" && (
                  <Shield className="h-4 w-4 text-amber-600" />
                )}
                <span className="text-sm font-medium capitalize">
                  {requestStatus === "on_hold" ? "On Hold" : requestStatus}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToPending}
                disabled={updateStatus.isPending}
                className="text-xs h-7"
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Reset to Pending
              </Button>
            </div>
          )}

          {/* Read-only document status — accepted only */}
          {requestStatus === "approved" && (
            <div className="bg-card border border-border/40 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                Document Status
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-background/50">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">NDA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getDocStatusDot(hasNDA)}
                    <span className="text-xs text-muted-foreground">
                      {hasNDA ? "Signed" : "Required"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-background/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">Fee Agreement</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getDocStatusDot(hasFeeAgreement)}
                    <span className="text-xs text-muted-foreground">
                      {hasFeeAgreement ? "Signed" : "Required"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Document Access — accepted + listing */}
          {requestStatus === "approved" && listing && (
            <TooltipProvider>
              <div className="bg-card border border-border/40 rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-primary" />
                  Document Access
                </h3>
                <div className="space-y-2">
                  {/* Anonymous Teaser */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-background/50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">
                        Anonymous Teaser
                      </span>
                    </div>
                    <Switch
                      checked={accessRecord?.can_view_teaser ?? false}
                      onCheckedChange={(checked) =>
                        handleDocumentAccessToggle("can_view_teaser", checked)
                      }
                      disabled={updateAccess.isPending}
                      className="scale-90"
                    />
                  </div>

                  {/* Full Memo */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-background/50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">
                        Full Detail Memo
                      </span>
                      {!hasFeeAgreement && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="h-3 w-3 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Requires signed fee agreement
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Switch
                      checked={accessRecord?.can_view_full_memo ?? false}
                      onCheckedChange={(checked) =>
                        handleDocumentAccessToggle("can_view_full_memo", checked)
                      }
                      disabled={updateAccess.isPending || !hasFeeAgreement}
                      className="scale-90"
                    />
                  </div>

                  {/* Data Room */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-background/50">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">Data Room</span>
                      {!hasFeeAgreement && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="h-3 w-3 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Requires signed fee agreement
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Switch
                      checked={accessRecord?.can_view_data_room ?? false}
                      onCheckedChange={(checked) =>
                        handleDocumentAccessToggle("can_view_data_room", checked)
                      }
                      disabled={updateAccess.isPending || !hasFeeAgreement}
                      className="scale-90"
                    />
                  </div>

                  {!hasFeeAgreement && (
                    <p className="text-[11px] text-amber-600 flex items-center gap-1 px-1">
                      <Lock className="h-3 w-3" />
                      Sign a fee agreement to unlock full memo and data room
                      access
                    </p>
                  )}
                </div>
              </div>
            </TooltipProvider>
          )}

          {/* Compact Message Thread */}
          {requestId && (
            <CompactMessageThread connectionRequestId={requestId} />
          )}
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-4">
          <div className="max-w-sm">
            <UserNotesSection
              userId={user.id}
              userName={`${user.first_name} ${user.last_name}`}
            />
          </div>
          {userRequests.length > 1 && (
            <div className="max-w-sm">
              <BuyerDealsOverview
                requests={userRequests}
                currentRequestId={requestId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Compact Message Thread ───

function CompactMessageThread({
  connectionRequestId,
}: {
  connectionRequestId: string;
}) {
  const { data: messages = [] } = useConnectionMessages(connectionRequestId);
  const sendMsg = useSendMessage();
  const markRead = useMarkMessagesReadByAdmin();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark messages as read when viewing
  useEffect(() => {
    if (connectionRequestId) {
      markRead.mutate(connectionRequestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionRequestId, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="bg-card border border-border/40 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-primary" />
        Messages
        {messages.length > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {messages.length}
          </Badge>
        )}
      </h3>

      {/* Message list */}
      <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            No messages yet. Start the conversation below.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.message_type === "decision" || msg.message_type === "system"
                  ? "justify-center"
                  : msg.sender_role === "admin"
                    ? "justify-end"
                    : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                  msg.message_type === "decision" ||
                  msg.message_type === "system"
                    ? "bg-muted/50 text-muted-foreground italic"
                    : msg.sender_role === "admin"
                      ? "bg-primary/10 text-foreground"
                      : "bg-accent/50 text-foreground"
                }`}
              >
                {msg.message_type !== "system" &&
                  msg.message_type !== "decision" && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-medium">
                        {msg.sender_role === "admin"
                          ? "You"
                          : msg.sender?.first_name || "Buyer"}
                      </span>
                      <span className="text-muted-foreground/50 text-[10px]">
                        {formatDistanceToNow(new Date(msg.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}
                <p className="leading-relaxed">{msg.body}</p>
                {(msg.message_type === "system" ||
                  msg.message_type === "decision") && (
                  <span className="text-muted-foreground/50 text-[10px] block mt-0.5">
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          className="flex-1 text-xs border border-border/50 rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!newMessage.trim() || sendMsg.isPending}
          className="h-8 px-3"
        >
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
