
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface UserJourneyEvent {
  event_type: 'user_created' | 'email_verified' | 'profile_approved' | 'profile_rejected' | 'reminder_due';
  user_id: string;
  user_email: string;
  user_name: string;
  metadata?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const event: UserJourneyEvent = await req.json();
    const correlationId = crypto.randomUUID();
    
    console.log(`[${correlationId}] Processing user journey event:`, {
      event_type: event.event_type,
      user_id: event.user_id,
      user_email: event.user_email
    });

    // Process the event and send appropriate notifications
    await processUserJourneyEvent(event, correlationId);

    // Log the event for analytics (optional - we'll skip this for now to avoid table creation)
    // await logUserJourneyEvent(event, correlationId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        correlationId,
        message: 'User journey event processed successfully' 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in user-journey-notifications function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function processUserJourneyEvent(event: UserJourneyEvent, correlationId: string) {
  const { event_type, user_email, user_name } = event;
  
  let emailType: string;
  let emailData: Record<string, any> = {};
  
  switch (event_type) {
    case 'user_created':
      emailType = 'welcome';
      emailData = {
        loginUrl: 'https://marketplace.sourcecodeals.com/login'
      };
      break;
      
    case 'email_verified':
      // Send confirmation that email is verified and account is under review
      emailType = 'email_verified';
      emailData = {
        message: 'email_verified'
      };
      break;
      
    case 'profile_approved':
      emailType = 'approval';
      emailData = {
        loginUrl: 'https://marketplace.sourcecodeals.com/login'
      };
      break;
      
    case 'profile_rejected':
      emailType = 'rejection';
      emailData = {
        rejectionReason: event.metadata?.rejection_reason || 'Application did not meet our criteria'
      };
      break;
      
    case 'reminder_due':
      // Don't send reminder emails - users can't speed up approval process
      console.log(`[${correlationId}] Skipping reminder email - users pending approval can't speed up the process`);
      return;
      
    default:
      console.log(`[${correlationId}] Unknown event type: ${event_type}`);
      return;
  }
  
  // Send the email via enhanced email delivery system
  try {
    await supabase.functions.invoke('enhanced-email-delivery', {
      body: {
        type: emailType,
        recipientEmail: user_email,
        recipientName: user_name,
        correlationId,
        data: emailData,
        priority: event_type === 'profile_approved' ? 'high' : 'medium'
      }
    });
    
    console.log(`[${correlationId}] Email notification sent for ${event_type}`);
  } catch (error) {
    console.error(`[${correlationId}] Failed to send email for ${event_type}:`, error);
  }
}

serve(handler);
