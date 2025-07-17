
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface OTPRateLimitRequest {
  email: string;
  action: 'check' | 'increment';
  window_minutes?: number;
  max_requests?: number;
}

interface OTPRateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_time: string;
  current_count: number;
  limit: number;
}

const DEFAULT_WINDOW_MINUTES = 60; // 1 hour
const DEFAULT_MAX_REQUESTS = 5;    // 5 OTP requests per hour

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, action, window_minutes = DEFAULT_WINDOW_MINUTES, max_requests = DEFAULT_MAX_REQUESTS }: OTPRateLimitRequest = await req.json();
    
    if (!email || !action) {
      throw new Error('Email and action are required');
    }
    
    const windowStart = new Date(Date.now() - window_minutes * 60 * 1000);
    const resetTime = new Date(Date.now() + window_minutes * 60 * 1000);

    // Check current rate limit status
    const { data: existingRecord, error: fetchError } = await supabase
      .from('otp_rate_limits')
      .select('*')
      .eq('email', email)
      .gte('window_start', windowStart.toISOString())
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw fetchError;
    }

    let currentCount = 0;
    let recordId = null;

    if (existingRecord) {
      currentCount = existingRecord.request_count;
      recordId = existingRecord.id;
    }

    const allowed = currentCount < max_requests;

    if (action === 'increment' && allowed) {
      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('otp_rate_limits')
          .update({
            request_count: currentCount + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recordId);

        if (updateError) throw updateError;
        currentCount += 1;
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from('otp_rate_limits')
          .insert({
            email,
            request_count: 1,
            window_start: new Date().toISOString(),
          });

        if (insertError) throw insertError;
        currentCount = 1;
      }
    }

    const result: OTPRateLimitResult = {
      allowed,
      remaining: Math.max(0, max_requests - currentCount),
      reset_time: resetTime.toISOString(),
      current_count: currentCount,
      limit: max_requests,
    };

    return new Response(JSON.stringify(result), {
      status: allowed ? 200 : 429,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in OTP rate limiter:", error);
    return new Response(
      JSON.stringify({ 
        allowed: false,
        error: error.message || 'OTP rate limiting failed',
        remaining: 0,
        reset_time: new Date(Date.now() + DEFAULT_WINDOW_MINUTES * 60 * 1000).toISOString(),
        current_count: DEFAULT_MAX_REQUESTS,
        limit: DEFAULT_MAX_REQUESTS,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
