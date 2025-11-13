import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { DealOwnerChangeEmail } from './_templates/deal-owner-change-email.tsx';

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
  companyName?: string;
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
      listingTitle,
      companyName
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

    // Use companyName passed from frontend, fallback to listingTitle
    const displayCompanyName = companyName || listingTitle || null;

    // Get modifying admin's email
    const { data: modifyingAdmin } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', modifyingAdminId)
      .single();

    const subject = `Deal Modified: ${displayCompanyName || dealTitle}`;
    
    // Render React Email template
    const htmlContent = await renderAsync(
      React.createElement(DealOwnerChangeEmail, {
        previousOwnerName,
        modifyingAdminName,
        modifyingAdminEmail: modifyingAdmin?.email,
        dealTitle,
        companyName: displayCompanyName || undefined,
        listingTitle,
        oldStageName,
        newStageName,
        dealId,
      })
    );

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
