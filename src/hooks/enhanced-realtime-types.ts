/**
 * Types for Enhanced Real-Time Analytics
 */

export interface EnhancedActiveUser {
  // Identity - REAL DATA
  sessionId: string;
  visitorId: string | null; // NEW: Persistent visitor identity
  userId: string | null;
  userName: string | null;
  displayName: string;
  companyName: string | null;
  buyerType: string | null;
  jobTitle: string | null;
  isAnonymous: boolean;

  // Location
  country: string | null;
  countryCode: string | null;
  city: string | null;
  coordinates: { lat: number; lng: number } | null;

  // Tech Stack
  deviceType: 'mobile' | 'desktop' | 'tablet';
  browser: string | null;
  os: string | null;

  // Traffic Source
  referrer: string | null;
  utmSource: string | null;

  // Entry/Attribution Data - NEW
  entrySource: string;             // Normalized: "Google", "LinkedIn", "Direct", etc.
  firstPagePath: string | null;    // Landing page path
  pageSequence: string[];          // All pages visited this session
  ga4ClientId: string | null;      // For GA4 data stitching
  firstTouchSource: string | null; // Original acquisition source
  firstTouchMedium: string | null; // Original acquisition medium
  externalReferrer: string | null; // NEW: External referrer (e.g., blog)

  // Current Session
  sessionDurationSeconds: number;
  lastActiveAt: string;
  currentPage: string | null;

  // Session Status (for display in activity feed)
  sessionStatus: 'active' | 'idle' | 'ended';

  // Real Engagement Metrics
  listingsViewed: number;
  listingsSaved: number;
  connectionsSent: number;
  totalVisits: number;
  totalTimeSpent: number;
  searchCount: number;

  // Trust Signals
  feeAgreementSigned: boolean;
  ndaSigned: boolean;

  // Cross-session journey data (NEW)
  visitorFirstSeen: string | null;       // When they first visited
  visitorTotalSessions: number;          // Sessions across all time
  visitorTotalTime: number;              // Total time on site ever
}

export interface EnhancedRealTimeData {
  activeUsers: EnhancedActiveUser[];
  totalActiveUsers: number;

  // Aggregates for summary panel
  byCountry: Array<{ country: string; countryCode: string | null; count: number }>;
  byDevice: Array<{ device: string; count: number }>;
  byReferrer: Array<{ referrer: string; count: number }>;
  byEntrySource: Array<{ source: string; count: number }>; // NEW: Entry source breakdown

  // Recent activity events
  recentEvents: Array<{
    id: string;
    type: 'page_view' | 'save' | 'connection_request';
    user: EnhancedActiveUser;
    pagePath?: string;
    listingTitle?: string;
    timestamp: string;
  }>;
}

/** Session row shape from the user_sessions select query */
export interface SessionRow {
  id: string;
  session_id: string;
  user_id: string | null;
  visitor_id: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  utm_source: string | null;
  user_agent: string | null;
  session_duration_seconds: number | null;
  last_active_at: string | null;
  started_at: string;
  is_active: boolean | null;
  ga4_client_id: string | null;
  first_touch_source: string | null;
  first_touch_medium: string | null;
  first_touch_campaign: string | null;
  first_touch_landing_page: string | null;
  first_touch_referrer: string | null;
  is_bot: boolean | null;
  lat: number | null;
  lon: number | null;
}

/** Profile row shape from engagement lookup */
export interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  company_name: string | null;
  buyer_type: string | null;
  job_title: string | null;
  fee_agreement_signed: boolean | null;
  nda_signed: boolean | null;
}

/** Engagement row shape */
export interface EngagementRow {
  user_id: string;
  listings_viewed: number | null;
  listings_saved: number | null;
  connections_requested: number | null;
  session_count: number | null;
  total_session_time: number | null;
  search_count: number | null;
}
