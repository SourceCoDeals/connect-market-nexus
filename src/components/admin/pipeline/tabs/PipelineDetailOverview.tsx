import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Linkedin, Building2, Globe, Mail, Phone, Send, AlertCircle, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useUpdateDeal } from '@/hooks/admin/use-deals';
import { useUpdateDealFollowup } from '@/hooks/admin/use-deal-followup';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useConnectionRequestDetails } from '@/hooks/admin/use-connection-request-details';
import { useConnectionMessages, useSendMessage, useMarkMessagesReadByAdmin } from '@/hooks/use-connection-messages';
import { cn } from '@/lib/utils';

interface PipelineDetailOverviewProps {
  deal: Deal;
  onSwitchTab?: (tab: string) => void;
}

export function PipelineDetailOverview({ deal }: PipelineDetailOverviewProps) {
  const { data: allAdminProfiles, isLoading: adminProfilesLoading } = useAdminProfiles();
  const updateDeal = useUpdateDeal();
  const updateDealFollowup = useUpdateDealFollowup();
  const { data: connectionRequestDetails } = useConnectionRequestDetails(deal.connection_request_id);

  const [followedUp, setFollowedUp] = React.useState(deal.followed_up || false);
  const [negativeFollowedUp, setNegativeFollowedUp] = React.useState(deal.negative_followed_up || false);
  const [buyerProfile, setBuyerProfile] = React.useState<any>(null);

  // Messaging
  const connectionRequestId = deal.connection_request_id;
  const { data: messages = [], isLoading: messagesLoading } = useConnectionMessages(connectionRequestId);
  const sendMessage = useSendMessage();
  const markRead = useMarkMessagesReadByAdmin();
  const [newMessage, setNewMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (connectionRequestId && messages.length > 0) {
      markRead.mutate(connectionRequestId);
    }
  }, [connectionRequestId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!newMessage.trim() || !connectionRequestId) return;
    sendMessage.mutate(
      { connection_request_id: connectionRequestId, body: newMessage.trim(), sender_role: 'admin' },
      { onSuccess: () => setNewMessage('') }
    );
  };

  // Fetch buyer profile
  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!connectionRequestDetails?.user_id) return;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, company, phone_number, buyer_type, linkedin_url, website')
        .eq('id', connectionRequestDetails.user_id)
        .maybeSingle();
      setBuyerProfile(data);
    };
    fetchProfile();
  }, [connectionRequestDetails?.user_id]);

  React.useEffect(() => {
    setFollowedUp(deal.followed_up || false);
    setNegativeFollowedUp(deal.negative_followed_up || false);
  }, [deal.followed_up, deal.negative_followed_up]);

  const isValidDate = (value?: string | null) => {
    if (!value) return false;
    return !isNaN(new Date(value!).getTime());
  };

  const formatDateSafely = (value?: string | null) => {
    if (!isValidDate(value)) return 'N/A';
    try { return formatDistanceToNow(new Date(value!), { addSuffix: true }); } catch { return 'N/A'; }
  };

  const handleOwnerChange = (value: string) => {
    updateDeal.mutate({ dealId: deal.deal_id, updates: { assigned_to: value === 'unassigned' ? null : value } });
  };

  const handleFollowupToggle = async (type: 'positive' | 'negative', newValue: boolean) => {
    if (type === 'positive') setFollowedUp(newValue);
    else setNegativeFollowedUp(newValue);

    const requestIds: string[] = [];
    if (deal.connection_request_id) requestIds.push(deal.connection_request_id);

    updateDealFollowup.mutate({
      dealId: deal.deal_id,
      connectionRequestIds: requestIds,
      isFollowedUp: newValue,
      followupType: type,
    });
  };

  // Build combined messages: buyer inquiry as first message, then connection_messages
  const allMessages = React.useMemo(() => {
    const combined: Array<{
      id: string;
      body: string;
      sender_role: string;
      senderName: string;
      created_at: string;
      message_type?: string;
      isInquiry?: boolean;
    }> = [];

    // Add the buyer's original inquiry as the first message
    if (connectionRequestDetails?.user_message) {
      combined.push({
        id: 'inquiry',
        body: connectionRequestDetails.user_message,
        sender_role: 'buyer',
        senderName: deal.contact_name || 'Buyer',
        created_at: connectionRequestDetails.created_at || deal.deal_created_at,
        isInquiry: true,
      });
    }

    // Add all connection messages
    messages.forEach((msg) => {
      const isAdmin = msg.sender_role === 'admin';
      const senderName = msg.sender
        ? `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim() || msg.sender.email || 'Unknown'
        : isAdmin ? 'Admin' : deal.contact_name || 'Buyer';
      combined.push({
        id: msg.id,
        body: msg.body,
        sender_role: msg.sender_role,
        senderName,
        created_at: msg.created_at,
        message_type: msg.message_type,
      });
    });

    return combined;
  }, [connectionRequestDetails, messages, deal.contact_name, deal.deal_created_at]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-1 min-h-0">
        {/* Left Column - Messages */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-border/40">
          {!connectionRequestId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3 max-w-xs">
                <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No messaging available</p>
                <p className="text-xs text-muted-foreground/60">
                  This deal was not created from a marketplace connection request.
                </p>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 px-6">
                <div className="py-4 space-y-3">
                  {messagesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/20 animate-pulse h-16" />
                      ))}
                    </div>
                  ) : allMessages.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                      <p className="text-xs text-muted-foreground/60">Send a message to start the conversation.</p>
                    </div>
                  ) : (
                    allMessages.map((msg) => {
                      const isAdmin = msg.sender_role === 'admin';
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'max-w-[85%] rounded-xl px-4 py-3 space-y-1',
                            isAdmin
                              ? 'ml-auto bg-primary/10 border border-primary/20'
                              : 'mr-auto bg-muted/30 border border-border/40'
                          )}
                        >
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="font-medium">{msg.senderName}</span>
                            <span>·</span>
                            <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                            {msg.isInquiry && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground font-medium text-[10px]">
                                Initial Inquiry
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{msg.body}</p>
                          {msg.message_type === 'decision' && (
                            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground font-medium">
                              Decision
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              {/* Compose bar */}
              <div className="border-t border-border/40 px-6 py-3">
                <div className="flex items-end gap-3">
                  <Textarea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[50px] max-h-[100px] resize-none text-sm flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sendMessage.isPending}
                    className="h-9 px-4"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Send
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Cmd/Ctrl + Enter to send</p>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar - Buyer Details */}
        <div className="w-72 flex-shrink-0 overflow-y-auto px-6 py-6 space-y-5">
          {/* Deal Owner */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Owner</Label>
            <Select
              value={deal.assigned_to || 'unassigned'}
              onValueChange={handleOwnerChange}
              disabled={adminProfilesLoading || updateDeal.isPending}
            >
              <SelectTrigger className="w-full h-8 text-sm">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {allAdminProfiles && Object.values(allAdminProfiles).map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>{admin.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-border" />

          {/* Contact Info */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Contact</Label>
            <p className="text-sm text-foreground font-medium">{deal.contact_name || 'Unknown'}</p>

            {(buyerProfile?.linkedin_url || deal.contact_email) && (
              <div className="space-y-1.5">
                {buyerProfile?.linkedin_url && (
                  <a href={buyerProfile.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Linkedin className="w-3 h-3" />
                    LinkedIn
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {deal.contact_email && (
                  <a href={`mailto:${deal.contact_email}`} className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono truncate">{deal.contact_email}</span>
                  </a>
                )}
                {(deal.contact_phone || buyerProfile?.phone_number) && (
                  <a href={`tel:${deal.contact_phone || buyerProfile?.phone_number}`} className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <span>{deal.contact_phone || buyerProfile?.phone_number}</span>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Company */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Company</Label>
            {deal.contact_company && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm text-foreground">{deal.contact_company}</span>
              </div>
            )}
            {buyerProfile?.website && (
              <a href={buyerProfile.website.startsWith('http') ? buyerProfile.website : `https://${buyerProfile.website}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Globe className="w-3 h-3" />
                Website
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {buyerProfile?.buyer_type && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Type</Label>
                <p className="text-sm text-foreground">{buyerProfile.buyer_type}</p>
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Deal Metadata */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Stage Duration</Label>
              <p className="text-sm text-foreground">{formatDateSafely(deal.deal_stage_entered_at)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Deal Age</Label>
              <p className="text-sm text-foreground">{formatDateSafely(deal.deal_created_at)}</p>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Follow-up Toggles */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Follow-up</Label>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground">Positive</span>
              <Switch checked={followedUp} onCheckedChange={(v) => handleFollowupToggle('positive', v)} className="scale-75" />
            </div>
            {followedUp && deal.followed_up_at && (
              <p className="text-[10px] text-muted-foreground">
                {formatDateSafely(deal.followed_up_at)}
                {deal.followed_up_by && allAdminProfiles?.[deal.followed_up_by] && ` by ${allAdminProfiles[deal.followed_up_by].displayName}`}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground">Rejection</span>
              <Switch checked={negativeFollowedUp} onCheckedChange={(v) => handleFollowupToggle('negative', v)} className="scale-75" />
            </div>
            {negativeFollowedUp && deal.negative_followed_up_at && (
              <p className="text-[10px] text-muted-foreground">
                {formatDateSafely(deal.negative_followed_up_at)}
                {deal.negative_followed_up_by && allAdminProfiles?.[deal.negative_followed_up_by] && ` by ${allAdminProfiles[deal.negative_followed_up_by].displayName}`}
              </p>
            )}
          </div>

          {deal.deal_score != null && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Deal Score</Label>
                <p className="text-sm text-foreground font-mono">{deal.deal_score}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
