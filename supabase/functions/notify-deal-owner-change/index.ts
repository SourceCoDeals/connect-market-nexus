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

    // Get deal with listing details to show real company name
    const { data: dealData } = await supabase
      .from('deals')
      .select(`
        id,
        title,
        listing:listings(
          title,
          internal_company_name
        )
      `)
      .eq('id', dealId)
      .single();

    const companyName = dealData?.listing?.internal_company_name || listingTitle || dealData?.listing?.title || 'Unknown Company';

    // Get modifying admin's email
    const { data: modifyingAdmin, error: adminError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', modifyingAdminId)
      .single();

    const subject = `🔔 Deal Update: ${modifyingAdminName} modified your deal`;
    
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
        <!-- SourceCo Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 32px 24px; border-radius: 8px; margin-bottom: 24px;">
          <div style="font-size: 13px; font-weight: 600; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px;">SOURCECO PIPELINE</div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; line-height: 1.3;">Deal Modified by Another Admin</h1>
          <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 14px;">FYI: A deal you own has been updated</p>
        </div>
        
        <!-- Alert Box -->
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 4px; margin-bottom: 24px;">
          <p style="margin: 0; color: #1e40af; font-weight: 500; font-size: 14px;">
            Hi ${previousOwnerName}, ${modifyingAdminName} has made changes to a deal you own.
          </p>
        </div>

        <!-- Deal Information Card -->
        <div style="background: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
          <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 16px; font-weight: 700;">Deal Information</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: #64748b; font-weight: 600; font-size: 13px; width: 140px;">Company:</td>
              <td style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${companyName}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b; font-weight: 600; font-size: 13px;">Contact:</td>
              <td style="padding: 12px 0; color: #0f172a; font-size: 14px;">${dealTitle}</td>
            </tr>
            ${listingTitle && listingTitle !== companyName ? `
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b; font-weight: 600; font-size: 13px;">Listing:</td>
              <td style="padding: 12px 0; color: #0f172a; font-size: 14px;">${listingTitle}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b; font-weight: 600; font-size: 13px;">Modified By:</td>
              <td style="padding: 12px 0; color: #0f172a; font-size: 14px;">${modifyingAdminName} ${modifyingAdmin ? `<span style="color: #64748b;">(${modifyingAdmin.email})</span>` : ''}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b; font-weight: 600; font-size: 13px;">Stage Change:</td>
              <td style="padding: 12px 0; color: #0f172a; font-size: 14px;">
                <span style="background: #e2e8f0; padding: 6px 12px; border-radius: 6px; margin-right: 6px; font-weight: 500; font-size: 13px;">${oldStageName}</span>
                <span style="color: #64748b;">→</span>
                <span style="background: #dbeafe; color: #1e40af; padding: 6px 12px; border-radius: 6px; margin-left: 6px; font-weight: 600; font-size: 13px;">${newStageName}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://marketplace.sourcecodeals.com/admin/pipeline?deal=${dealId}" 
             style="background: #3b82f6; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
            View Deal Details →
          </a>
        </div>

        <!-- Info Box -->
        <div style="background: #fffbeb; padding: 16px 20px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 13px; font-weight: 700;">Why am I getting this?</h3>
          <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.6;">
            You're assigned as the owner of this deal. When another admin makes changes, we notify you to keep everyone in sync. 
            This is expected behavior and doesn't require any action unless you want to review the changes.
          </p>
        </div>

        <!-- Footer -->
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px; font-weight: 500;">This is an automated notification from SourceCo Pipeline</p>
          <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 11px;">Deal ID: ${dealId}</p>
        </div>
      </div>
    `;
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
      sender: { name: "SourceCo Notifications", email: "notifications@sourcecodeals.com" },
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
