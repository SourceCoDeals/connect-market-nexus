
import { supabase } from '@/integrations/supabase/client';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_time: string;
  current_count: number;
  limit: number;
}

export class RateLimiter {
  /**
   * Check if an action is rate limited for a user
   */
  static async checkLimit(
    identifier: string, 
    action: string, 
    customLimit?: number, 
    customWindowMinutes?: number
  ): Promise<RateLimitResult> {
    try {
      const { data: result, error } = await supabase.functions.invoke('rate-limiter', {
        body: {
          identifier,
          action,
          limit: customLimit,
          window_minutes: customWindowMinutes
        }
      });

      if (error) {
        console.error('Rate limit check error:', error);
        // Fail open - allow the request if rate limiting service is down
        return {
          allowed: true,
          remaining: 10,
          reset_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          current_count: 1,
          limit: customLimit || 30
        };
      }

      return result;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open
      return {
        allowed: true,
        remaining: 10,
        reset_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        current_count: 1,
        limit: customLimit || 30
      };
    }
  }

  /**
   * Get IP address from request headers (for client-side usage)
   */
  static getClientIdentifier(): string {
    // In a real application, you'd get the actual IP address
    // For now, we'll use a combination of user agent and timestamp
    const userAgent = navigator.userAgent;
    const screen = `${window.screen.width}x${window.screen.height}`;
    return btoa(`${userAgent}-${screen}`).substring(0, 32);
  }
}
