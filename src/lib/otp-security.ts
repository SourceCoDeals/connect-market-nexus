
import { supabase } from '@/integrations/supabase/client';

export interface OTPRateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_time: string;
  current_count: number;
  limit: number;
}

export class OTPSecurity {
  /**
   * Check if an OTP request is allowed for the given email
   */
  static async checkLimit(email: string): Promise<OTPRateLimitResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('otp-rate-limiter', {
        body: {
          email,
          action: 'check',
          window_minutes: 60, // 1 hour window
          max_requests: 5,    // 5 requests per hour
        }
      });

      if (error) {
        console.error('OTP rate limit check error:', error);
        // Fail open - allow the request if rate limiting service is down
        return {
          allowed: true,
          remaining: 4,
          reset_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          current_count: 1,
          limit: 5
        };
      }

      return result;
    } catch (error) {
      console.error('OTP rate limit check failed:', error);
      // Fail open
      return {
        allowed: true,
        remaining: 4,
        reset_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        current_count: 1,
        limit: 5
      };
    }
  }

  /**
   * Record an OTP request for the given email
   */
  static async recordRequest(email: string): Promise<OTPRateLimitResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('otp-rate-limiter', {
        body: {
          email,
          action: 'increment',
          window_minutes: 60, // 1 hour window
          max_requests: 5,    // 5 requests per hour
        }
      });

      if (error) {
        console.error('OTP rate limit recording error:', error);
        // Fail open
        return {
          allowed: true,
          remaining: 4,
          reset_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          current_count: 1,
          limit: 5
        };
      }

      return result;
    } catch (error) {
      console.error('OTP rate limit recording failed:', error);
      // Fail open
      return {
        allowed: true,
        remaining: 4,
        reset_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        current_count: 1,
        limit: 5
      };
    }
  }

  /**
   * Get time until rate limit resets (in minutes)
   */
  static getResetTimeMinutes(resetTime: string): number {
    const resetDate = new Date(resetTime);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60)));
  }
}
