import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DealOwnerChangeRequest {
  dealId: string;
  dealTitle: string;
  previousOwnerId: string;
  previousOwnerName: string;
  modifyingAdminId: string;
  modifyingAdminName: string;
  oldStageName: string;
  newStageName: string;
  listingTitle?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      dealId,
      dealTitle,
      previousOwnerId,
      previousOwnerName,
      modifyingAdminId,
      modifyingAdminName,
      oldStageName,
      newStageName,
      listingTitle
    }: DealOwnerChangeRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get previous owner's email
    const { data: previousOwner, error: ownerError } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', previousOwnerId)
      .single();

    if (ownerError || !previousOwner) {
      console.error('Previous owner not found:', previousOwnerId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Previous owner not found' 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get modifying admin's email
    const { data: modifyingAdmin, error: adminError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', modifyingAdminId)
      .single();

    const subject = `🔔 Deal Update: ${modifyingAdminName} modified your deal`;
    
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Deal Modified by Another Admin</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">FYI: A deal you own has been updated</p>
        </div>
        
        <div style="background: #e0f2fe; border-left: 4px solid #0284c7; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0; color: #0c4a6e; font-weight: 500;">
            Hi ${previousOwnerName}, ${modifyingAdminName} has made changes to a deal you own.
          </p>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">Deal Information</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Deal Title:</td>
              <td style="padding: 8px 0; color: #1e293b;">${dealTitle}</td>
            </tr>
            ${listingTitle ? `
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Listing:</td>
              <td style="padding: 8px 0; color: #1e293b;">${listingTitle}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Modified By:</td>
              <td style="padding: 8px 0; color: #1e293b;">${modifyingAdminName} ${modifyingAdmin ? `(${modifyingAdmin.email})` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Stage Change:</td>
              <td style="padding: 8px 0; color: #1e293b;">
                <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; margin-right: 4px;">${oldStageName}</span>
                →
                <span style="background: #dbeafe; padding: 4px 8px; border-radius: 4px; margin-left: 4px;">${newStageName}</span>
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://marketplace.sourcecodeals.com/admin/pipeline" 
             style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
            View Deal in Pipeline
          </a>
        </div>

        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 14px; font-weight: 600;">Why am I getting this?</h3>
          <p style="margin: 0; color: #78350f; font-size: 14px;">
            You're assigned as the owner of this deal. When another admin makes changes, we notify you to keep everyone in sync. 
            This is expected behavior and doesn't require any action unless you want to review the changes.
          </p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center;">
          <p style="margin: 0;">This is an automated notification from SourceCo Pipeline</p>
          <p style="margin: 5px 0 0 0;">Deal ID: ${dealId}</p>
        </div>
      </div>
    `;

    // Send email via Brevo
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY is not set");
    }
    
    console.log("Sending deal owner change notification to:", previousOwner.email);
    
    const emailPayload = {
      sender: { name: "SourceCo Pipeline", email: "pipeline@sourcecodeals.com" },
      to: [{ email: previousOwner.email, name: previousOwnerName }],
      subject: subject,
      htmlContent: htmlContent,
    };

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("Deal owner notification sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ 
        success: true,
        message_id: emailResult.messageId,
        recipient: previousOwner.email
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in notify-deal-owner-change:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
