// ============================================================
// AI Task Management System v3.0 — TypeScript Types
// ============================================================

// --- Enums ---

export type RmTaskEntityType = 'deal' | 'buyer' | 'contact';

export type RmTaskPriority = 'high' | 'medium' | 'low';

export type RmTaskStatus =
  | 'open'
  | 'in_progress'
  | 'completed'
  | 'snoozed'
  | 'cancelled'
  | 'deal_closed';

export type RmTaskSource = 'manual' | 'ai' | 'chatbot' | 'system' | 'template';

export type RmTaskAiConfidence = 'high' | 'medium';

export type RmTaskAiSpeaker = 'advisor' | 'seller' | 'buyer';

export type RmDealTeamRole = 'lead' | 'analyst' | 'support';

// --- Aging Tiers ---

export type OverdueTier = 'at_risk' | 'recent' | 'aging' | 'critical' | 'abandoned';

/** Parse a YYYY-MM-DD string as a local-timezone midnight date (avoids UTC offset issues) */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getOverdueTier(dueDate: string | null, status: RmTaskStatus): OverdueTier | null {
  if (!dueDate || !['open', 'in_progress'].includes(status)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0); // local midnight
  const due = parseLocalDate(dueDate);
  const diffMs = now.getTime() - due.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < -2) return null; // more than 48h away
  if (diffDays < 0) return 'at_risk'; // due within 48h
  if (diffDays <= 3) return 'recent'; // 1-3 days overdue
  if (diffDays <= 7) return 'aging'; // 4-7 days overdue
  if (diffDays <= 14) return 'critical'; // 8-14 days overdue
  return 'abandoned'; // 15+ days overdue
}

export const OVERDUE_TIER_CONFIG: Record<
  OverdueTier,
  { label: string; color: string; bgColor: string }
> = {
  at_risk: { label: 'AT RISK', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  recent: { label: 'OVERDUE', color: 'text-red-700', bgColor: 'bg-red-100' },
  aging: { label: 'AGING', color: 'text-red-800', bgColor: 'bg-red-200' },
  critical: { label: 'CRITICAL', color: 'text-red-900', bgColor: 'bg-red-300' },
  abandoned: { label: 'ABANDONED', color: 'text-white', bgColor: 'bg-red-700' },
};

// --- Snooze Presets ---

export type SnoozePreset = 'tomorrow' | '1_week' | '2_weeks' | '1_month' | 'custom';

export const SNOOZE_PRESETS: { value: SnoozePreset; label: string; days: number | null }[] = [
  { value: 'tomorrow', label: 'Tomorrow', days: 1 },
  { value: '1_week', label: '1 Week', days: 7 },
  { value: '2_weeks', label: '2 Weeks', days: 14 },
  { value: '1_month', label: '1 Month', days: 30 },
  { value: 'custom', label: 'Custom Date', days: null },
];

// --- Core Interfaces ---

export interface RmTask {
  id: string;
  title: string;
  entity_type: RmTaskEntityType;
  entity_id: string;
  secondary_entity_type: RmTaskEntityType | null;
  secondary_entity_id: string | null;
  due_date: string | null;
  expires_at: string | null;
  priority: RmTaskPriority;
  owner_id: string;
  deal_team_visible: boolean;
  status: RmTaskStatus;
  source: RmTaskSource;
  notes: string | null;
  completion_notes: string | null;
  completed_by: string | null;
  completed_at: string | null;
  completion_transcript_id: string | null;
  ai_evidence_quote: string | null;
  ai_relevance_score: number | null;
  ai_confidence: RmTaskAiConfidence | null;
  ai_speaker_assigned_to: RmTaskAiSpeaker | null;
  transcript_id: string | null;
  confirmed_at: string | null;
  dismissed_at: string | null;
  snoozed_until: string | null;
  depends_on: string | null;
  buyer_deal_score: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RmTaskWithRelations extends RmTask {
  owner?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  entity_name?: string;
  secondary_entity_name?: string;
  blocking_task?: {
    id: string;
    title: string;
    status: RmTaskStatus;
  } | null;
}

export interface RmDealTeam {
  id: string;
  deal_id: string;
  user_id: string;
  role: RmDealTeamRole;
  created_at: string;
}

export interface RmDealTeamWithProfile extends RmDealTeam {
  user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

// --- Task Creation ---

export interface CreateRmTaskInput {
  title: string;
  entity_type: RmTaskEntityType;
  entity_id: string;
  secondary_entity_type?: RmTaskEntityType | null;
  secondary_entity_id?: string | null;
  due_date: string | null;
  priority?: RmTaskPriority;
  owner_id: string;
  deal_team_visible?: boolean;
  source?: RmTaskSource;
  notes?: string | null;
  depends_on?: string | null;
}

// --- Template System ---

export type DealStageTemplate =
  | 'intake_qualification'
  | 'build_buyer_list'
  | 'nda_phase'
  | 'cim_phase'
  | 'ioi_management_presentations'
  | 'loi_diligence';

export interface TemplateTask {
  title: string;
  due_days: number;
  priority: RmTaskPriority;
  depends_on_index?: number; // index of blocking task in same template
}

export const DEAL_STAGE_TEMPLATES: Record<
  DealStageTemplate,
  { label: string; tasks: TemplateTask[] }
> = {
  intake_qualification: {
    label: 'Intake & Qualification',
    tasks: [
      { title: 'Conduct intake call with owner', due_days: 7, priority: 'high' },
      { title: 'Collect 3 years P&Ls', due_days: 14, priority: 'high' },
      { title: 'Collect EBITDA bridge', due_days: 14, priority: 'high' },
      { title: 'Qualify deal for full engagement', due_days: 21, priority: 'medium' },
    ],
  },
  build_buyer_list: {
    label: 'Build Buyer List',
    tasks: [
      { title: 'Build initial buyer universe (50+ buyers)', due_days: 14, priority: 'high' },
      {
        title: 'Score all buyers against deal',
        due_days: 21,
        priority: 'medium',
        depends_on_index: 0,
      },
      {
        title: 'Get seller approval on buyer list',
        due_days: 28,
        priority: 'medium',
        depends_on_index: 1,
      },
    ],
  },
  nda_phase: {
    label: 'NDA Phase',
    tasks: [
      { title: 'Send NDA to top 15 buyers', due_days: 3, priority: 'high' },
      { title: 'Track NDA returns', due_days: 14, priority: 'medium', depends_on_index: 0 },
      {
        title: 'Follow up on unsigned NDAs at 7 days',
        due_days: 10,
        priority: 'medium',
        depends_on_index: 0,
      },
    ],
  },
  cim_phase: {
    label: 'CIM Phase',
    tasks: [
      { title: 'Deliver CIM to all NDA-signed buyers', due_days: 1, priority: 'high' },
      {
        title: 'Follow up on CIM receipt confirmation',
        due_days: 5,
        priority: 'medium',
        depends_on_index: 0,
      },
      { title: 'First round IOI deadline set', due_days: 30, priority: 'medium' },
    ],
  },
  ioi_management_presentations: {
    label: 'IOI & Management Presentations',
    tasks: [
      { title: 'Review all IOIs received', due_days: 7, priority: 'high' },
      {
        title: 'Select buyers for management presentations',
        due_days: 5,
        priority: 'high',
        depends_on_index: 0,
      },
      {
        title: 'Schedule management presentations',
        due_days: 14,
        priority: 'medium',
        depends_on_index: 1,
      },
      { title: 'Collect final IOIs', due_days: 30, priority: 'medium' },
    ],
  },
  loi_diligence: {
    label: 'LOI & Diligence',
    tasks: [
      { title: 'Send LOI to seller for review', due_days: 3, priority: 'high' },
      { title: 'Seller feedback on LOI', due_days: 7, priority: 'high', depends_on_index: 0 },
      { title: 'Open data room', due_days: 3, priority: 'medium' },
      { title: 'Assign DD coordinator', due_days: 1, priority: 'medium' },
    ],
  },
};

// --- Filter types ---

export interface RmTaskFilters {
  entityType?: RmTaskEntityType;
  priority?: RmTaskPriority;
  status?: RmTaskStatus;
  source?: RmTaskSource;
  dateRange?: 'today' | '7d' | '14d' | '30d' | '90d' | 'all' | 'custom';
  customDateFrom?: string;
  customDateTo?: string;
}

// --- Due date helpers ---

export function getDueDateColor(dueDate: string | null, status: RmTaskStatus): string {
  if (!dueDate || !['open', 'in_progress'].includes(status)) return 'text-muted-foreground';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = parseLocalDate(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'text-red-600 font-semibold'; // overdue
  if (diffDays <= 2) return 'text-amber-600'; // due within 48h
  return 'text-green-600'; // > 48h away
}

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'No due date';
  const date = parseLocalDate(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 7) return `In ${diffDays} days`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
