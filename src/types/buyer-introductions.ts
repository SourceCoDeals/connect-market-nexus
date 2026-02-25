export type IntroductionStatus =
  | 'not_introduced'
  | 'introduction_scheduled'
  | 'introduced'
  | 'passed'
  | 'rejected';

export interface BuyerIntroduction {
  id: string;
  contact_id: string | null;
  buyer_name: string;
  buyer_firm_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_linkedin_url: string | null;
  listing_id: string | null;
  company_name: string;
  company_id: string | null;
  introduction_status: IntroductionStatus;
  targeting_reason: string | null;
  expected_deal_size_low: number | null;
  expected_deal_size_high: number | null;
  internal_champion: string | null;
  internal_champion_email: string | null;
  introduction_scheduled_date: string | null;
  introduction_date: string | null;
  introduced_by: string | null;
  introduced_by_email: string | null;
  introduction_method: string | null;
  introduction_notes: string | null;
  passed_date: string | null;
  passed_reason: string | null;
  passed_notes: string | null;
  buyer_feedback: string | null;
  next_step: string | null;
  expected_next_step_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface IntroductionStatusLog {
  id: string;
  buyer_introduction_id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  changed_by: string;
  changed_at: string;
}

export interface IntroductionActivity {
  id: string;
  buyer_introduction_id: string;
  activity_type:
    | 'email_sent'
    | 'call_made'
    | 'meeting_scheduled'
    | 'feedback_received'
    | 'status_update'
    | 'note_added';
  activity_date: string;
  description: string | null;
  actor: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
}

export interface CreateBuyerIntroductionInput {
  buyer_name: string;
  buyer_firm_name: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_linkedin_url?: string;
  listing_id: string;
  company_name: string;
  targeting_reason?: string;
  expected_deal_size_low?: number;
  expected_deal_size_high?: number;
  internal_champion?: string;
  internal_champion_email?: string;
}

export interface UpdateBuyerIntroductionInput {
  introduction_status?: IntroductionStatus;
  introduction_date?: string;
  introduced_by?: string;
  introduced_by_email?: string;
  introduction_method?: string;
  introduction_notes?: string;
  passed_date?: string;
  passed_reason?: string;
  passed_notes?: string;
  buyer_feedback?: string;
  next_step?: string;
  expected_next_step_date?: string;
  introduction_scheduled_date?: string;
}
