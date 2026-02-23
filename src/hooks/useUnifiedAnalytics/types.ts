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
