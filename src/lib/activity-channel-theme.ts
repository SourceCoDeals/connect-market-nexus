// ============================================================================
// Activity channel theme
// ============================================================================
// Single source of truth for the colors and labels used to render activity
// channel badges across the deal page (UnifiedDealTimeline) AND the buyer
// profile (ContactActivityTimeline).
//
// Audit item #1: pre-fix the two surfaces used different palettes — emails
// were green on the deal page but blue on the buyer profile, meetings were
// teal on the deal page but purple on the buyer profile, etc. Same channel
// rendered as different colors depending on which page the user happened
// to be on.
//
// Picking the cleaner palette: blue calls, green emails, indigo LinkedIn,
// purple meetings, gray/muted notes.
//
// Both surfaces must import and use these constants. Do not inline channel
// colors anywhere else.
// ============================================================================

export type ActivityChannel = 'call' | 'email' | 'linkedin' | 'meeting' | 'note' | 'system';

export interface ChannelThemeEntry {
  /** Tailwind class fragment for badge background + text + border (used inline). */
  badgeClass: string;
  /** Lighter accent for inline detail rows (e.g. icon-only chips inside an entry). */
  accentClass: string;
  /** Solid foreground color for filter-chip-active states. */
  filterActiveClass: string;
  /** Hex value for elements that must use raw color (rare). */
  hex: string;
  /** Display name. */
  label: string;
}

export const CHANNEL_THEME: Record<ActivityChannel, ChannelThemeEntry> = {
  call: {
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    accentClass: 'text-blue-600',
    filterActiveClass: 'bg-blue-600 text-white',
    hex: '#2563eb', // blue-600
    label: 'Call',
  },
  email: {
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
    accentClass: 'text-green-700',
    filterActiveClass: 'bg-green-600 text-white',
    hex: '#16a34a', // green-600
    label: 'Email',
  },
  linkedin: {
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    accentClass: 'text-indigo-700',
    filterActiveClass: 'bg-indigo-600 text-white',
    hex: '#4f46e5', // indigo-600
    label: 'LinkedIn',
  },
  meeting: {
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    accentClass: 'text-purple-700',
    filterActiveClass: 'bg-purple-600 text-white',
    hex: '#9333ea', // purple-600
    label: 'Meeting',
  },
  note: {
    badgeClass: 'bg-gray-50 text-gray-700 border-gray-200',
    accentClass: 'text-gray-700',
    filterActiveClass: 'bg-gray-600 text-white',
    hex: '#4b5563', // gray-600
    label: 'Note',
  },
  system: {
    badgeClass: 'bg-muted text-muted-foreground border-border',
    accentClass: 'text-muted-foreground',
    filterActiveClass: 'bg-foreground text-background',
    hex: '#6b7280', // gray-500
    label: 'System',
  },
};

/**
 * Map a UnifiedTimelineEntry source/category combo to the channel theme key.
 * The deal-page hook uses both `source` ('call'|'email'|'linkedin'|'transcript'|'deal_activity')
 * and a derived `category` ('calls'|'emails'|'linkedin'|'meetings'|'system'|'tasks'|'all').
 * The buyer-profile timeline uses `channel` ('call'|'email'|'linkedin'|'meeting').
 */
export function channelThemeFor(opts: {
  source?: string;
  category?: string;
  channel?: string;
}): ChannelThemeEntry {
  const { source, category, channel } = opts;
  if (channel === 'meeting' || source === 'transcript' || category === 'meetings') {
    return CHANNEL_THEME.meeting;
  }
  if (channel === 'linkedin' || source === 'linkedin' || category === 'linkedin') {
    return CHANNEL_THEME.linkedin;
  }
  if (channel === 'email' || source === 'email' || category === 'emails') {
    return CHANNEL_THEME.email;
  }
  if (channel === 'call' || source === 'call' || category === 'calls') {
    return CHANNEL_THEME.call;
  }
  return CHANNEL_THEME.system;
}
