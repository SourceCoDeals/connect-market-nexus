/**
 * useActivityStats — Shared activity stats computation.
 *
 * Extracted from ContactHistoryTracker/useContactHistory to eliminate
 * duplicate stat computation across ContactActivityTimeline and
 * ContactHistoryTracker.
 */
import { useMemo } from 'react';
import type { UnifiedActivityEntry } from './use-contact-combined-history';

export interface ActivityStats {
  totalEmails: number;
  totalCalls: number;
  totalLinkedIn: number;
  totalMeetings: number;
  emailsOpened: number;
  emailsReplied: number;
  callsConnected: number;
  linkedInReplied: number;
  linkedInConnected: number;
  daysSinceLastContact: number | null;
  lastContactDate: string | null;
  lastContactChannel: string | null;
  engagementStatus: 'active' | 'warm' | 'cold' | 'none';
  nextBestAction: {
    action: string;
    icon: 'mail' | 'phone' | 'linkedin';
    reason: string;
    timing: string;
  };
  emailEntries: UnifiedActivityEntry[];
  callEntries: UnifiedActivityEntry[];
  linkedInEntries: UnifiedActivityEntry[];
  meetingEntries: UnifiedActivityEntry[];
}

/** Pure function — can be used outside React */
export function computeActivityStats(entries: UnifiedActivityEntry[]): ActivityStats {
  let totalEmails = 0;
  let totalCalls = 0;
  let totalLinkedIn = 0;
  let totalMeetings = 0;
  let emailsOpened = 0;
  let emailsReplied = 0;
  let callsConnected = 0;
  let linkedInReplied = 0;
  let linkedInConnected = 0;

  const emailEntries: UnifiedActivityEntry[] = [];
  const callEntries: UnifiedActivityEntry[] = [];
  const linkedInEntries: UnifiedActivityEntry[] = [];
  const meetingEntries: UnifiedActivityEntry[] = [];

  for (const e of entries) {
    const et = e.event_type?.toUpperCase() || '';
    if (e.channel === 'email') {
      totalEmails++;
      emailEntries.push(e);
      if (['EMAIL_OPENED', 'OPENED'].includes(et)) emailsOpened++;
      if (['EMAIL_REPLIED', 'REPLIED'].includes(et)) emailsReplied++;
    } else if (e.channel === 'linkedin') {
      totalLinkedIn++;
      linkedInEntries.push(e);
      if (['MESSAGE_RECEIVED', 'INMAIL_RECEIVED', 'LEAD_REPLIED'].includes(et)) linkedInReplied++;
      if (['CONNECTION_REQUEST_ACCEPTED'].includes(et)) linkedInConnected++;
    } else if (e.channel === 'meeting') {
      totalMeetings++;
      meetingEntries.push(e);
    } else {
      totalCalls++;
      callEntries.push(e);
      if (et === 'CALL_COMPLETED' || e.details?.call_connected) callsConnected++;
    }
  }

  const lastEntry = entries.length > 0 ? entries[0] : null;
  const daysSinceLastContact = lastEntry
    ? Math.floor((Date.now() - new Date(lastEntry.timestamp).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Determine next best action
  let nextBestAction: ActivityStats['nextBestAction'] = {
    action: 'Send Email',
    icon: 'mail',
    reason: 'No contact history found. Start with an introductory email.',
    timing: 'as soon as possible',
  };

  if (lastEntry) {
    if (emailsOpened > 0 && emailsReplied === 0 && callsConnected === 0) {
      nextBestAction = {
        action: 'Schedule Call',
        icon: 'phone',
        reason: `Email opened ${emailsOpened}x with no reply. Engagement is high\u2014time to connect directly.`,
        timing: 'within 2 days',
      };
    } else if (totalEmails > 3 && emailsOpened === 0) {
      nextBestAction = {
        action: 'Try LinkedIn',
        icon: 'linkedin',
        reason: 'Multiple emails sent with no opens. Try a different channel to break through.',
        timing: 'within 3 days',
      };
    } else if (callsConnected > 0 && emailsReplied === 0) {
      nextBestAction = {
        action: 'Send Follow-up Email',
        icon: 'mail',
        reason: 'Had a call but no email reply yet. Send a follow-up to keep momentum.',
        timing: 'within 1 day',
      };
    } else if (linkedInReplied > 0) {
      nextBestAction = {
        action: 'Schedule Call',
        icon: 'phone',
        reason: 'Positive LinkedIn engagement. Convert to a phone conversation.',
        timing: 'within 2 days',
      };
    } else if (daysSinceLastContact !== null && daysSinceLastContact > 14) {
      nextBestAction = {
        action: 'Re-engage',
        icon: 'mail',
        reason: `No contact in ${daysSinceLastContact} days. Time to re-engage before they go cold.`,
        timing: 'today',
      };
    }
  }

  let engagementStatus: ActivityStats['engagementStatus'] = 'none';
  if (daysSinceLastContact !== null) {
    if (daysSinceLastContact <= 7) engagementStatus = 'active';
    else if (daysSinceLastContact <= 30) engagementStatus = 'warm';
    else engagementStatus = 'cold';
  }

  return {
    totalEmails,
    totalCalls,
    totalLinkedIn,
    totalMeetings,
    emailsOpened,
    emailsReplied,
    callsConnected,
    linkedInReplied,
    linkedInConnected,
    daysSinceLastContact,
    lastContactDate: lastEntry?.timestamp || null,
    lastContactChannel: lastEntry?.channel || null,
    nextBestAction,
    engagementStatus,
    emailEntries,
    callEntries,
    linkedInEntries,
    meetingEntries,
  };
}

/** React hook wrapper — memoizes on entries reference */
export function useActivityStats(entries: UnifiedActivityEntry[]): ActivityStats {
  return useMemo(() => computeActivityStats(entries), [entries]);
}
