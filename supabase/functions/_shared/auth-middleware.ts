/**
 * Universal Auth Middleware for ALL Edge Functions
 *
 * Provides consistent authentication across all functions with:
 * - User JWT validation
 * - Service role validation for workers
 * - Admin role checking
 * - Rate limiting integration
 *
 * Usage:
 *   const auth = await authenticateRequest(req, supabase, { requireAdmin: true });
 *   if (!auth.authenticated) return auth.errorResponse;
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, rateLimitResponse } from './security.ts';

export interface AuthResult {
  authenticated: boolean;
  userId: string | null;
  isAdmin: boolean;
  isServiceRole: boolean;
  user: any | null;
  errorResponse?: Response;
}

export interface AuthOptions {
  requireAuth?: boolean;        // Default: true
  requireAdmin?: boolean;        // Default: false
  requireServiceRole?: boolean;  // Default: false
  allowServiceRole?: boolean;    // Allow service role key as auth. Default: false
  rateLimitKey?: string;         // Rate limit category (e.g., 'ai_query', 'ai_enrichment')
  rateLimitAdmin?: boolean;      // Apply rate limits to admins. Default: false
  corsHeaders?: Record<string, string>;
}

const DEFAULT_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Authenticate incoming request with comprehensive checks
 */
export async function authenticateRequest(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  options: AuthOptions = {}
): Promise<AuthResult> {
  const {
    requireAuth = true,
    requireAdmin = false,
    requireServiceRole = false,
    allowServiceRole = false,
    rateLimitKey,
    rateLimitAdmin = false,
    corsHeaders = DEFAULT_CORS_HEADERS,
  } = options;

  // Extract token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (!requireAuth) {
      return { authenticated: false, userId: null, isAdmin: false, isServiceRole: false, user: null };
    }
    return {
      authenticated: false,
      userId: null,
      isAdmin: false,
      isServiceRole: false,
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  const token = authHeader.replace('Bearer ', '');

  // Check if service role key (for workers/cron)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const isServiceRole = allowServiceRole && token === serviceRoleKey;

  if (isServiceRole) {
    if (requireServiceRole || allowServiceRole) {
      return {
        authenticated: true,
        userId: 'system',
        isAdmin: true,
        isServiceRole: true,
        user: null,
      };
    }
  }

  // Validate user JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      authenticated: false,
      userId: null,
      isAdmin: false,
      isServiceRole: false,
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  // Check admin status if required
  let isAdmin = false;
  if (requireAdmin) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    isAdmin = profile?.is_admin || false;

    if (!isAdmin) {
      return {
        authenticated: true,
        userId: user.id,
        isAdmin: false,
        isServiceRole: false,
        user,
        errorResponse: new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        ),
      };
    }
  }

  // Apply rate limiting if specified
  if (rateLimitKey && (!isAdmin || rateLimitAdmin)) {
    const rateLimitResult = await checkRateLimit(supabase, user.id, rateLimitKey, isAdmin);
    if (!rateLimitResult.allowed) {
      return {
        authenticated: true,
        userId: user.id,
        isAdmin,
        isServiceRole: false,
        user,
        errorResponse: rateLimitResponse(rateLimitResult),
      };
    }
  }

  return {
    authenticated: true,
    userId: user.id,
    isAdmin,
    isServiceRole: false,
    user,
  };
}

/**
 * Simplified auth check for functions that just need basic auth
 */
export async function requireAuth(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  corsHeaders: Record<string, string> = DEFAULT_CORS_HEADERS
): Promise<{ user: any; userId: string } | Response> {
  const auth = await authenticateRequest(req, supabase, { requireAuth: true, corsHeaders });

  if (!auth.authenticated || auth.errorResponse) {
    return auth.errorResponse!;
  }

  return { user: auth.user, userId: auth.userId! };
}

/**
 * Require admin access
 */
export async function requireAdmin(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  corsHeaders: Record<string, string> = DEFAULT_CORS_HEADERS
): Promise<{ user: any; userId: string } | Response> {
  const auth = await authenticateRequest(req, supabase, {
    requireAuth: true,
    requireAdmin: true,
    corsHeaders
  });

  if (!auth.authenticated || auth.errorResponse) {
    return auth.errorResponse!;
  }

  return { user: auth.user, userId: auth.userId! };
}

/**
 * Require service role (for cron/worker functions)
 */
export async function requireServiceRole(
  req: Request,
  corsHeaders: Record<string, string> = DEFAULT_CORS_HEADERS
): Promise<true | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (token !== serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Service role key required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return true;
}
