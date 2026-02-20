
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

/**
 * DEPRECATED: This function now proxies to enhanced-admin-notification.
 *
 * The enhanced version includes:
 *  - Dual-provider failover (Resend → Brevo)
 *  - Retry logic with exponential backoff
 *  - Better error reporting (207 on partial failure)
 *
 * All new callers should invoke 'enhanced-admin-notification' directly.
 * This proxy exists to avoid breaking any hidden callers (webhooks, triggers).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[admin-notification] DEPRECATED — proxying to enhanced-admin-notification");

  try {
    const body = await req.text();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const proxyResponse = await fetch(
      `${supabaseUrl}/functions/v1/enhanced-admin-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body,
      }
    );

    const responseBody = await proxyResponse.text();

    return new Response(responseBody, {
      status: proxyResponse.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("[admin-notification] Proxy error:", error);
    // Return 200 to not block signup, matching original behavior
    return new Response(
      JSON.stringify({ error: error.message, status: "Proxy to enhanced function failed" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
