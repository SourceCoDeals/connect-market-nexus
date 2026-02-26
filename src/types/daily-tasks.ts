// ─── Daily Task Dashboard Types ───

export type TaskType =
  | 'contact_owner'
  | 'build_buyer_universe'
  | 'follow_up_with_buyer'
  | 'send_materials'
  | 'update_pipeline'
  | 'schedule_call'
  | 'other';

export type TaskStatus = 'pending' | 'completed' | 'overdue';

export type ExtractionConfidence = 'high' | 'medium' | 'low';

export interface DailyTask {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  task_type: TaskType;
  status: TaskStatus;
  due_date: string;
  created_at: string;
  completed_at: string | null;
  source_meeting_id: string | null;
  source_timestamp: string | null;
  deal_reference: string | null;
  deal_id: string | null;
  priority_score: number;
  priority_rank: number | null;
  is_pinned: boolean;
  pinned_rank: number | null;
  pinned_by: string | null;
  pinned_at: string | null;
  pin_reason: string | null;
  extraction_confidence: ExtractionConfidence;
  needs_review: boolean;
  is_manual: boolean;
  updated_at: string;
}

export interface StandupMeeting {
  id: string;
  fireflies_transcript_id: string;
  fireflies_meeting_id: string | null;
  meeting_title: string | null;
  meeting_date: string;
  meeting_duration_minutes: number | null;
  tasks_extracted: number;
  tasks_unassigned: number;
  extraction_confidence_avg: number | null;
  processed_at: string | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error: string | null;
  created_at: string;
}

export interface BdTeamAlias {
  id: string;
  team_member_id: string;
  alias: string;
  created_at: string;
  created_by: string | null;
}

export interface TaskPinLog {
  id: string;
  task_id: string;
  action: 'pinned' | 'unpinned' | 'rank_changed';
  old_rank: number | null;
  new_rank: number | null;
  reason: string | null;
  performed_by: string;
  created_at: string;
}

// ─── Task Type Display Config ───

export const TASK_TYPE_CONFIG: Record<
  TaskType,
  { label: string; color: string; bgColor: string; score: number; category: string }
> = {
  contact_owner: {
    label: 'Contact Owner',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    score: 90,
    category: 'Owner-facing',
  },
  schedule_call: {
    label: 'Schedule Call',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    score: 80,
    category: 'External-facing',
  },
  follow_up_with_buyer: {
    label: 'Follow Up with Buyer',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    score: 75,
    category: 'Buyer-facing',
  },
  send_materials: {
    label: 'Send Materials',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    score: 70,
    category: 'Buyer-facing',
  },
  build_buyer_universe: {
    label: 'Build Buyer Universe',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    score: 50,
    category: 'Research / Internal',
  },
  update_pipeline: {
    label: 'Update Pipeline',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    score: 30,
    category: 'Internal',
  },
  other: {
    label: 'Other',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    score: 40,
    category: 'Varies',
  },
};

// ─── Deal Stage Scoring (Section 5.2) ───

export const DEAL_STAGE_SCORES: Record<string, number> = {
  'New / Prospecting': 20,
  'Owner Engaged': 40,
  'Marketing / Buyer Outreach': 60,
  'LOI / Negotiation': 90,
  'Under Contract / Closing': 80,
  'On Hold / Paused': 10,
};

// ─── Analytics Types ───

export interface TaskAnalytics {
  total_assigned: number;
  total_completed: number;
  total_overdue: number;
  total_pending: number;
  completion_rate: number;
  avg_completion_hours: number | null;
  by_task_type: Record<string, { total: number; completed: number; rate: number }> | null;
  daily_trend: { date: string; assigned: number; completed: number; rate: number }[] | null;
}

export interface TeamAnalytics {
  team_completion_rate: number;
  total_tasks: number;
  total_completed: number;
  total_overdue: number;
  leaderboard:
    | {
        assignee_id: string;
        total: number;
        completed: number;
        overdue: number;
        rate: number;
      }[]
    | null;
  tasks_per_day: { date: string; count: number }[] | null;
  overdue_by_type: Record<string, number> | null;
  overdue_by_member: Record<string, number> | null;
  unassigned_count: number;
}

export interface MeetingQualityAnalytics {
  total_meetings: number;
  avg_tasks_per_meeting: number;
  avg_extraction_confidence: number;
  needs_review_rate: number;
  confidence_breakdown: { high: number; medium: number; low: number };
  meetings_trend:
    | {
        date: string;
        tasks_extracted: number;
        confidence: number | null;
        unassigned: number;
        duration_minutes: number | null;
      }[]
    | null;
  assignee_match_rate: number;
}

// ─── Time Range ───

export type TaskTimeRange = 'today' | '7d' | '14d' | '30d' | '90d' | 'all' | 'custom';

export function getDateFromRange(range: TaskTimeRange): string | null {
  if (range === 'all') return null;
  if (range === 'custom') return null;
  const now = new Date();
  const days =
    range === 'today' ? 0 : range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString().split('T')[0];
}

// ─── Priority Score Calculation (Section 5.4) ───

export function calculatePriorityScore(params: {
  dealValueScore?: number; // 0-100, normalized EBITDA
  dealStageScore?: number; // 0-100, from DEAL_STAGE_SCORES
  taskTypeScore?: number; // 0-100, from TASK_TYPE_CONFIG
  daysOverdue?: number; // >= 0
}): number {
  const { dealValueScore = 50, dealStageScore = 50, taskTypeScore = 40, daysOverdue = 0 } = params;

  const overdueBonus = Math.min(daysOverdue * 5, 100);

  return dealValueScore * 0.4 + dealStageScore * 0.35 + taskTypeScore * 0.15 + overdueBonus * 0.1;
}
