
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// NOTE: supabase is initialized per-request now for proper auth

interface DigestRequest {
  type: 'daily' | 'weekly' | 'urgent';
  force?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: DigestRequest = await req.json();
    const correlationId = crypto.randomUUID();
    
    console.log(`[${correlationId}] Processing admin digest request:`, request);

    // Get admin statistics
    const digestData = await generateDigestData(supabase, correlationId);

    // Check if digest should be sent
    const shouldSend = request.force || await shouldSendDigest(request.type, digestData);

    if (shouldSend) {
      await sendAdminDigest(supabase, request.type, digestData, correlationId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        correlationId,
        digestSent: shouldSend,
        data: digestData 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in admin-digest function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function generateDigestData(supabase: any, correlationId: string) {
  try {
    // Get pending user approvals
    const { data: pendingUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, company, created_at, approval_status')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    // Get pending connection requests
    const { data: pendingConnections, error: connectionsError } = await supabase
      .from('connection_requests')
      .select(`
        id, 
        created_at, 
        status,
        user_message,
        listing_id,
        user_id,
        listings!inner(title, category, location),
        profiles!inner(first_name, last_name, email, company)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (connectionsError) throw connectionsError;

    // Get email delivery statistics
    const { data: emailStats, error: emailError } = await supabase
      .from('email_delivery_logs')
      .select('status, email_type, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (emailError) throw emailError;

    // Get error statistics
    const { data: errorStats, error: errorStatsError } = await supabase
      .from('error_logs')
      .select('severity, source, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (errorStatsError) throw errorStatsError;

    return {
      pendingUsers: pendingUsers || [],
      pendingConnections: pendingConnections || [],
      emailStats: emailStats || [],
      errorStats: errorStats || [],
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[${correlationId}] Error generating digest data:`, error);
    return {
      pendingUsers: [],
      pendingConnections: [],
      emailStats: [],
      errorStats: [],
      generatedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

async function shouldSendDigest(type: string, data: any): Promise<boolean> {
  // Always send if there are urgent items
  if (type === 'urgent') return true;
  
  // Send daily digest if there are pending items
  if (type === 'daily' && (data.pendingUsers.length > 0 || data.pendingConnections.length > 0)) {
    return true;
  }
  
  // Send weekly digest regardless
  if (type === 'weekly') return true;
  
  return false;
}

async function sendAdminDigest(supabase: any, type: string, data: any, correlationId: string) {
  const adminEmails = (Deno.env.get("ADMIN_NOTIFICATION_EMAILS") || "adam.haile@sourcecodeals.com")
    .split(",").map((e: string) => e.trim()).filter(Boolean);
  
  const subject = `${type.charAt(0).toUpperCase() + type.slice(1)} Admin Digest - SourceCo Marketplace`;
  
  const html = generateDigestHTML(type, data);
  const text = generateDigestText(type, data);
  
  // Send to all admin emails
  for (const adminEmail of adminEmails) {
    try {
      await supabase.functions.invoke('enhanced-email-delivery', {
        body: {
          type: 'admin_digest',
          recipientEmail: adminEmail,
          recipientName: 'Admin',
          correlationId,
          data: {
            subject,
            html,
            text
          },
          priority: type === 'urgent' ? 'high' : 'medium'
        }
      });
      
      console.log(`[${correlationId}] Admin digest sent to ${adminEmail}`);
    } catch (error) {
      console.error(`[${correlationId}] Failed to send digest to ${adminEmail}:`, error);
    }
  }
}

function generateDigestHTML(type: string, data: any): string {
  const { pendingUsers, pendingConnections, emailStats, errorStats } = data;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1>${type.charAt(0).toUpperCase() + type.slice(1)} Admin Digest</h1>
      <p><strong>Generated:</strong> ${new Date(data.generatedAt).toLocaleString()}</p>
      
      <h2>📋 Pending User Approvals (${pendingUsers.length})</h2>
      ${pendingUsers.length > 0 ? `
        <ul>
          ${pendingUsers.map(user => `
            <li>
              <strong>${user.first_name} ${user.last_name}</strong> (${user.email})
              <br>Company: ${user.company || 'N/A'}
              <br>Registered: ${new Date(user.created_at).toLocaleDateString()}
            </li>
          `).join('')}
        </ul>
      ` : '<p>No pending user approvals.</p>'}
      
      <h2>🔗 Pending Connection Requests (${pendingConnections.length})</h2>
      ${pendingConnections.length > 0 ? `
        <ul>
          ${pendingConnections.map(conn => `
            <li>
              <strong>${conn.profiles.first_name} ${conn.profiles.last_name}</strong> 
              → ${conn.listings.title}
              <br>Message: ${conn.user_message || 'No message'}
              <br>Requested: ${new Date(conn.created_at).toLocaleDateString()}
            </li>
          `).join('')}
        </ul>
      ` : '<p>No pending connection requests.</p>'}
      
      <h2>📧 Email Statistics (Last 24h)</h2>
      <p>
        Sent: ${emailStats.filter(e => e.status === 'sent').length} | 
        Failed: ${emailStats.filter(e => e.status === 'failed').length} | 
        Pending: ${emailStats.filter(e => e.status === 'pending').length}
      </p>
      
      <h2>⚠️ Error Statistics (Last 24h)</h2>
      <p>
        Critical: ${errorStats.filter(e => e.severity === 'critical').length} | 
        High: ${errorStats.filter(e => e.severity === 'high').length} | 
        Medium: ${errorStats.filter(e => e.severity === 'medium').length}
      </p>
      
      <hr>
      <p><a href="https://marketplace.sourcecodeals.com/admin">Go to Admin Dashboard</a></p>
    </div>
  `;
}

function generateDigestText(type: string, data: any): string {
  const { pendingUsers, pendingConnections, emailStats, errorStats } = data;
  
  return `
${type.charAt(0).toUpperCase() + type.slice(1)} Admin Digest
Generated: ${new Date(data.generatedAt).toLocaleString()}

PENDING USER APPROVALS (${pendingUsers.length})
${pendingUsers.length > 0 ? pendingUsers.map(user => 
  `- ${user.first_name} ${user.last_name} (${user.email}) - ${user.company || 'N/A'}`
).join('\n') : 'No pending user approvals.'}

PENDING CONNECTION REQUESTS (${pendingConnections.length})
${pendingConnections.length > 0 ? pendingConnections.map(conn => 
  `- ${conn.profiles.first_name} ${conn.profiles.last_name} → ${conn.listings.title}`
).join('\n') : 'No pending connection requests.'}

EMAIL STATISTICS (Last 24h)
Sent: ${emailStats.filter(e => e.status === 'sent').length}
Failed: ${emailStats.filter(e => e.status === 'failed').length}
Pending: ${emailStats.filter(e => e.status === 'pending').length}

ERROR STATISTICS (Last 24h)
Critical: ${errorStats.filter(e => e.severity === 'critical').length}
High: ${errorStats.filter(e => e.severity === 'high').length}
Medium: ${errorStats.filter(e => e.severity === 'medium').length}

Admin Dashboard: https://marketplace.sourcecodeals.com/admin
  `;
}

serve(handler);
