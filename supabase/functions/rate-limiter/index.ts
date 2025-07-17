
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RateLimitRequest {
  identifier: string; // user_id, ip_address, etc.
  action: string; // login_attempt, connection_request, etc.
  limit?: number; // requests per window
  window_minutes?: number; // time window in minutes
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_time: string;
  current_count: number;
  limit: number;
}

// Rate limit configurations for different actions
const RATE_LIMITS = {
  login_attempt: { limit: 5, window_minutes: 15 },
  signup_attempt: { limit: 3, window_minutes: 60 },
  connection_request: { limit: 10, window_minutes: 60 },
  password_reset: { limit: 3, window_minutes: 60 },
  profile_update: { limit: 5, window_minutes: 10 },
  listing_creation: { limit: 3, window_minutes: 60 },
  email_verification: { limit: 5, window_minutes: 60 },
  admin_action: { limit: 100, window_minutes: 60 },
  api_general: { limit: 60, window_minutes: 60 },
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifier, action, limit, window_minutes }: RateLimitRequest = await req.json();
    
    if (!identifier || !action) {
      throw new Error('Identifier and action are required');
    }
    
    const config = RATE_LIMITS[action as keyof typeof RATE_LIMITS] || 
                   { limit: limit || 30, window_minutes: window_minutes || 60 };
    
    const result = await checkRateLimit(identifier, action, config.limit, config.window_minutes);
    
    // Log rate limit violations
    if (!result.allowed) {
      await logRateLimitViolation(identifier, action, result);
    }
    
    return new Response(JSON.stringify(result), {
      status: result.allowed ? 200 : 429,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in rate-limiter function:", error);
    return new Response(
      JSON.stringify({ 
        allowed: false,
        error: error.message || 'Rate limiting failed'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function checkRateLimit(
  identifier: string, 
  action: string, 
  limit: number, 
  windowMinutes: number
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const resetTime = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();
  
  try {
    // Count recent attempts
    const { data: attempts, error } = await supabase
      .from('user_activity')
      .select('id')
      .eq('activity_type', `rate_limit_${action}`)
      .eq('user_id', identifier)
      .gte('created_at', windowStart);
    
    if (error) {
      console.error('Error querying rate limit data:', error);
      // Fail open - allow the request if we can't check the rate limit
      return {
        allowed: true,
        remaining: limit - 1,
        reset_time: resetTime,
        current_count: 1,
        limit
      };
    }
    
    const currentCount = attempts?.length || 0;
    const allowed = currentCount < limit;
    
    if (allowed) {
      // Record this attempt
      await supabase
        .from('user_activity')
        .insert({
          user_id: identifier,
          activity_type: `rate_limit_${action}`,
          metadata: {
            action,
            window_minutes: windowMinutes,
            limit,
            attempt_count: currentCount + 1,
            timestamp: new Date().toISOString()
          }
        });
    }
    
    return {
      allowed,
      remaining: Math.max(0, limit - currentCount - (allowed ? 1 : 0)),
      reset_time: resetTime,
      current_count: currentCount + (allowed ? 1 : 0),
      limit
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the request
    return {
      allowed: true,
      remaining: limit - 1,
      reset_time: resetTime,
      current_count: 1,
      limit
    };
  }
}

async function logRateLimitViolation(identifier: string, action: string, result: RateLimitResult) {
  try {
    await supabase
      .from('user_activity')
      .insert({
        user_id: identifier,
        activity_type: 'rate_limit_violation',
        metadata: {
          action,
          violation_details: result,
          timestamp: new Date().toISOString(),
          severity: result.current_count > result.limit * 2 ? 'high' : 'medium'
        }
      });
    
    console.log(`Rate limit violation: ${identifier} exceeded ${action} limit`);
  } catch (error) {
    console.error('Error logging rate limit violation:', error);
  }
}

serve(handler);
