
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const errorLog: ErrorLogRequest = await req.json();
    
    // Generate correlation ID if not provided
    const correlationId = errorLog.correlation_id || crypto.randomUUID();
    
    // Enhanced error logging with structured data
    const logEntry = {
      error_code: errorLog.error_code,
      error_message: errorLog.error_message,
      stack_trace: errorLog.stack_trace,
      user_id: errorLog.user_id,
      correlation_id: correlationId,
      context: errorLog.context || {},
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
      context: logEntry.context
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
      // Could integrate with external alerting systems here
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
