export interface KPIMetric {
  value: number;
  trend: number;
  sparkline: number[];
}

export interface UnifiedAnalyticsData {
  kpis: {
    visitors: KPIMetric;
    sessions: KPIMetric;
    connections: KPIMetric;
    conversionRate: { value: number; trend: number };
    bounceRate: { value: number; trend: number };
    avgSessionTime: { value: number; trend: number };
    onlineNow: number;
  };

  dailyMetrics: Array<{
    date: string;
    visitors: number;
    sessions: number;
    connections: number;
    bounceRate: number;
  }>;

  channels: Array<{ name: string; visitors: number; sessions: number; signups: number; connections: number; icon: string }>;
  referrers: Array<{ domain: string; visitors: number; sessions: number; signups: number; connections: number; favicon: string }>;
  campaigns: Array<{ name: string; visitors: number; sessions: number; signups: number; connections: number }>;
  keywords: Array<{ term: string; visitors: number; sessions: number; signups: number; connections: number }>;

  countries: Array<{ name: string; code: string; visitors: number; sessions: number; signups: number; connections: number }>;
  regions: Array<{ name: string; country: string; visitors: number; sessions: number; signups: number; connections: number }>;
  cities: Array<{ name: string; country: string; visitors: number; sessions: number; signups: number; connections: number }>;
  geoCoverage: number;

  selfReportedSources: Array<{ source: string; signups: number; connections: number; keywords: string[] }>;

  topPages: Array<{ path: string; visitors: number; avgTime: number; bounceRate: number }>;
  entryPages: Array<{ path: string; visitors: number; bounceRate: number }>;
  exitPages: Array<{ path: string; exits: number; exitRate: number }>;
  blogEntryPages: Array<{ path: string; visitors: number; sessions: number }>;

  browsers: Array<{ name: string; visitors: number; signups: number; percentage: number }>;
  operatingSystems: Array<{ name: string; visitors: number; signups: number; percentage: number }>;
  devices: Array<{ type: string; visitors: number; signups: number; percentage: number }>;

  funnel: {
    stages: Array<{ name: string; count: number; dropoff: number }>;
    overallConversion: number;
  };

  topUsers: Array<{
    id: string;
    name: string;
    isAnonymous: boolean;
    company: string;
    sessions: number;
    pagesViewed: number;
    connections: number;
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
    os?: string;
    source?: string;
    referrerDomain?: string;
    lastSeen?: string;
    timeOnSite?: number;
    activityDays?: Array<{ date: string; pageViews: number; level: 'none' | 'low' | 'medium' | 'high' }>;
  }>;
}

export type FirstSessionData = {
  id: string;
  session_id: string;
  user_id: string | null;
  visitor_id: string | null;
  referrer: string | null;
  original_external_referrer: string | null;
  blog_landing_page: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  started_at: string | null;
  user_agent: string | null;
};

/** A raw analytics session row from the sessions table */
export interface AnalyticsSession {
  id?: string;
  session_id: string;
  user_id: string | null;
  visitor_id: string | null;
  referrer: string | null;
  original_external_referrer?: string | null;
  blog_landing_page?: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  started_at: string | null;
  user_agent: string | null;
  session_duration_seconds?: number | null;
}

/** A connection request record used in analytics */
export interface AnalyticsConnection {
  id: string;
  user_id: string | null;
  created_at: string;
  lead_nda_signed?: boolean | null;
  lead_fee_agreement_signed?: boolean | null;
}

/** A profile record used in analytics */
export interface AnalyticsProfile {
  id: string;
  referral_source: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  email?: string | null;
  buyer_type?: string | null;
}

/** A page view record used in analytics */
export interface AnalyticsPageView {
  id?: string;
  session_id: string | null;
  page_path: string;
  created_at: string | null;
  exit_page?: boolean | null;
}

/** A daily metrics aggregate row */
export interface DailyMetricRow {
  date: string;
  unique_visitors?: number;
  total_sessions?: number;
  connection_requests?: number;
  bounce_rate?: number;
}
