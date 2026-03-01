/**
 * Types for Recommended Buyers
 */

export interface TranscriptInsight {
  call_count: number;
  ceo_detected: boolean;
  latest_call_date: string | null;
}

export interface OutreachInfo {
  contacted: boolean;
  nda_signed: boolean;
  cim_sent: boolean;
  meeting_scheduled: boolean;
  outcome: string | null;
}

export interface RecommendedBuyer {
  buyer_id: string;
  company_name: string;
  pe_firm_name: string | null;
  buyer_type: string | null;
  hq_state: string | null;
  hq_city: string | null;
  has_fee_agreement: boolean;
  acquisition_appetite: string | null;
  thesis_summary: string | null;
  total_acquisitions: number;
  // Scores
  composite_fit_score: number;
  geography_score: number;
  size_score: number;
  service_score: number;
  owner_goals_score: number;
  fit_reasoning: string | null;
  score_status: string | null;
  // Tier
  tier: 'move_now' | 'strong_candidate' | 'speculative';
  tier_label: string;
  // Fit signals
  fit_signals: string[];
  // Engagement
  last_engagement: string | null;
  last_engagement_type: string | null;
  days_since_engagement: number | null;
  engagement_cold: boolean;
  // Transcript insights
  transcript_insights: TranscriptInsight;
  // Outreach status
  outreach_info: OutreachInfo;
  // Source indicator
  source: 'scored' | 'marketplace' | 'pipeline' | 'contact';
}

export interface RecommendedBuyersResult {
  buyers: RecommendedBuyer[];
  total: number;
  totalScored: number;
  tierSummary: {
    move_now: number;
    strong_candidate: number;
    speculative: number;
  };
  dataStats: {
    buyers_with_transcripts: number;
    buyers_with_outreach: number;
    buyers_with_ceo_engagement: number;
  };
  cachedAt: string;
}
