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
      dealTitle
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
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Owner Introduction Requested</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">A buyer is requesting to speak with the owner</p>
        </div>
        
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0; color: #856404; font-weight: 500;">
            Hi ${ownerName}, a qualified buyer is ready to speak with the owner of ${companyName}.
          </p>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">Buyer Details</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Name:</td>
              <td style="padding: 8px 0; color: #1e293b;">${buyerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Email:</td>
              <td style="padding: 8px 0; color: #1e293b;">${buyerEmail}</td>
            </tr>
            ${buyerCompany ? `
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Company:</td>
              <td style="padding: 8px 0; color: #1e293b;">${buyerCompany}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Deal Value:</td>
              <td style="padding: 8px 0; color: #1e293b;">${dealValueText}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">Company Details</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Listing Title:</td>
              <td style="padding: 8px 0; color: #1e293b;">${listing.title}</td>
            </tr>
            ${companyName !== listing.title ? `
            <tr>
              <td style="padding: 8px 0; color: #475569; font-weight: 500;">Real Company Name:</td>
              <td style="padding: 8px 0; color: #1e293b;">${companyName}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://marketplace.sourcecodeals.com/admin/pipeline" 
             style="background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
            View Deal in Pipeline
          </a>
        </div>

        <div style="background: #e0f2fe; padding: 16px; border-radius: 8px; border-left: 4px solid #0891b2;">
          <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 14px; font-weight: 600;">Next Steps:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px;">
            <li>Review buyer's profile in the pipeline</li>
            <li>Coordinate with the deal owner to arrange intro call</li>
            <li>Prepare the owner for the conversation</li>
          </ul>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center;">
          <p style="margin: 0;">This is an automated notification from SourceCo Marketplace</p>
          <p style="margin: 5px 0 0 0;">Deal ID: ${dealId}</p>
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
