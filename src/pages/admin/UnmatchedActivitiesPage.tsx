// ============================================================================
// UnmatchedActivitiesPage
// ============================================================================
// Recovery UI for activity rows that the automated sync pipelines couldn't
// link to a deal. Four tabs cover the four channels:
//
//   - Calls          → contact_activities (matching_status = 'unmatched')
//   - Outlook emails → outlook_unmatched_emails (matched_at IS NULL)
//   - Smartlead      → smartlead_unmatched_messages (matched_at IS NULL)
//   - HeyReach       → heyreach_unmatched_messages (matched_at IS NULL)
//
// Each tab lets the user pick a deal from a dropdown and link the row.
// Linking marks the unmatched row resolved and writes a deal_activities
// log entry so the touch surfaces in the deal's Activity feed immediately.
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, untypedFrom } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Phone,
  Mail,
  Linkedin,
  Send as SmartleadIcon,
  AlertTriangle,
  Link as LinkIcon,
  CheckCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface DealOption {
  id: string;
  listing_id: string;
  title: string | null;
}

function useActiveDeals() {
  return useQuery({
    queryKey: ['active-deals-for-linking'],
    queryFn: async () => {
      const { data, error } = await untypedFrom('deal_pipeline')
        .select('id, listing_id, title')
        .is('deleted_at', null)
        .order('title', { ascending: true })
        .limit(500);
      if (error) return [] as DealOption[];
      return (data || []) as DealOption[];
    },
  });
}

// Shared dropdown + button used in every row.
function DealLinkPicker({
  selected,
  onChange,
  onLink,
  pending,
  deals,
}: {
  selected: string;
  onChange: (val: string) => void;
  onLink: () => void;
  pending: boolean;
  deals: DealOption[];
}) {
  return (
    <div className="flex items-center gap-2">
      <Select value={selected} onValueChange={onChange}>
        <SelectTrigger className="w-[260px] text-xs">
          <SelectValue placeholder="Select deal to link..." />
        </SelectTrigger>
        <SelectContent>
          {deals.map((deal) => (
            <SelectItem key={deal.id} value={`${deal.id}::${deal.listing_id}`}>
              {deal.title || 'Untitled'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={!selected || pending} onClick={onLink}>
        <LinkIcon className="h-3.5 w-3.5 mr-1" />
        Link
      </Button>
    </div>
  );
}

export default function UnmatchedActivitiesPage() {
  const [activeTab, setActiveTab] = useState<'calls' | 'outlook' | 'smartlead' | 'heyreach'>(
    'calls',
  );

  const { data: deals = [] } = useActiveDeals();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Unmatched Activities
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Activities the automated pipelines couldn't link to a deal. Pick a deal and link them to
            recover the data.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calls">
            <Phone className="h-3.5 w-3.5 mr-1.5" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="outlook">
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Outlook emails
          </TabsTrigger>
          <TabsTrigger value="smartlead">
            <SmartleadIcon className="h-3.5 w-3.5 mr-1.5" />
            Smartlead
          </TabsTrigger>
          <TabsTrigger value="heyreach">
            <Linkedin className="h-3.5 w-3.5 mr-1.5" />
            HeyReach LinkedIn
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calls">
          <UnmatchedCallsTab deals={deals} />
        </TabsContent>
        <TabsContent value="outlook">
          <UnmatchedOutlookTab deals={deals} />
        </TabsContent>
        <TabsContent value="smartlead">
          <UnmatchedSmartleadTab deals={deals} />
        </TabsContent>
        <TabsContent value="heyreach">
          <UnmatchedHeyReachTab deals={deals} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Calls tab — preserves original contact_activities behavior ────────────

interface UnmatchedCall {
  id: string;
  activity_type: string;
  contact_email: string | null;
  user_name: string | null;
  call_duration_seconds: number | null;
  disposition_label: string | null;
  created_at: string;
  matching_status: string;
}

function UnmatchedCallsTab({ deals }: { deals: DealOption[] }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['unmatched-activities', 'calls'],
    queryFn: async () => {
      const { data, error } = await untypedFrom('contact_activities')
        .select(
          'id, activity_type, contact_email, user_name, call_duration_seconds, disposition_label, created_at, matching_status',
        )
        .eq('matching_status', 'unmatched')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as UnmatchedCall[];
    },
    staleTime: 30_000,
  });

  const linkMutation = useMutation({
    mutationFn: async ({
      activityId,
      dealId,
      listingId,
    }: {
      activityId: string;
      dealId: string;
      listingId: string;
    }) => {
      const { error: updateErr } = await untypedFrom('contact_activities')
        .update({
          listing_id: listingId,
          matching_status: 'manually_linked',
        })
        .eq('id', activityId);
      if (updateErr) throw updateErr;

      const row = rows.find((r) => r.id === activityId);
      if (row) {
        try {
          await (supabase as any).rpc('log_deal_activity', {
            p_deal_id: dealId,
            p_activity_type:
              row.activity_type === 'call_completed' ? 'call_completed' : 'note_added',
            p_title: `Manually linked: ${row.activity_type} from ${row.contact_email || 'unknown'}`,
            p_description: row.disposition_label || null,
            p_admin_id: null,
            p_metadata: {
              contact_activity_id: activityId,
              contact_email: row.contact_email,
              user_name: row.user_name,
              linked_manually: true,
            },
          });
        } catch (e) {
          console.error('Failed to log deal activity:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-activities'] });
      toast.success('Call linked to deal');
    },
    onError: (err) => toast.error(`Failed to link: ${(err as Error).message}`),
  });

  return (
    <UnmatchedTabBody isLoading={isLoading} empty={rows.length === 0} emptyText="All calls matched">
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="hover:bg-muted/30 transition-colors">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <RowIcon icon={<Phone className="h-5 w-5 text-orange-600" />} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {r.activity_type.replace(/_/g, ' ')}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {r.matching_status}
                    </Badge>
                  </div>
                  <RowMeta>
                    {r.contact_email && <span>{r.contact_email}</span>}
                    {r.user_name && <span>by {r.user_name}</span>}
                    {r.call_duration_seconds != null && (
                      <span>
                        {Math.floor(r.call_duration_seconds / 60)}m {r.call_duration_seconds % 60}s
                      </span>
                    )}
                    {r.disposition_label && <span>{r.disposition_label}</span>}
                  </RowMeta>
                  <RowTimestamp at={r.created_at} />
                </div>
                <DealLinkPicker
                  deals={deals}
                  selected={selected[r.id] || ''}
                  onChange={(val) => setSelected((p) => ({ ...p, [r.id]: val }))}
                  onLink={() => {
                    const [dId, lId] = (selected[r.id] || '').split('::');
                    if (dId && lId)
                      linkMutation.mutate({ activityId: r.id, dealId: dId, listingId: lId });
                  }}
                  pending={linkMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </UnmatchedTabBody>
  );
}

// ── Outlook unmatched emails ──────────────────────────────────────────────

interface UnmatchedOutlook {
  id: string;
  microsoft_message_id: string;
  direction: string;
  from_address: string;
  to_addresses: string[];
  subject: string | null;
  body_preview: string | null;
  sent_at: string;
  participant_emails: string[];
  match_attempt_count: number;
  created_at: string;
}

function UnmatchedOutlookTab({ deals }: { deals: DealOption[] }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['unmatched-activities', 'outlook'],
    queryFn: async () => {
      const { data, error } = await untypedFrom('outlook_unmatched_emails')
        .select(
          'id, microsoft_message_id, direction, from_address, to_addresses, subject, body_preview, sent_at, participant_emails, match_attempt_count, created_at',
        )
        .is('matched_at', null)
        .order('sent_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as UnmatchedOutlook[];
    },
    staleTime: 30_000,
  });

  const linkMutation = useMutation({
    mutationFn: async ({ rowId, dealId }: { rowId: string; dealId: string }) => {
      const { error: updErr } = await untypedFrom('outlook_unmatched_emails')
        .update({ matched_at: new Date().toISOString() })
        .eq('id', rowId);
      if (updErr) throw updErr;

      const row = rows.find((r) => r.id === rowId);
      if (row) {
        try {
          await (supabase as any).rpc('log_deal_activity', {
            p_deal_id: dealId,
            p_activity_type: row.direction === 'outbound' ? 'email_sent' : 'email_received',
            p_title: `Manually linked email: ${row.subject || `(no subject) — ${row.from_address}`}`,
            p_description: row.body_preview || null,
            p_admin_id: null,
            p_metadata: {
              outlook_unmatched_id: rowId,
              microsoft_message_id: row.microsoft_message_id,
              from_address: row.from_address,
              to_addresses: row.to_addresses,
              direction: row.direction,
              linked_manually: true,
            },
          });
        } catch (e) {
          console.error('Failed to log deal activity:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-activities'] });
      toast.success('Email linked to deal');
    },
    onError: (err) => toast.error(`Failed to link: ${(err as Error).message}`),
  });

  return (
    <UnmatchedTabBody
      isLoading={isLoading}
      empty={rows.length === 0}
      emptyText="All Outlook emails matched"
    >
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="hover:bg-muted/30 transition-colors">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <RowIcon icon={<Mail className="h-5 w-5 text-orange-600" />} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {r.subject || '(no subject)'}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {r.direction}
                    </Badge>
                  </div>
                  <RowMeta>
                    <span>from {r.from_address}</span>
                    {r.to_addresses.length > 0 && <span>to {r.to_addresses.join(', ')}</span>}
                    <span>retries: {r.match_attempt_count}</span>
                  </RowMeta>
                  {r.body_preview && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic mt-1">
                      {r.body_preview}
                    </p>
                  )}
                  <RowTimestamp at={r.sent_at} />
                </div>
                <DealLinkPicker
                  deals={deals}
                  selected={selected[r.id] || ''}
                  onChange={(val) => setSelected((p) => ({ ...p, [r.id]: val }))}
                  onLink={() => {
                    const [dId] = (selected[r.id] || '').split('::');
                    if (dId) linkMutation.mutate({ rowId: r.id, dealId: dId });
                  }}
                  pending={linkMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </UnmatchedTabBody>
  );
}

// ── Smartlead unmatched ───────────────────────────────────────────────────

interface UnmatchedSmartlead {
  id: string;
  smartlead_message_id: string | null;
  smartlead_lead_id: number | null;
  smartlead_campaign_id: number | null;
  lead_email: string | null;
  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_company_name: string | null;
  direction: string | null;
  subject: string | null;
  body_text: string | null;
  sent_at: string | null;
  event_type: string | null;
  match_attempt_count: number;
  created_at: string;
}

function UnmatchedSmartleadTab({ deals }: { deals: DealOption[] }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['unmatched-activities', 'smartlead'],
    queryFn: async () => {
      const { data, error } = await untypedFrom('smartlead_unmatched_messages')
        .select(
          'id, smartlead_message_id, smartlead_lead_id, smartlead_campaign_id, lead_email, lead_first_name, lead_last_name, lead_company_name, direction, subject, body_text, sent_at, event_type, match_attempt_count, created_at',
        )
        .is('matched_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as UnmatchedSmartlead[];
    },
    staleTime: 30_000,
  });

  const linkMutation = useMutation({
    mutationFn: async ({ rowId, dealId }: { rowId: string; dealId: string }) => {
      const { error: updErr } = await untypedFrom('smartlead_unmatched_messages')
        .update({ matched_at: new Date().toISOString() })
        .eq('id', rowId);
      if (updErr) throw updErr;
      const row = rows.find((r) => r.id === rowId);
      if (row) {
        const leadName = [row.lead_first_name, row.lead_last_name].filter(Boolean).join(' ');
        try {
          await (supabase as any).rpc('log_deal_activity', {
            p_deal_id: dealId,
            p_activity_type: row.direction === 'outbound' ? 'email_sent' : 'buyer_response',
            p_title: `Manually linked Smartlead: ${row.subject || leadName || row.lead_email || 'reply'}`,
            p_description: row.body_text?.slice(0, 500) || null,
            p_admin_id: null,
            p_metadata: {
              smartlead_unmatched_id: rowId,
              smartlead_message_id: row.smartlead_message_id,
              smartlead_lead_id: row.smartlead_lead_id,
              smartlead_campaign_id: row.smartlead_campaign_id,
              lead_email: row.lead_email,
              lead_company: row.lead_company_name,
              event_type: row.event_type,
              direction: row.direction,
              linked_manually: true,
            },
          });
        } catch (e) {
          console.error('Failed to log deal activity:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-activities'] });
      toast.success('Smartlead message linked');
    },
    onError: (err) => toast.error(`Failed to link: ${(err as Error).message}`),
  });

  return (
    <UnmatchedTabBody
      isLoading={isLoading}
      empty={rows.length === 0}
      emptyText="All Smartlead messages matched"
    >
      <div className="space-y-3">
        {rows.map((r) => {
          const leadName = [r.lead_first_name, r.lead_last_name].filter(Boolean).join(' ');
          return (
            <Card key={r.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <RowIcon icon={<SmartleadIcon className="h-5 w-5 text-orange-600" />} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {r.subject || leadName || r.lead_email || '(no subject)'}
                      </span>
                      {r.event_type && (
                        <Badge variant="secondary" className="text-[10px]">
                          {r.event_type}
                        </Badge>
                      )}
                      {r.direction && (
                        <Badge variant="outline" className="text-[10px]">
                          {r.direction}
                        </Badge>
                      )}
                    </div>
                    <RowMeta>
                      {r.lead_email && <span>{r.lead_email}</span>}
                      {r.lead_company_name && <span>{r.lead_company_name}</span>}
                      {r.smartlead_campaign_id && <span>campaign #{r.smartlead_campaign_id}</span>}
                      <span>retries: {r.match_attempt_count}</span>
                    </RowMeta>
                    {r.body_text && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic mt-1">
                        {r.body_text.slice(0, 300)}
                      </p>
                    )}
                    <RowTimestamp at={r.sent_at || r.created_at} />
                  </div>
                  <DealLinkPicker
                    deals={deals}
                    selected={selected[r.id] || ''}
                    onChange={(val) => setSelected((p) => ({ ...p, [r.id]: val }))}
                    onLink={() => {
                      const [dId] = (selected[r.id] || '').split('::');
                      if (dId) linkMutation.mutate({ rowId: r.id, dealId: dId });
                    }}
                    pending={linkMutation.isPending}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </UnmatchedTabBody>
  );
}

// ── HeyReach unmatched ────────────────────────────────────────────────────

interface UnmatchedHeyReach {
  id: string;
  heyreach_message_id: string | null;
  heyreach_lead_id: string | null;
  heyreach_campaign_id: number | null;
  lead_linkedin_url: string | null;
  lead_email: string | null;
  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_company_name: string | null;
  direction: string | null;
  message_type: string | null;
  subject: string | null;
  body_text: string | null;
  sent_at: string | null;
  event_type: string | null;
  match_attempt_count: number;
  created_at: string;
}

function UnmatchedHeyReachTab({ deals }: { deals: DealOption[] }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['unmatched-activities', 'heyreach'],
    queryFn: async () => {
      const { data, error } = await untypedFrom('heyreach_unmatched_messages')
        .select(
          'id, heyreach_message_id, heyreach_lead_id, heyreach_campaign_id, lead_linkedin_url, lead_email, lead_first_name, lead_last_name, lead_company_name, direction, message_type, subject, body_text, sent_at, event_type, match_attempt_count, created_at',
        )
        .is('matched_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as UnmatchedHeyReach[];
    },
    staleTime: 30_000,
  });

  const linkMutation = useMutation({
    mutationFn: async ({ rowId, dealId }: { rowId: string; dealId: string }) => {
      const { error: updErr } = await untypedFrom('heyreach_unmatched_messages')
        .update({ matched_at: new Date().toISOString() })
        .eq('id', rowId);
      if (updErr) throw updErr;
      const row = rows.find((r) => r.id === rowId);
      if (row) {
        const leadName = [row.lead_first_name, row.lead_last_name].filter(Boolean).join(' ');
        try {
          await (supabase as any).rpc('log_deal_activity', {
            p_deal_id: dealId,
            p_activity_type: 'linkedin_message',
            p_title: `Manually linked LinkedIn: ${leadName || row.lead_linkedin_url || row.lead_email || 'message'}`,
            p_description: row.body_text?.slice(0, 500) || null,
            p_admin_id: null,
            p_metadata: {
              heyreach_unmatched_id: rowId,
              heyreach_message_id: row.heyreach_message_id,
              heyreach_lead_id: row.heyreach_lead_id,
              heyreach_campaign_id: row.heyreach_campaign_id,
              lead_linkedin_url: row.lead_linkedin_url,
              lead_email: row.lead_email,
              lead_company: row.lead_company_name,
              event_type: row.event_type,
              message_type: row.message_type,
              direction: row.direction,
              linked_manually: true,
            },
          });
        } catch (e) {
          console.error('Failed to log deal activity:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-activities'] });
      toast.success('LinkedIn message linked');
    },
    onError: (err) => toast.error(`Failed to link: ${(err as Error).message}`),
  });

  return (
    <UnmatchedTabBody
      isLoading={isLoading}
      empty={rows.length === 0}
      emptyText="All HeyReach messages matched"
    >
      <div className="space-y-3">
        {rows.map((r) => {
          const leadName = [r.lead_first_name, r.lead_last_name].filter(Boolean).join(' ');
          return (
            <Card key={r.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <RowIcon icon={<Linkedin className="h-5 w-5 text-orange-600" />} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {leadName || r.lead_linkedin_url || r.lead_email || '(unknown lead)'}
                      </span>
                      {r.event_type && (
                        <Badge variant="secondary" className="text-[10px]">
                          {r.event_type}
                        </Badge>
                      )}
                      {r.direction && (
                        <Badge variant="outline" className="text-[10px]">
                          {r.direction}
                        </Badge>
                      )}
                    </div>
                    <RowMeta>
                      {r.lead_linkedin_url && (
                        <span className="truncate">{r.lead_linkedin_url}</span>
                      )}
                      {r.lead_email && <span>{r.lead_email}</span>}
                      {r.lead_company_name && <span>{r.lead_company_name}</span>}
                      <span>retries: {r.match_attempt_count}</span>
                    </RowMeta>
                    {r.body_text && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic mt-1">
                        {r.body_text.slice(0, 300)}
                      </p>
                    )}
                    <RowTimestamp at={r.sent_at || r.created_at} />
                  </div>
                  <DealLinkPicker
                    deals={deals}
                    selected={selected[r.id] || ''}
                    onChange={(val) => setSelected((p) => ({ ...p, [r.id]: val }))}
                    onLink={() => {
                      const [dId] = (selected[r.id] || '').split('::');
                      if (dId) linkMutation.mutate({ rowId: r.id, dealId: dId });
                    }}
                    pending={linkMutation.isPending}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </UnmatchedTabBody>
  );
}

// ── Shared row primitives ─────────────────────────────────────────────────

function UnmatchedTabBody({
  isLoading,
  empty,
  emptyText,
  children,
}: {
  isLoading: boolean;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (empty) {
    return (
      <Card className="mt-4">
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
          <p className="text-lg font-medium">{emptyText}</p>
          <p className="text-sm text-muted-foreground">No orphaned activities to recover.</p>
        </CardContent>
      </Card>
    );
  }
  return <ScrollArea className="h-[calc(100vh-260px)] mt-4">{children}</ScrollArea>;
}

function RowIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-orange-50 shrink-0">
      {icon}
    </div>
  );
}

function RowMeta({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
      {children}
    </div>
  );
}

function RowTimestamp({ at }: { at: string }) {
  return (
    <div className="text-xs text-muted-foreground mt-0.5">
      {format(new Date(at), 'MMM d, yyyy h:mm a')} (
      {formatDistanceToNow(new Date(at), { addSuffix: true })})
    </div>
  );
}
