
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create error_logs table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS public.error_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        error_code TEXT NOT NULL,
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        user_id UUID,
        correlation_id TEXT,
        context JSONB DEFAULT '{}',
        severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
        source TEXT NOT NULL,
        environment TEXT DEFAULT 'production',
        user_agent TEXT,
        ip_address TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    const { error: tableError } = await supabase.rpc('exec_sql', { query: createTableQuery });
    
    if (tableError) {
      console.error('Error creating error_logs table:', tableError);
      return new Response(
        JSON.stringify({ error: 'Failed to create error logs table' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create indexes for better performance
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
      CREATE INDEX IF NOT EXISTS idx_error_logs_source ON public.error_logs(source);
      CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_error_logs_correlation_id ON public.error_logs(correlation_id);
      CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON public.error_logs(timestamp);
    `;

    const { error: indexError } = await supabase.rpc('exec_sql', { query: createIndexesQuery });
    
    if (indexError) {
      console.error('Error creating indexes:', indexError);
      // Continue even if indexes fail
    }

    // Set up RLS policies
    const rlsQuery = `
      ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
      
      -- Allow admins to view all error logs
      CREATE POLICY IF NOT EXISTS "Admins can view all error logs" ON public.error_logs
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_admin = true
          )
        );
      
      -- Allow system to insert error logs
      CREATE POLICY IF NOT EXISTS "System can insert error logs" ON public.error_logs
        FOR INSERT WITH CHECK (true);
    `;

    const { error: rlsError } = await supabase.rpc('exec_sql', { query: rlsQuery });
    
    if (rlsError) {
      console.error('Error setting up RLS:', rlsError);
      // Continue even if RLS setup fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Error logging system initialized successfully' 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('Error in setup-error-logging:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to initialize error logging system',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

serve(handler);
