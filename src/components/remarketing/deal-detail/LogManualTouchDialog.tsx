// ============================================================================
// LogManualTouchDialog
// ============================================================================
// Replaces the call-only LogManualCallDialog. Logs a manually-entered touch
// of any kind (call, email, LinkedIn, meeting) from the deal page.
//
// Each touch type writes to its canonical home table where possible:
//   - Call    → contact_activities         (preserved from LogManualCallDialog)
//   - Email   → email_messages             (manual_entry = true)
//   - LinkedIn→ heyreach_messages          (manual_entry = true)
//   - Meeting → deal_transcripts           (source = 'manual')
//
// Email and LinkedIn rows require a contact_id NOT NULL on their canonical
// tables. We resolve the contact via email-match (Email) or by picking the
// listing's primary contact as a fallback (LinkedIn). If resolution fails,
// the touch is still recorded as a deal_activities row so the entry shows
// up in the deal's Activity feed — no silent loss.
// ============================================================================

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, untypedFrom } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Mail, Linkedin, Video, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { resolveContact } from '@/lib/activity-contact-resolution';
import {
  decideTaskLifecycle,
  type CallOutcome,
  type OpenFollowUpTask,
} from '@/lib/auto-task-lifecycle';

type TouchType = 'call' | 'email' | 'linkedin' | 'meeting';

interface LogManualTouchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId?: string | null;
  listingId?: string | null;
  defaultContactName?: string;
  defaultContactEmail?: string;
  defaultContactPhone?: string;
}

const CALL_OUTCOMES = [
  { value: 'connected', label: 'Connected' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'callback', label: 'Callback Scheduled' },
  { value: 'busy', label: 'Busy' },
  { value: 'wrong_number', label: 'Wrong Number' },
];

const MEETING_SOURCES = ['fireflies', 'zoom', 'in_person', 'other'];

const TOUCH_TYPE_OPTIONS: { value: TouchType; label: string; icon: React.ReactNode }[] = [
  { value: 'call', label: 'Call', icon: <Phone className="h-4 w-4" /> },
  { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
  { value: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> },
  { value: 'meeting', label: 'Meeting', icon: <Video className="h-4 w-4" /> },
];

export function LogManualTouchDialog({
  open,
  onOpenChange,
  dealId,
  listingId,
  defaultContactName = '',
  defaultContactEmail = '',
  defaultContactPhone = '',
}: LogManualTouchDialogProps) {
  const queryClient = useQueryClient();

  const [touchType, setTouchType] = useState<TouchType>('call');

  // Shared
  const [contactName, setContactName] = useState(defaultContactName);
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [contactPhone, setContactPhone] = useState(defaultContactPhone);
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [notes, setNotes] = useState('');

  // Call-specific
  const [outcome, setOutcome] = useState('connected');
  const [durationMinutes, setDurationMinutes] = useState('');

  // Email + Meeting
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // LinkedIn
  const [linkedinUrl, setLinkedinUrl] = useState('');

  // Meeting
  const [attendees, setAttendees] = useState('');
  const [summary, setSummary] = useState('');
  const [meetingSource, setMeetingSource] = useState('other');

  // Audit item #15: live attribution preview. As the user types
  // contactEmail / linkedinUrl / contactName, debounce-resolve the contact
  // and surface a green/amber pill above the submit button so they know
  // whether the touch will land in canonical tables or fall back to
  // deal_activities only.
  const [debouncedEmail, setDebouncedEmail] = useState('');
  const [debouncedLinkedinUrl, setDebouncedLinkedinUrl] = useState('');
  const [debouncedContactName, setDebouncedContactName] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedEmail(contactEmail.trim());
      setDebouncedLinkedinUrl(linkedinUrl.trim());
      setDebouncedContactName(contactName.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [contactEmail, linkedinUrl, contactName]);

  const previewEnabled =
    (touchType === 'email' && debouncedEmail.length > 0) ||
    (touchType === 'linkedin' &&
      (debouncedEmail.length > 0 ||
        debouncedLinkedinUrl.length > 0 ||
        debouncedContactName.length > 0)) ||
    (touchType === 'call' && debouncedEmail.length > 0);

  const { data: attributionPreview, isFetching: previewFetching } = useQuery({
    queryKey: [
      'log-manual-touch-attribution',
      touchType,
      debouncedEmail,
      debouncedLinkedinUrl,
      debouncedContactName,
      listingId,
    ],
    queryFn: async () =>
      resolveContact({
        email: debouncedEmail || null,
        linkedinUrl: touchType === 'linkedin' ? debouncedLinkedinUrl || null : null,
        contactName: debouncedContactName || null,
        listingId: listingId ?? null,
      }),
    enabled: open && previewEnabled,
    staleTime: 30_000,
  });

  function resetForm() {
    setContactName(defaultContactName);
    setContactEmail(defaultContactEmail);
    setContactPhone(defaultContactPhone);
    setDirection('outbound');
    setOutcome('connected');
    setDurationMinutes('');
    setNotes('');
    setSubject('');
    setBody('');
    setLinkedinUrl('');
    setAttendees('');
    setSummary('');
    setMeetingSource('other');
  }

  async function logDealActivity(
    activityType: string,
    title: string,
    description: string | null,
    metadata: Record<string, unknown>,
  ) {
    if (!dealId) return;
    try {
      await (supabase as any).rpc('log_deal_activity', {
        p_deal_id: dealId,
        p_activity_type: activityType,
        p_title: title,
        p_description: description,
        p_admin_id: null,
        p_metadata: metadata,
      });
    } catch (e) {
      console.error('log_deal_activity failed:', e);
    }
  }

  async function logCall() {
    const durationSeconds = durationMinutes ? parseInt(durationMinutes, 10) * 60 : 0;
    const connected = outcome === 'connected' || outcome === 'callback';
    const now = new Date().toISOString();

    const { data: activity, error: actErr } = await (supabase as any)
      .from('contact_activities')
      .insert({
        activity_type: 'call_completed',
        source_system: 'manual',
        call_started_at: now,
        call_ended_at: now,
        call_duration_seconds: durationSeconds,
        call_outcome: outcome,
        call_connected: connected,
        call_direction: direction,
        disposition_label: CALL_OUTCOMES.find((o) => o.value === outcome)?.label || outcome,
        disposition_notes: notes || null,
        contact_email: contactEmail || null,
        user_name: null,
        listing_id: listingId || null,
        matching_status: listingId ? 'matched' : 'unmatched',
      })
      .select('id')
      .single();
    if (actErr) throw actErr;

    await logDealActivity(
      'call_completed',
      `Manual call: ${contactName || contactEmail || 'contact'} (${
        CALL_OUTCOMES.find((o) => o.value === outcome)?.label || outcome
      })`,
      [
        durationSeconds > 0 ? `Duration: ${durationMinutes}m` : null,
        notes ? `Notes: ${notes.substring(0, 200)}` : null,
      ]
        .filter(Boolean)
        .join(' | ') || null,
      {
        contact_activity_id: activity?.id,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        direction,
        outcome,
        connected,
        duration_seconds: durationSeconds,
        notes: notes || null,
        source: 'manual',
      },
    );

    if (dealId) {
      try {
        await runAutoTaskLifecycle({
          outcome: outcome as CallOutcome,
          dealId,
          listingId,
          contactName,
          contactEmail,
        });
      } catch (e) {
        console.error('Auto-task lifecycle failed:', e);
      }
    }
  }

  /**
   * Implements Fix #4 — auto-task dedup/supersede on the same (deal_id,
   * contact-key) scope. Defers the decision to the pure
   * decideTaskLifecycle helper, then runs the resulting writes.
   */
  async function runAutoTaskLifecycle(args: {
    outcome: CallOutcome;
    dealId: string;
    listingId?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
  }) {
    const {
      outcome: callOutcome,
      dealId: dId,
      listingId: lId,
      contactName: cName,
      contactEmail: cEmail,
    } = args;

    // Find the matching contact_id so we can scope the open-tasks lookup.
    const resolved = await resolveContact({
      email: cEmail,
      contactName: cName,
      listingId: lId,
    });

    // Pull open follow-up-with-buyer tasks for this deal scoped to the same
    // contact (or all of this deal's open follow-ups if contact didn't resolve).
    let openTasksQuery = (supabase as any)
      .from('daily_standup_tasks')
      .select('id, task_type, status, due_date, metadata, secondary_entity_id')
      .eq('deal_id', dId)
      .eq('task_type', 'follow_up_with_buyer')
      .in('status', ['pending', 'pending_approval', 'in_progress', 'overdue', 'snoozed']);
    if (resolved?.contactId) {
      // Tasks created with a contact reference will have secondary_entity_id =
      // contact_id. If pre-fix tasks weren't tagged this way, we widen below.
      openTasksQuery = openTasksQuery.eq('secondary_entity_id', resolved.contactId);
    }
    const { data: openTasksData } = await openTasksQuery;
    const openTasks = (openTasksData ?? []) as OpenFollowUpTask[];

    const decision = decideTaskLifecycle(callOutcome, openTasks);

    if (decision.action === 'none') return;

    if (decision.action === 'create' || decision.action === 'supersede_and_create') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + decision.due_offset_days);
      const callOutcomeLabel =
        CALL_OUTCOMES.find((o) => o.value === callOutcome)?.label || callOutcome;
      const title =
        decision.task_type === 'schedule_call'
          ? `Callback: ${cName || cEmail || 'contact'}`
          : `Follow up (${callOutcome.replace('_', ' ')}): ${cName || cEmail || 'contact'}`;
      const description = `Auto-created from manual call log. Contact: ${cName || 'Unknown'}${cEmail ? ` (${cEmail})` : ''}. Outcome: ${callOutcomeLabel}.`;

      const { data: insertedTask, error: insErr } = await (supabase as any)
        .from('daily_standup_tasks')
        .insert({
          title,
          task_type: decision.task_type,
          status: 'pending',
          priority: decision.priority,
          priority_score: decision.priority === 'high' ? 80 : 50,
          due_date: dueDate.toISOString().split('T')[0],
          entity_type: 'deal',
          entity_id: dId,
          deal_id: dId,
          secondary_entity_id: resolved?.contactId ?? null,
          secondary_entity_type: resolved?.contactId ? 'contact' : null,
          auto_generated: true,
          generation_source: 'manual_call',
          source: 'system',
          description,
          metadata: { generated_from: 'manual_call', voicemail_count: 0 },
        })
        .select('id')
        .single();
      if (insErr) {
        console.error('Auto-task insert failed:', insErr);
        return;
      }

      if (decision.action === 'supersede_and_create' && insertedTask?.id) {
        await supersedeTasks(
          decision.supersede_task_ids,
          insertedTask.id,
          decision.supersede_reason,
        );
      }
    } else if (decision.action === 'update_existing') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + decision.new_due_offset_days);
      const { error: updErr } = await (supabase as any)
        .from('daily_standup_tasks')
        .update({
          due_date: dueDate.toISOString().split('T')[0],
          metadata: { voicemail_count: decision.new_voicemail_count },
        })
        .eq('id', decision.task_id);
      if (updErr) console.error('Auto-task update (dedup) failed:', updErr);
    } else if (decision.action === 'supersede_only') {
      await supersedeTasks(decision.supersede_task_ids, null, decision.supersede_reason);
    }
  }

  async function supersedeTasks(
    taskIds: string[],
    supersededByTaskId: string | null,
    reason: string,
  ) {
    if (taskIds.length === 0) return;
    const metadata = supersededByTaskId
      ? { superseded_by_task_id: supersededByTaskId, superseded_reason: reason }
      : { superseded_reason: reason };
    const { error } = await (supabase as any)
      .from('daily_standup_tasks')
      .update({ status: 'superseded', metadata })
      .in('id', taskIds);
    if (error) console.error('Failed to supersede tasks:', error);
  }

  async function logEmail() {
    if (!contactEmail) {
      throw new Error('Contact email is required for an email touch');
    }
    const now = new Date().toISOString();

    // Resolution: email match first (listing-scoped → global), then fuzzy
    // primary-contact fallback if the user typed in a name.
    const resolved = await resolveContact({
      email: contactEmail,
      contactName,
      listingId,
    });
    const contactId = resolved?.contactId ?? null;
    const lowConfidence = resolved?.source === 'fuzzy_primary';

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let inserted = false;
    if (contactId && user?.id) {
      const { error: emErr } = await untypedFrom('email_messages').insert({
        contact_id: contactId,
        sourceco_user_id: user.id,
        direction,
        from_address: direction === 'outbound' ? user.email : contactEmail,
        to_addresses: direction === 'outbound' ? [contactEmail] : [user.email],
        subject: subject || null,
        body_text: body || null,
        sent_at: now,
        manual_entry: true,
      });
      if (!emErr) inserted = true;
      else console.error('email_messages manual insert failed:', emErr);
    }

    if (!contactId) {
      toast.warning('Email logged without contact attribution — no matching contact found');
    } else if (lowConfidence) {
      toast.info('Email attributed via name match (low confidence)');
    }

    await logDealActivity(
      direction === 'outbound' ? 'email_sent' : 'email_received',
      `Manual email: ${subject || `(no subject) — ${contactEmail}`}`,
      body || null,
      {
        manual_entry: true,
        canonical_inserted: inserted,
        contact_resolved: !!contactId,
        contact_resolution_source: resolved?.source ?? null,
        contact_email: contactEmail,
        contact_name: contactName,
        direction,
        subject,
      },
    );
  }

  async function logLinkedIn() {
    const now = new Date().toISOString();
    const eventType = direction === 'outbound' ? 'message_sent' : 'message_received';

    // Resolution: email → linkedin URL → fuzzy primary, in that order.
    // The pre-fix path always returned the listing's primary contact regardless
    // of who the message was actually with. This now matches the user's intent.
    const resolved = await resolveContact({
      email: contactEmail,
      linkedinUrl,
      contactName,
      listingId,
    });
    const contactId = resolved?.contactId ?? null;
    const lowConfidence = resolved?.source === 'fuzzy_primary';

    let inserted = false;
    if (contactId) {
      const contactType = resolved?.contactType === 'seller' ? 'seller' : 'buyer';
      const { error: hmErr } = await untypedFrom('heyreach_messages').insert({
        contact_id: contactId,
        contact_type: contactType,
        listing_id: contactType === 'seller' ? listingId : null,
        direction,
        from_linkedin_url: direction === 'outbound' ? null : linkedinUrl || null,
        to_linkedin_url: direction === 'outbound' ? linkedinUrl || null : null,
        message_type: 'message',
        subject: null,
        body_text: body || null,
        sent_at: now,
        event_type: eventType,
        manual_entry: true,
      });
      if (!hmErr) inserted = true;
      else console.error('heyreach_messages manual insert failed:', hmErr);
    }

    if (!contactId) {
      toast.warning(
        'LinkedIn message logged without contact attribution — no matching contact found',
      );
    } else if (lowConfidence) {
      toast.info('LinkedIn message attributed via name match (low confidence)');
    }

    await logDealActivity(
      'linkedin_message',
      `Manual LinkedIn: ${contactName || linkedinUrl || 'contact'}`,
      body || null,
      {
        manual_entry: true,
        canonical_inserted: inserted,
        contact_resolved: !!contactId,
        contact_resolution_source: resolved?.source ?? null,
        linkedin_url: linkedinUrl,
        contact_name: contactName,
        direction,
        event_type: eventType,
      },
    );
  }

  async function logMeeting() {
    if (!listingId) {
      throw new Error('Listing context is required for a meeting touch');
    }
    const text = summary || notes || 'Meeting logged';
    const attendeeArr = attendees
      ? attendees
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const { data: dt, error: dtErr } = await untypedFrom('deal_transcripts')
      .insert({
        listing_id: listingId,
        transcript_text: text,
        source: meetingSource === 'other' ? 'manual' : meetingSource,
        title: subject || `Manual meeting (${meetingSource})`,
        duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
        meeting_attendees: attendeeArr.length > 0 ? attendeeArr : null,
        has_content: !!text,
        extraction_status: 'completed',
        match_type: 'manual',
      })
      .select('id')
      .single();
    if (dtErr) throw dtErr;

    await logDealActivity(
      'meeting_linked',
      `Manual meeting: ${subject || meetingSource}`,
      text.slice(0, 500),
      {
        manual_entry: true,
        deal_transcript_id: dt?.id,
        meeting_source: meetingSource,
        duration_minutes: durationMinutes,
        attendees: attendeeArr,
      },
    );
  }

  const logMutation = useMutation({
    mutationFn: async () => {
      switch (touchType) {
        case 'call':
          await logCall();
          return;
        case 'email':
          await logEmail();
          return;
        case 'linkedin':
          await logLinkedIn();
          return;
        case 'meeting':
          await logMeeting();
          return;
        default:
          return;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      queryClient.invalidateQueries({ queryKey: ['unified-timeline-calls'] });
      queryClient.invalidateQueries({ queryKey: ['unified-timeline-outlook-emails'] });
      queryClient.invalidateQueries({ queryKey: ['unified-timeline-heyreach'] });
      queryClient.invalidateQueries({ queryKey: ['unified-timeline-transcripts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-combined-history'] });
      toast.success('Touch logged');
      onOpenChange(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(`Failed to log touch: ${(err as Error).message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Touch</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Touch type</Label>
            <Select value={touchType} onValueChange={(v) => setTouchType(v as TouchType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOUCH_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="inline-flex items-center gap-2">
                      {o.icon}
                      {o.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {touchType !== 'meeting' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact name</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              {touchType === 'call' && (
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              )}
              {touchType === 'email' && (
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              )}
              {touchType === 'linkedin' && (
                <div className="space-y-2">
                  <Label>LinkedIn URL</Label>
                  <Input
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              )}
            </div>
          )}

          {touchType === 'call' && (
            <div className="space-y-2">
              <Label>Email (for matching)</Label>
              <Input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
          )}

          {touchType !== 'meeting' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={direction}
                  onValueChange={(v) => setDirection(v as 'outbound' | 'inbound')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {touchType === 'call' && (
                <>
                  <div className="space-y-2">
                    <Label>Outcome</Label>
                    <Select value={outcome} onValueChange={setOutcome}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALL_OUTCOMES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      placeholder="5"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {touchType === 'email' && (
            <>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
              <div className="space-y-2">
                <Label>Body preview</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email body preview"
                  rows={3}
                />
              </div>
            </>
          )}

          {touchType === 'linkedin' && (
            <div className="space-y-2">
              <Label>Message body</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="LinkedIn message body"
                rows={3}
              />
            </div>
          )}

          {touchType === 'meeting' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Quarterly review"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={meetingSource} onValueChange={setMeetingSource}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEETING_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Attendees (comma-sep)</Label>
                  <Input
                    value={attendees}
                    onChange={(e) => setAttendees(e.target.value)}
                    placeholder="alex@x.com, sam@y.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="30"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Key points / action items"
                  rows={4}
                />
              </div>
            </>
          )}

          {touchType !== 'meeting' && (
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Audit item #15 — attribution preview */}
        {previewEnabled && touchType !== 'meeting' && (
          <div className="px-1 pb-2">
            {previewFetching ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Looking up contact…
              </div>
            ) : attributionPreview ? (
              <div className="flex items-center gap-2 text-xs rounded-md border border-green-200 bg-green-50 text-green-800 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Will attribute to <strong>this contact</strong>
                  {attributionPreview.contactType ? ` (${attributionPreview.contactType})` : ''}
                  {attributionPreview.source === 'fuzzy_primary'
                    ? ' — matched by name (low confidence)'
                    : attributionPreview.source === 'linkedin'
                      ? ' — matched by LinkedIn URL'
                      : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  No matching contact found — touch will log to the deal feed only, not the
                  canonical contact history.
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => logMutation.mutate()} disabled={logMutation.isPending}>
            {logMutation.isPending ? 'Logging…' : 'Log Touch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
