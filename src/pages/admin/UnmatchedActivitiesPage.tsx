/**
 * Unmatched Activities admin page
 *
 * Three tabs, one per integration, each showing records that couldn't be
 * resolved to a contact at ingest time:
 *
 *   - PhoneBurner calls:  contact_activities WHERE contact_id IS NULL
 *   - Smartlead emails:   smartlead_unmatched_messages WHERE matched_at IS NULL
 *   - HeyReach LinkedIn:  heyreach_unmatched_messages WHERE matched_at IS NULL
 *
 * Per-tab primary action: "Rescan all" — invokes the rematch-unmatched-activities
 * edge function to scan every unresolved row in this channel against the
 * current `contacts` table. Useful after adding new contacts in bulk.
 *
 * Per-row manual action: "Dismiss" — marks the row so it no longer surfaces.
 * (For PhoneBurner, soft-dismiss uses disposition_notes since there's no
 * dedicated dismissed flag; for Smartlead/HeyReach, it sets matched_at to a
 * sentinel.)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, AlertTriangle, CheckCircle, Mail, Linkedin, RefreshCw, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

// Sentinel timestamp used to "dismiss" a SL/HR unmatched row without promoting
// it. Picked far in the past so it's distinguishable from a real match — any
// real match has matched_at > created_at.
const DISMISS_SENTINEL = '1970-01-01T00:00:00Z';

interface PbActivity {
  id: string;
  activity_type: string;
  contact_email: string | null;
  user_name: string | null;
  call_duration_seconds: number | null;
  disposition_label: string | null;
  created_at: string;
  listing_id: string | null;
}

interface SmartleadUnmatched {
  id: string;
  lead_email: string | null;
  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_company_name: string | null;
  subject: string | null;
  event_type: string | null;
  reason: string | null;
  sent_at: string | null;
  last_attempted_at: string | null;
  created_at: string;
}

interface HeyreachUnmatched {
  id: string;
  lead_email: string | null;
  lead_linkedin_url: string | null;
  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_company_name: string | null;
  subject: string | null;
  event_type: string | null;
  reason: string | null;
  sent_at: string | null;
  last_attempted_at: string | null;
  created_at: string;
}

type Channel = 'phoneburner' | 'smartlead' | 'heyreach';

type RematchSummary = {
  channel: string;
  scanned: number;
  matched: number;
  updated: number;
  errors: number;
};

export default function UnmatchedActivitiesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Channel>('phoneburner');

  const { data: pbActivities = [], isLoading: pbLoading } = useQuery({
    queryKey: ['unmatched-phoneburner'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_activities')
        .select(
          'id, activity_type, contact_email, user_name, call_duration_seconds, disposition_label, created_at, listing_id',
        )
        .eq('source_system', 'phoneburner')
        .is('contact_id', null)
        // Exclude rows we've soft-dismissed. See DISMISS marker below.
        .or('disposition_notes.is.null,disposition_notes.neq.[dismissed-unmatched]')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as PbActivity[];
    },
    staleTime: 30_000,
  });

  const { data: slUnmatched = [], isLoading: slLoading } = useQuery({
    queryKey: ['unmatched-smartlead'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('smartlead_unmatched_messages')
        .select(
          'id, lead_email, lead_first_name, lead_last_name, lead_company_name, subject, event_type, reason, sent_at, last_attempted_at, created_at',
        )
        .is('matched_at', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as SmartleadUnmatched[];
    },
    staleTime: 30_000,
  });

  const { data: hrUnmatched = [], isLoading: hrLoading } = useQuery({
    queryKey: ['unmatched-heyreach'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('heyreach_unmatched_messages')
        .select(
          'id, lead_email, lead_linkedin_url, lead_first_name, lead_last_name, lead_company_name, subject, event_type, reason, sent_at, last_attempted_at, created_at',
        )
        .is('matched_at', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as HeyreachUnmatched[];
    },
    staleTime: 30_000,
  });

  const rescanMutation = useMutation({
    mutationFn: async (channel: Channel | 'all') => {
      const { data, error } = await supabase.functions.invoke('rematch-unmatched-activities', {
        body: { channel, max_rows: 5000 },
      });
      if (error) throw error;
      return data as { per_channel: RematchSummary[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-phoneburner'] });
      queryClient.invalidateQueries({ queryKey: ['unmatched-smartlead'] });
      queryClient.invalidateQueries({ queryKey: ['unmatched-heyreach'] });
      const summaries = data.per_channel || [];
      const totalMatched = summaries.reduce((a, s) => a + (s.matched || 0), 0);
      const totalUpdated = summaries.reduce((a, s) => a + (s.updated || 0), 0);
      toast.success(`Rescan complete — matched ${totalMatched}, updated ${totalUpdated}`);
    },
    onError: (err) => toast.error(`Rescan failed: ${(err as Error).message}`),
  });

  const dismissPbMutation = useMutation({
    mutationFn: async (id: string) => {
      // PhoneBurner has no matched_at / dismissed flag. Use a marker prefix
      // on disposition_notes so we can filter it out next time without
      // changing the schema. (Alternative would be a new column; keeping it
      // soft-dismissed reduces migration surface area.)
      const { error } = await supabase
        .from('contact_activities')
        .update({ disposition_notes: '[dismissed-unmatched]' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-phoneburner'] });
      toast.success('Dismissed');
    },
    onError: (err) => toast.error(`Dismiss failed: ${(err as Error).message}`),
  });

  const dismissOutreachMutation = useMutation({
    mutationFn: async ({
      table,
      id,
    }: {
      table: 'smartlead_unmatched_messages' | 'heyreach_unmatched_messages';
      id: string;
    }) => {
      const { error } = await supabase
        .from(table)
        .update({ matched_at: DISMISS_SENTINEL })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      const key =
        vars.table === 'smartlead_unmatched_messages'
          ? 'unmatched-smartlead'
          : 'unmatched-heyreach';
      queryClient.invalidateQueries({ queryKey: [key] });
      toast.success('Dismissed');
    },
    onError: (err) => toast.error(`Dismiss failed: ${(err as Error).message}`),
  });

  const totalUnmatched = pbActivities.length + slUnmatched.length + hrUnmatched.length;
  const rescanPending = rescanMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Unmatched Activities
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Outreach events that couldn't be automatically linked to a contact at ingest time.
            Rescan runs the current matcher against the current contacts table — useful after adding
            or updating contacts. Dismissed rows stop surfacing here but stay in the DB.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg px-3 py-1">
            {totalUnmatched} shown
          </Badge>
          <Button onClick={() => rescanMutation.mutate('all')} disabled={rescanPending} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${rescanPending ? 'animate-spin' : ''}`} />
            {rescanPending ? 'Rescanning…' : 'Rescan all channels'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Channel)}>
        <TabsList>
          <TabsTrigger value="phoneburner" className="gap-2">
            <Phone className="h-4 w-4" />
            PhoneBurner ({pbActivities.length})
          </TabsTrigger>
          <TabsTrigger value="smartlead" className="gap-2">
            <Mail className="h-4 w-4" />
            Smartlead ({slUnmatched.length})
          </TabsTrigger>
          <TabsTrigger value="heyreach" className="gap-2">
            <Linkedin className="h-4 w-4" />
            HeyReach ({hrUnmatched.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="phoneburner" className="mt-4">
          {pbLoading ? (
            <ListSkeleton />
          ) : pbActivities.length === 0 ? (
            <EmptyState label="All PhoneBurner calls are matched." />
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-2">
                {pbActivities.map((a) => (
                  <Card key={a.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="py-3">
                      <div className="flex items-center gap-4">
                        <Phone className="h-5 w-5 text-orange-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {a.activity_type.replace(/_/g, ' ')}
                            </span>
                            {a.disposition_label && (
                              <Badge variant="secondary" className="text-[10px]">
                                {a.disposition_label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                            {a.contact_email && <span>{a.contact_email}</span>}
                            {a.user_name && <span>by {a.user_name}</span>}
                            {a.call_duration_seconds != null && (
                              <span>
                                {Math.floor(a.call_duration_seconds / 60)}m{' '}
                                {a.call_duration_seconds % 60}s
                              </span>
                            )}
                            <span>
                              {format(new Date(a.created_at), 'MMM d, yyyy')} (
                              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })})
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismissPbMutation.mutate(a.id)}
                          disabled={dismissPbMutation.isPending}
                          title="Dismiss"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="smartlead" className="mt-4">
          {slLoading ? (
            <ListSkeleton />
          ) : slUnmatched.length === 0 ? (
            <EmptyState label="All Smartlead events are matched." />
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-2">
                {slUnmatched.map((r) => (
                  <Card key={r.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="py-3">
                      <div className="flex items-center gap-4">
                        <Mail className="h-5 w-5 text-blue-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{r.event_type || 'event'}</span>
                            {r.reason && (
                              <Badge variant="secondary" className="text-[10px]">
                                {r.reason}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                            {r.lead_email && <span>{r.lead_email}</span>}
                            {(r.lead_first_name || r.lead_last_name) && (
                              <span>
                                {[r.lead_first_name, r.lead_last_name].filter(Boolean).join(' ')}
                              </span>
                            )}
                            {r.lead_company_name && <span>@ {r.lead_company_name}</span>}
                            {r.subject && <span className="truncate">{r.subject}</span>}
                            <span>
                              {r.sent_at
                                ? format(new Date(r.sent_at), 'MMM d, yyyy')
                                : format(new Date(r.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            dismissOutreachMutation.mutate({
                              table: 'smartlead_unmatched_messages',
                              id: r.id,
                            })
                          }
                          disabled={dismissOutreachMutation.isPending}
                          title="Dismiss"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="heyreach" className="mt-4">
          {hrLoading ? (
            <ListSkeleton />
          ) : hrUnmatched.length === 0 ? (
            <EmptyState label="All HeyReach events are matched." />
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-2">
                {hrUnmatched.map((r) => (
                  <Card key={r.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="py-3">
                      <div className="flex items-center gap-4">
                        <Linkedin className="h-5 w-5 text-[#0077B5] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{r.event_type || 'event'}</span>
                            {r.reason && (
                              <Badge variant="secondary" className="text-[10px]">
                                {r.reason}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                            {r.lead_linkedin_url && (
                              <a
                                href={
                                  r.lead_linkedin_url.startsWith('http')
                                    ? r.lead_linkedin_url
                                    : `https://${r.lead_linkedin_url}`
                                }
                                target="_blank"
                                rel="noreferrer noopener"
                                className="truncate underline hover:text-primary"
                              >
                                {r.lead_linkedin_url}
                              </a>
                            )}
                            {r.lead_email && <span>{r.lead_email}</span>}
                            {(r.lead_first_name || r.lead_last_name) && (
                              <span>
                                {[r.lead_first_name, r.lead_last_name].filter(Boolean).join(' ')}
                              </span>
                            )}
                            {r.lead_company_name && <span>@ {r.lead_company_name}</span>}
                            <span>
                              {r.sent_at
                                ? format(new Date(r.sent_at), 'MMM d, yyyy')
                                : format(new Date(r.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            dismissOutreachMutation.mutate({
                              table: 'heyreach_unmatched_messages',
                              id: r.id,
                            })
                          }
                          disabled={dismissOutreachMutation.isPending}
                          title="Dismiss"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
        <p className="text-lg font-medium">{label}</p>
      </CardContent>
    </Card>
  );
}
