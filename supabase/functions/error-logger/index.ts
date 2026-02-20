
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

interface ErrorLogRequest {
  error_code: string;
  error_message: string;
  stack_trace?: string;
  user_id?: string;
  correlation_id?: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp?: string;
}

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    // N04 FIX: Require authenticated user
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    let authenticatedUserId: string | null = null;

    // Verify caller identity if token provided
    if (token) {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (user) {
        authenticatedUserId = user.id;
      }
    }

    // Require authentication — unauthenticated callers cannot log errors
    if (!authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const errorLog: ErrorLogRequest = await req.json();

    // Validate severity
    if (!VALID_SEVERITIES.includes(errorLog.severity)) {
      return new Response(
        JSON.stringify({ error: 'Invalid severity value' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Generate correlation ID if not provided
    const correlationId = errorLog.correlation_id || crypto.randomUUID();

    // N04 FIX: Force user_id to the authenticated user (prevent impersonation)
    const logEntry = {
      error_code: errorLog.error_code,
      error_message: errorLog.error_message,
      stack_trace: errorLog.stack_trace ? errorLog.stack_trace.substring(0, 10000) : null, // Cap stack trace size
      user_id: authenticatedUserId, // Always use authenticated user, ignore client-provided user_id
      correlation_id: correlationId,
      context: errorLog.context ? JSON.parse(JSON.stringify(errorLog.context).substring(0, 50000)) : {}, // Cap context size
      severity: errorLog.severity,
      source: errorLog.source,
      timestamp: errorLog.timestamp || new Date().toISOString(),
      environment: Deno.env.get('ENVIRONMENT') || 'production',
      user_agent: req.headers.get('user-agent'),
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    };

    // Log to console for immediate visibility
    console.log(`[${logEntry.severity.toUpperCase()}] ${logEntry.error_code}: ${logEntry.error_message}`, {
      correlationId,
      userId: logEntry.user_id,
      source: logEntry.source,
    });

    // Store in database for analysis
    const { error: insertError } = await supabase
      .from('error_logs')
      .insert(logEntry);

    if (insertError) {
      console.error('Failed to store error log:', insertError);
      // Continue execution even if logging fails
    }

    // For critical errors, could trigger immediate notifications
    if (errorLog.severity === 'critical') {
      console.error('CRITICAL ERROR DETECTED:', logEntry);
    }

    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        message: 'Error logged successfully'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in error-logger function:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to log error',
        message: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
