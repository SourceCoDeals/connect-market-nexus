import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

/**
 * invite-team-member
 *
 * Creates a new team member by:
 *   1. Creating a Supabase auth user via admin API (sends magic link)
 *   2. Creating a profiles row with is_admin=true
 *   3. Assigning the specified role in user_roles table
 *
 * Input: { email, first_name, last_name, role ('admin' | 'moderator') }
 * Requires admin authentication.
 */

interface InviteRequest {
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "moderator";
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Auth check - require admin
  const auth = await requireAdmin(req, supabaseAdmin);
  if (!auth.isAdmin) {
    return new Response(
      JSON.stringify({ error: auth.error }),
      {
        status: auth.authenticated ? 403 : 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body: InviteRequest = await req.json();
    const { email, first_name, last_name, role } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["admin", "moderator"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Role must be 'admin' or 'moderator'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if auth user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === normalizedEmail
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`[invite-team-member] User ${normalizedEmail} already exists (${userId}), updating role`);
    } else {
      // Create auth user with invite (sends magic link email)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: {
          first_name: first_name || "",
          last_name: last_name || "",
          invited_as_team_member: true,
        },
      });

      if (createError) {
        console.error("[invite-team-member] Failed to create auth user:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
      console.log(`[invite-team-member] Created auth user ${normalizedEmail} (${userId})`);
    }

    // Ensure profile exists with is_admin=true
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile) {
      await supabaseAdmin
        .from("profiles")
        .update({
          is_admin: true,
          first_name: first_name || undefined,
          last_name: last_name || undefined,
          approval_status: "approved",
          email_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } else {
      await supabaseAdmin.from("profiles").insert({
        id: userId,
        email: normalizedEmail,
        first_name: first_name || "",
        last_name: last_name || "",
        is_admin: true,
        approval_status: "approved",
        email_verified: true,
      });
    }

    // Assign role in user_roles table
    // Delete existing role first
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: role,
      granted_by: auth.userId,
      reason: `Invited as ${role === "admin" ? "Admin" : "Team Member"}`,
    });

    if (roleError) {
      console.error("[invite-team-member] Failed to assign role:", roleError);
    }

    // Log to audit
    await supabaseAdmin.from("permission_audit_log").insert({
      target_user_id: userId,
      changed_by: auth.userId,
      old_role: null,
      new_role: role,
      reason: `Invited as ${role === "admin" ? "Admin" : "Team Member"}`,
    });

    // Send magic link for login
    if (!existingUser) {
      const { error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
        options: {
          redirectTo: `${Deno.env.get("SITE_URL") || "https://marketplace.sourcecodeals.com"}/admin`,
        },
      });

      if (magicLinkError) {
        console.error("[invite-team-member] Magic link error:", magicLinkError);
        // Non-fatal - user can still use forgot password flow
      }
    }

    console.log(`[invite-team-member] Successfully invited ${normalizedEmail} as ${role}`);

    return new Response(
      JSON.stringify({
        user_id: userId,
        email: normalizedEmail,
        role,
        is_new_user: !existingUser,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[invite-team-member] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
