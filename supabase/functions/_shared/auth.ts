/**
 * Shared authentication helpers for edge functions.
 *
 * Provides reusable admin authentication checks so that each function
 * doesn't have to re-implement the same JWT validation + is_admin RPC.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AuthResult {
  authenticated: boolean;
  isAdmin: boolean;
  userId?: string;
  isServiceRole?: boolean;
  error?: string;
}

/**
 * Verify the request has a valid authenticated user (any role).
 * Uses the anon key to validate the JWT.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { authenticated: false, isAdmin: false, error: "Authentication required" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

  if (authError || !user) {
    return { authenticated: false, isAdmin: false, error: "Invalid authentication token" };
  }

  return { authenticated: true, isAdmin: false, userId: user.id };
}

/**
 * Verify the request has a valid authenticated admin user.
 * Uses the anon key to validate the JWT, then checks is_admin via RPC.
 */
export async function requireAdmin(
  req: Request,
  supabaseAdmin: any
): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if (!auth.authenticated) return auth;

  const { data: isAdmin } = await supabaseAdmin.rpc("is_admin", { user_id: auth.userId });
  if (!isAdmin) {
    return { authenticated: true, isAdmin: false, userId: auth.userId, error: "Admin access required" };
  }

  return { authenticated: true, isAdmin: true, userId: auth.userId };
}

/**
 * Verify the request has a valid admin user OR is an internal service-to-service call.
 * Internal calls are identified by the Authorization bearer token matching the service role key,
 * or the x-internal-secret header matching the service role key.
 *
 * Use this for functions that are called both from the admin UI and from queue workers
 * (e.g., enrich-deal called by process-enrichment-queue).
 */
export async function requireAdminOrServiceRole(
  req: Request,
  supabaseAdmin: any
): Promise<AuthResult> {
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Check x-internal-secret header first (queue workers)
  const internalSecret = req.headers.get("x-internal-secret") || "";
  if (internalSecret === supabaseServiceKey) {
    return { authenticated: true, isAdmin: true, isServiceRole: true };
  }

  // Check if bearer token is the service role key (internal function-to-function calls)
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (token === supabaseServiceKey) {
    return { authenticated: true, isAdmin: true, isServiceRole: true };
  }

  // Fall back to normal admin auth check
  return await requireAdmin(req, supabaseAdmin);
}

/**
 * Escape HTML special characters to prevent injection in email templates.
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape HTML and convert newlines to <br> tags (for email templates).
 */
export function escapeHtmlWithBreaks(str: string): string {
  return escapeHtml(str).replace(/\n/g, "<br>");
}
