// Analytics type definitions

export interface AnalyticsEvent {
  eventType: string;
  eventData?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp: string;
}

export interface FeedbackAnalytics {
  total_feedback: number;
  unread_count: number;
  avg_response_time_hours: number;
  satisfaction_avg?: number;
  category_breakdown: Record<string, number>;
  priority_breakdown: Record<string, number>;
  daily_trends: DailyTrend[];
  top_users: TopUser[];
}

export interface DailyTrend {
  date: string;
  count: number;
  avg_response_time?: number;
}

export interface TopUser {
  user_id: string;
  feedback_count: number;
}

export interface MarketplaceAnalytics {
  total_users: number;
  new_users: number;
  active_sessions: number;
  total_page_views: number;
  total_listings: number;
  pending_connections: number;
  session_count: number;
}

export interface TestResult {
  test: string;
  success: boolean;
  details?: string;
  timestamp: string;
}

export interface AnalyticsHealth {
  database_connection: boolean;
  user_tracking: boolean;
  event_logging: boolean;
  performance_metrics: boolean;
  error_rate: number;
  last_updated: string;
}