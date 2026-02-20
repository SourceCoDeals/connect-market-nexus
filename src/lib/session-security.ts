// session-security.ts — STUBBED OUT
//
// The previous implementation used a canvas-fingerprint as a fake IP address
// and called a session-security edge function with no real security value.
// All session security is now handled by:
//   1. Supabase Auth (JWT validation via getUser())
//   2. RLS policies on the profiles table
//   3. Password change → signOut({ scope: 'others' })
//
// This file is kept as a stub to avoid breaking imports in
// use-session-monitoring.ts / SessionMonitoringProvider.tsx.

export interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  user_status?: {
    email_verified: boolean;
    approval_status: string;
    is_admin: boolean;
  };
}

export interface SessionAnomalyResult {
  anomalies: string[];
  risk_score: number;
  recommendation: string;
}

export class SessionSecurity {
  static async validateSession(_userId: string): Promise<SessionValidationResult> {
    return { valid: true, reason: 'stub — real auth handled by Supabase JWT' };
  }
  static async checkConcurrentSessions(_userId: string) {
    return { concurrent_sessions: 1, max_allowed: 5 };
  }
  static async detectAnomalies(_userId: string): Promise<SessionAnomalyResult> {
    return { anomalies: [], risk_score: 0, recommendation: 'normal' };
  }
  static async invalidateOldSessions(_userId: string) {
    return { invalidated: 0 };
  }
}
