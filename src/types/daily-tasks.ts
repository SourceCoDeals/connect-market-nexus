// ─── Daily Standup Tasks Types ───

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

export interface StandupMeeting {
  id: string;
  fireflies_transcript_id: string;
  meeting_title: string | null;
  meeting_date: string;
  meeting_duration_minutes: number | null;
  transcript_url: string | null;
  tasks_extracted: number;
  tasks_unassigned: number;
  extraction_confidence_avg: number | null;
  processed_at: string;
  created_at: string;
}

export interface DailyStandupTask {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  task_type: TaskType;
  status: TaskStatus;
  due_date: string;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
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

export interface DailyStandupTaskWithRelations extends DailyStandupTask {
  assignee?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  deal?: {
    id: string;
    listing_id: string;
    listings: {
      title: string | null;
      internal_company_name: string | null;
      ebitda: number | null;
    } | null;
    deal_stages: {
      name: string;
    } | null;
  } | null;
  source_meeting?: StandupMeeting | null;
}

export interface TeamMemberAlias {
  id: string;
  profile_id: string;
  alias: string;
  created_at: string;
  created_by: string | null;
}

export interface TaskPinLog {
  id: string;
  task_id: string;
  action: 'pinned' | 'unpinned';
  pinned_rank: number | null;
  reason: string | null;
  performed_by: string;
  performed_at: string;
}

// ─── Task Type Metadata ───

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  contact_owner: 'Contact Owner',
  build_buyer_universe: 'Build Buyer Universe',
  follow_up_with_buyer: 'Follow Up with Buyer',
  send_materials: 'Send Materials',
  update_pipeline: 'Update Pipeline',
  schedule_call: 'Schedule Call',
  other: 'Other',
};

export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  contact_owner: 'bg-red-100 text-red-800 border-red-200',
  build_buyer_universe: 'bg-blue-100 text-blue-800 border-blue-200',
  follow_up_with_buyer: 'bg-amber-100 text-amber-800 border-amber-200',
  send_materials: 'bg-purple-100 text-purple-800 border-purple-200',
  update_pipeline: 'bg-gray-100 text-gray-800 border-gray-200',
  schedule_call: 'bg-green-100 text-green-800 border-green-200',
  other: 'bg-slate-100 text-slate-800 border-slate-200',
};

export const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'contact_owner', label: 'Contact Owner' },
  { value: 'build_buyer_universe', label: 'Build Buyer Universe' },
  { value: 'follow_up_with_buyer', label: 'Follow Up with Buyer' },
  { value: 'send_materials', label: 'Send Materials' },
  { value: 'update_pipeline', label: 'Update Pipeline' },
  { value: 'schedule_call', label: 'Schedule Call' },
  { value: 'other', label: 'Other' },
];

// ─── Priority Scoring Constants ───

export const DEAL_STAGE_SCORES: Record<string, number> = {
  Sourced: 20,
  Qualified: 30,
  'NDA Sent': 40,
  'NDA Signed': 50,
  'Fee Agreement Sent': 55,
  'Fee Agreement Signed': 60,
  'Due Diligence': 70,
  'LOI Submitted': 90,
  'Under Contract': 80,
  'Closed Won': 100,
  'Closed Lost': 0,
};

export const TASK_TYPE_SCORES: Record<TaskType, number> = {
  contact_owner: 90,
  schedule_call: 80,
  follow_up_with_buyer: 75,
  send_materials: 70,
  build_buyer_universe: 50,
  update_pipeline: 30,
  other: 40,
};

// ─── Analytics Types ───

export interface TaskAnalyticsSummary {
  total_assigned: number;
  total_completed: number;
  total_overdue: number;
  completion_rate: number;
  avg_time_to_complete_hours: number | null;
  by_task_type: Record<TaskType, { assigned: number; completed: number; overdue: number }>;
}

export interface TeamMemberScorecard extends TaskAnalyticsSummary {
  member_id: string;
  member_name: string;
  priority_discipline_score: number;
  completion_trend: { date: string; rate: number }[];
}

export interface MeetingQualityMetrics {
  meeting_id: string;
  meeting_date: string;
  extraction_confidence_rate: number;
  needs_review_rate: number;
  tasks_per_meeting: number;
  assignee_match_rate: number;
  meeting_duration_minutes: number | null;
}
