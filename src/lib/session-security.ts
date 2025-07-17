
import { supabase } from '@/integrations/supabase/client';

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
  /**
   * Validate current session with security checks
   */
  static async validateSession(userId: string): Promise<SessionValidationResult> {
    try {
      const ipAddress = this.getClientIP();
      const userAgent = navigator.userAgent;

      const { data: result, error } = await supabase.functions.invoke('session-security', {
        body: {
          action: 'validate_session',
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent
        }
      });

      if (error) {
        console.error('Session validation error:', error);
        return { valid: false, reason: 'Validation service unavailable' };
      }

      return result;
    } catch (error) {
      console.error('Session validation failed:', error);
      return { valid: false, reason: 'Validation failed' };
    }
  }

  /**
   * Check for concurrent sessions
   */
  static async checkConcurrentSessions(userId: string) {
    try {
      const { data: result, error } = await supabase.functions.invoke('session-security', {
        body: {
          action: 'check_concurrent_sessions',
          user_id: userId
        }
      });

      if (error) {
        console.error('Concurrent session check error:', error);
        return { concurrent_sessions: 1, max_allowed: 5 };
      }

      return result;
    } catch (error) {
      console.error('Concurrent session check failed:', error);
      return { concurrent_sessions: 1, max_allowed: 5 };
    }
  }

  /**
   * Detect session anomalies
   */
  static async detectAnomalies(userId: string): Promise<SessionAnomalyResult> {
    try {
      const ipAddress = this.getClientIP();
      const userAgent = navigator.userAgent;

      const { data: result, error } = await supabase.functions.invoke('session-security', {
        body: {
          action: 'detect_anomalies',
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent
        }
      });

      if (error) {
        console.error('Anomaly detection error:', error);
        return { anomalies: [], risk_score: 0, recommendation: 'normal' };
      }

      return result;
    } catch (error) {
      console.error('Anomaly detection failed:', error);
      return { anomalies: [], risk_score: 0, recommendation: 'normal' };
    }
  }

  /**
   * Invalidate old sessions
   */
  static async invalidateOldSessions(userId: string) {
    try {
      const { data: result, error } = await supabase.functions.invoke('session-security', {
        body: {
          action: 'invalidate_sessions',
          user_id: userId
        }
      });

      if (error) {
        console.error('Session invalidation error:', error);
        return { invalidated: 0 };
      }

      return result;
    } catch (error) {
      console.error('Session invalidation failed:', error);
      return { invalidated: 0 };
    }
  }

  /**
   * Get client IP address (simulated for browser environment)
   */
  private static getClientIP(): string {
    // In a real application, you'd get this from a service or server
    // For now, we'll use a fingerprint based on browser characteristics
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx!.textBaseline = 'top';
    ctx!.font = '14px Arial';
    ctx!.fillText('Browser fingerprint', 2, 2);
    const fingerprint = canvas.toDataURL();
    
    return btoa(fingerprint.substring(0, 50)).substring(0, 15);
  }
}
