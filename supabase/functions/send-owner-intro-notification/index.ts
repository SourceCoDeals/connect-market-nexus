import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OwnerIntroRequest {
  dealId: string;
  listingId: string;
  buyerName: string;
  buyerEmail: string;
  buyerCompany?: string;
  dealValue?: number;
  dealTitle: string;
  dealOwnerName?: string;
  dealOwnerEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      dealId,
      listingId,
      buyerName,
      buyerEmail,
      buyerCompany,
      dealValue,
      dealTitle,
      dealOwnerName,
      dealOwnerEmail
    }: OwnerIntroRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get listing with primary owner
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        id,
        title,
        internal_company_name,
        primary_owner_id,
        primary_owner:profiles!primary_owner_id (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      throw new Error(`Listing not found: ${listingId}`);
    }

    if (!listing.primary_owner_id || !listing.primary_owner) {
      console.log('No primary owner assigned to listing, skipping notification');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No primary owner assigned' 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const primaryOwner = listing.primary_owner;
    const ownerName = `${primaryOwner.first_name} ${primaryOwner.last_name}`.trim();
    const companyName = listing.internal_company_name || listing.title;

    // Format deal value
    const dealValueText = dealValue 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(dealValue)
      : 'Not specified';

    const subject = `🤝 Owner Intro Requested: ${buyerName} → ${companyName}`;
    
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; border-radius: 8px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.8px; color: #94a3b8; margin: 0 0 8px 0; text-transform: uppercase;">SOURCECO PIPELINE</div>
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; line-height: 1.3;">Owner Introduction Requested</h1>
          <p style="color: #cbd5e1; font-size: 14px; margin: 8px 0 0 0;">A qualified buyer is ready to speak with the owner</p>
        </div>
        
        <!-- Alert Box -->
        <div style="background: #fffbeb; border-left: 4px solid #d7b65c; padding: 16px 20px; border-radius: 4px; margin-bottom: 24px;">
          <p style="margin: 0; color: #78350f; font-weight: 500; font-size: 14px;">
            Hi ${ownerName}, ${buyerName} from ${buyerCompany || 'a qualified firm'} is ready to speak with the owner of ${companyName}.
          </p>
        </div>

        <!-- Buyer Information -->
        <div style="background: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
          <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px; font-weight: 700;">Buyer Information</h2>
          
          <table style="width: 100%; margin-bottom: 12px;">
            <tr>
              <td style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 16px; vertical-align: top; width: 120px;">Name</td>
              <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${buyerName}</td>
            </tr>
          </table>

          <table style="width: 100%; margin-bottom: 12px;">
            <tr>
              <td style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 16px; vertical-align: top; width: 120px;">Email</td>
              <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${buyerEmail}</td>
            </tr>
          </table>

          ${buyerCompany ? `
          <table style="width: 100%; margin-bottom: 12px;">
            <tr>
              <td style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 16px; vertical-align: top; width: 120px;">Company</td>
              <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${buyerCompany}</td>
            </tr>
          </table>
          ` : ''}

          <table style="width: 100%; margin-bottom: 12px;">
            <tr>
              <td style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 16px; vertical-align: top; width: 120px;">Deal Value</td>
              <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${dealValueText}</td>
            </tr>
          </table>
        </div>

        <!-- Company Information -->
        <div style="background: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
          <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px; font-weight: 700;">Company Details</h2>
          
          <table style="width: 100%; margin-bottom: 12px;">
            <tr>
              <td style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 16px; vertical-align: top; width: 120px;">Listing Title</td>
              <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${listing.title}</td>
            </tr>
          </table>

          ${companyName !== listing.title ? `
          <table style="width: 100%; margin-bottom: 12px;">
            <tr>
              <td style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 16px; vertical-align: top; width: 120px;">Real Company Name</td>
              <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${companyName}</td>
            </tr>
          </table>
          ` : ''}

          ${dealOwnerName ? `
          <table style="width: 100%; margin-bottom: 12px;">
            <tr>
              <td style="color: #64748b; font-size: 13px; font-weight: 500; padding-right: 16px; vertical-align: top; width: 120px;">Deal Owner</td>
              <td style="color: #0f172a; font-size: 14px; font-weight: 600;">
                ${dealOwnerName}
                ${dealOwnerEmail ? `<span style="color: #64748b; font-weight: 400;"> • ${dealOwnerEmail}</span>` : ''}
              </td>
            </tr>
          </table>
          ` : ''}
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="https://marketplace.sourcecodeals.com/admin/pipeline?deal=${dealId}" 
             style="background-color: #d7b65c; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 12px 32px; border-radius: 6px;">
            View Deal in Pipeline
          </a>
        </div>

        <!-- Next Steps -->
        <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #fde68a;">
          <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 700;">Next Steps:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 13px; line-height: 1.6;">
            <li>Review buyer's profile in the pipeline</li>
            <li>Coordinate with ${dealOwnerName || 'the deal owner'} to arrange intro call</li>
            <li>Prepare the owner for the conversation</li>
          </ul>
        </div>

        <!-- Footer -->
        <div style="color: #94a3b8; font-size: 12px; line-height: 20px; text-align: center; margin-top: 24px;">
          This is an automated notification from SourceCo Pipeline
          <br />
          <span style="color: #cbd5e1; font-size: 11px;">Deal ID: ${dealId}</span>
        </div>
      </div>
    `;

    // Send email via Brevo
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY is not set");
    }
    
    console.log("Sending owner intro notification to:", primaryOwner.email);
    
    const emailPayload = {
      sender: { name: "SourceCo Notifications", email: "notifications@sourcecodeals.com" },
      to: [{ email: primaryOwner.email, name: ownerName }],
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
    console.log("Email sent successfully:", emailResult);

    // Log to database
    await supabase
      .from('owner_intro_notifications')
      .insert({
        deal_id: dealId,
        listing_id: listingId,
        primary_owner_id: listing.primary_owner_id,
        email_status: 'sent',
        metadata: {
          message_id: emailResult.messageId,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          email_subject: subject,
        }
      });
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message_id: emailResult.messageId,
        recipient: primaryOwner.email
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in send-owner-intro-notification:", error);
    
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
