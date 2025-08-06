
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface EmailDeliveryRequest {
  type: 'welcome' | 'approval' | 'rejection' | 'password_reset' | 'connection_status' | 'email_verified';
  recipientEmail: string;
  recipientName: string;
  correlationId?: string;
  data?: Record<string, any>;
  priority?: 'high' | 'medium' | 'low';
  retryCount?: number;
  maxRetries?: number;
}

interface EmailDeliveryLog {
  id: string;
  email: string;
  email_type: string;
  status: 'pending' | 'sent' | 'failed' | 'retry';
  retry_count: number;
  max_retries: number;
  correlation_id: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailRequest: EmailDeliveryRequest = await req.json();
    const correlationId = emailRequest.correlationId || crypto.randomUUID();
    
    console.log(`[${correlationId}] Processing email delivery request:`, {
      type: emailRequest.type,
      recipient: emailRequest.recipientEmail,
      priority: emailRequest.priority || 'medium'
    });

    // Create email delivery log entry
    const deliveryLog: Partial<EmailDeliveryLog> = {
      email: emailRequest.recipientEmail,
      email_type: emailRequest.type,
      status: 'pending',
      retry_count: emailRequest.retryCount || 0,
      max_retries: emailRequest.maxRetries || 3,
      correlation_id: correlationId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Log email attempt
    const { data: logEntry, error: logError } = await supabase
      .from('email_delivery_logs')
      .insert(deliveryLog)
      .select()
      .single();

    if (logError) {
      console.error(`[${correlationId}] Failed to create delivery log:`, logError);
    }

    // Attempt email delivery with exponential backoff
    const success = await attemptEmailDelivery(emailRequest, correlationId);

    // Update delivery log
    if (logEntry) {
      await supabase
        .from('email_delivery_logs')
        .update({
          status: success ? 'sent' : 'failed',
          sent_at: success ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
    }

    if (success) {
      console.log(`[${correlationId}] Email sent successfully`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          correlationId,
          message: 'Email sent successfully' 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      // Schedule retry if within retry limits
      const retryCount = emailRequest.retryCount || 0;
      const maxRetries = emailRequest.maxRetries || 3;
      
      if (retryCount < maxRetries) {
        await scheduleEmailRetry(emailRequest, correlationId);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          correlationId,
          message: 'Email delivery failed, retry scheduled' 
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

  } catch (error: any) {
    console.error("Error in enhanced-email-delivery function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function attemptEmailDelivery(
  emailRequest: EmailDeliveryRequest, 
  correlationId: string
): Promise<boolean> {
  const { type, recipientEmail, recipientName, data } = emailRequest;
  
  // Generate email content based on type
  const emailContent = generateEmailContent(type, recipientName, data);
  
  // Try multiple email providers with fallback
  const providers = ['brevo', 'resend'];
  
  for (const provider of providers) {
    try {
      const success = await sendViaProvider(provider, recipientEmail, emailContent, correlationId);
      if (success) {
        return true;
      }
    } catch (error) {
      console.error(`[${correlationId}] ${provider} failed:`, error);
    }
  }
  
  return false;
}

async function sendViaProvider(
  provider: string, 
  email: string, 
  content: any, 
  correlationId: string
): Promise<boolean> {
  if (provider === 'brevo') {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) return false;
    
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "SourceCo Marketplace",
          email: "adam.haile@sourcecodeals.com"
        },
        to: [{ email, name: email.split('@')[0] }],
        subject: content.subject,
        htmlContent: content.html,
        textContent: content.text
      }),
    });
    
    return response.ok;
  }
  
  if (provider === 'resend') {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return false;
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SourceCo Marketplace <adam.haile@sourcecodeals.com>",
        to: [email],
        subject: content.subject,
        html: content.html,
        text: content.text
      }),
    });
    
    return response.ok;
  }
  
  return false;
}

function generateEmailContent(type: string, recipientName: string, data?: Record<string, any>) {
  const firstName = recipientName.split(' ')[0];
  
  switch (type) {
    case 'welcome':
      return {
        subject: '🎉 Welcome to SourceCo Marketplace!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Welcome to SourceCo Marketplace, ${firstName}!</h2>
            <p>Thank you for joining our curated marketplace for founder-led businesses. Your account has been created successfully.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
              <h3 style="color: #1e40af; margin: 0 0 15px 0;">🏪 How SourceCo Marketplace Works</h3>
              
              <div style="margin: 15px 0;">
                <h4 style="color: #374151; margin: 0 0 8px 0; display: flex; align-items: center;">
                  <span style="background: #3b82f6; color: white; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">🔍</span>
                  Browse Premium Listings
                </h4>
                <p style="color: #6b7280; margin: 0 0 15px 34px;">Explore verified businesses with real financials and genuine seller intent. Every listing is curated and vetted.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <h4 style="color: #374151; margin: 0 0 8px 0; display: flex; align-items: center;">
                  <span style="background: #3b82f6; color: white; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">🤝</span>
                  Request Connections
                </h4>
                <p style="color: #6b7280; margin: 0 0 15px 34px;">Connect directly with sellers when you find opportunities that match your criteria. No platform fees or exclusivity required.</p>
              </div>
              
              <div style="margin: 15px 0;">
                <h4 style="color: #374151; margin: 0 0 8px 0; display: flex; align-items: center;">
                  <span style="background: #3b82f6; color: white; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">💬</span>
                  Get Support Anytime
                </h4>
                <p style="color: #6b7280; margin: 0 0 0 34px;">Use our feedback widget on any page if you need help or have questions about the process.</p>
              </div>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
              <h4 style="color: #92400e; margin: 0 0 10px 0;">🔒 Our Approach</h4>
              <ul style="color: #78350f; margin: 0; padding-left: 20px;">
                <li>Success-based pricing - you only pay when deals close</li>
                <li>Curated, selective access - quality over quantity</li>
                <li>Direct seller connections - no intermediaries</li>
                <li>Weekly new listings from real sellers, not scraped data</li>
              </ul>
            </div>
            
            <p><strong>Next Steps:</strong> Your account is currently under review and will be approved within 1-2 business days. You'll receive another email once approved.</p>
            <p>Best regards,<br>The SourceCo Team</p>
          </div>
        `,
        text: `Welcome to SourceCo Marketplace, ${firstName}!\n\nThank you for joining our curated marketplace for founder-led businesses. Your account has been created successfully.\n\nHow SourceCo Marketplace Works:\n\n🔍 Browse Premium Listings\nExplore verified businesses with real financials and genuine seller intent. Every listing is curated and vetted.\n\n🤝 Request Connections\nConnect directly with sellers when you find opportunities that match your criteria. No platform fees or exclusivity required.\n\n💬 Get Support Anytime\nUse our feedback widget on any page if you need help or have questions about the process.\n\nOur Approach:\n- Success-based pricing - you only pay when deals close\n- Curated, selective access - quality over quantity\n- Direct seller connections - no intermediaries\n- Weekly new listings from real sellers, not scraped data\n\nNext Steps: Your account is currently under review and will be approved within 1-2 business days. You'll receive another email once approved.\n\nBest regards,\nThe SourceCo Team`
      };
      
    case 'approval':
      return {
        subject: '🎉 Your SourceCo Marketplace Account Has Been Approved!',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 0;">
              <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Welcome to SourceCo</h1>
              <p style="margin: 12px 0 0 0; opacity: 0.9; font-size: 18px; font-weight: 300;">Your account has been approved</p>
            </div>
            
            <!-- Main Content -->
            <div style="background: white; padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 35px;">
                <h2 style="color: #1e293b; margin: 0 0 12px 0; font-size: 24px; font-weight: 600;">Congratulations, ${firstName}!</h2>
                <p style="color: #64748b; margin: 0; font-size: 16px; line-height: 1.6;">
                  You now have exclusive access to our curated marketplace of founder-led businesses. Start exploring premium opportunities today.
                </p>
              </div>
              
              <!-- Premium Features -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 12px; padding: 30px; margin: 30px 0; border: 1px solid #d1fae5;">
                <h3 style="color: #059669; margin: 0 0 25px 0; font-size: 20px; font-weight: 600; text-align: center;">
                  ⚡ Your Premium Access Includes
                </h3>
                
                <div style="display: grid; gap: 20px;">
                  <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <div style="background: #10b981; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0;">1</div>
                    <div>
                      <h4 style="color: #1e293b; margin: 0 0 6px 0; font-size: 16px; font-weight: 600;">Verified Data Rooms</h4>
                      <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">Access detailed financials, growth metrics, and comprehensive business documentation for every listing.</p>
                    </div>
                  </div>
                  
                  <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <div style="background: #10b981; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0;">2</div>
                    <div>
                      <h4 style="color: #1e293b; margin: 0 0 6px 0; font-size: 16px; font-weight: 600;">Direct Seller Connections</h4>
                      <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">Connect directly with business owners when you find opportunities that match your investment criteria.</p>
                    </div>
                  </div>
                  
                  <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <div style="background: #10b981; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0;">3</div>
                    <div>
                      <h4 style="color: #1e293b; margin: 0 0 6px 0; font-size: 16px; font-weight: 600;">Personalized Dashboard</h4>
                      <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">Save interested listings, track your connection requests, and manage your acquisition pipeline.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Exclusive Benefits -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fef7cd 100%); border-radius: 12px; padding: 25px; margin: 30px 0; border: 1px solid #fde68a;">
                <h4 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 20px;">👑</span> Exclusive Member Benefits
                </h4>
                <ul style="color: #78350f; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                  <li style="margin-bottom: 8px;">Success-based pricing - only pay when deals close</li>
                  <li style="margin-bottom: 8px;">Weekly curated deals from verified sellers</li>
                  <li style="margin-bottom: 0;">Dedicated support from our team</li>
                </ul>
              </div>
              
              <!-- Call to Action -->
              <div style="text-align: center; margin: 40px 0 30px 0;">
                <a href="${data?.loginUrl || 'https://marketplace.sourcecodeals.com/login'}" 
                   style="display: inline-block; 
                          background: linear-gradient(135deg, #1e293b 0%, #334155 100%); 
                          color: white; 
                          padding: 18px 36px; 
                          text-decoration: none; 
                          border-radius: 12px; 
                          font-weight: 700; 
                          font-size: 16px;
                          box-shadow: 0 8px 25px rgba(30, 41, 59, 0.3);
                          transition: all 0.3s ease;">
                  🚀 EXPLORE MARKETPLACE
                </a>
                <p style="margin: 15px 0 0 0; color: #64748b; font-size: 13px;">Click above to access your premium dashboard</p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f1f5f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px;">
                Questions? I'm here to help personally.
              </p>
              <p style="margin: 0; color: #64748b; font-size: 13px;">
                Best regards,<br>
                <strong style="color: #1e293b;">Adam Haile</strong><br>
                <a href="mailto:adam.haile@sourcecodeals.com" style="color: #059669; text-decoration: none;">adam.haile@sourcecodeals.com</a>
              </p>
            </div>
          </div>
        `,
        text: `🎉 Congratulations, ${firstName}!\n\nYour SourceCo Marketplace account has been approved! You now have exclusive access to our curated marketplace of founder-led businesses.\n\nYour Premium Access Includes:\n\n1. Verified Data Rooms\nAccess detailed financials, growth metrics, and comprehensive business documentation for every listing.\n\n2. Direct Seller Connections\nConnect directly with business owners when you find opportunities that match your investment criteria.\n\n3. Personalized Dashboard\nSave interested listings, track your connection requests, and manage your acquisition pipeline.\n\nExclusive Member Benefits:\n- Success-based pricing - only pay when deals close\n- Weekly curated deals from verified sellers  \n- Dedicated support from our team\n\nAccess your premium dashboard: ${data?.loginUrl || 'https://marketplace.sourcecodeals.com/login'}\n\nQuestions? I'm here to help personally.\n\nBest regards,\nAdam Haile\nadam.haile@sourcecodeals.com`
      };
      
    case 'email_verified':
      return {
        subject: '✅ Email Verified - Application Under Review',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #10b981; margin: 0; font-size: 24px;">✅ Email Verified Successfully!</h1>
              </div>
              
              <h2 style="color: #333; margin-top: 0;">Hi ${firstName},</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                Great news! Your email address has been successfully verified for your SourceCo Marketplace account.
              </p>
              
              <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0;">
                <h3 style="color: #1e40af; margin: 0 0 10px 0;">📋 What happens next?</h3>
                <ul style="color: #374151; margin: 0; padding-left: 20px;">
                  <li>Your application is now under review by our team</li>
                  <li>We'll evaluate your profile and approve it within a few hours</li>
                  <li>Once approved, you'll receive another email with access instructions</li>
                  <li>You'll then be able to browse listings and request owner conversations</li>
                </ul>
              </div>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0;">
                <h3 style="color: #92400e; margin: 0 0 10px 0;">⏰ Timeline</h3>
                <p style="color: #78350f; margin: 0; font-weight: 500;">
                  Most applications are reviewed and approved within 2-4 hours during business hours.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  We're excited to have you join our marketplace community!
                </p>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  If you have any questions, please don't hesitate to contact our support team.
                </p>
                <p style="color: #374151; font-weight: 600; margin: 10px 0 0 0;">
                  The SourceCo Team
                </p>
              </div>
            </div>
          </div>
        `,
        text: `✅ Email Verified Successfully!\n\nHi ${firstName},\n\nGreat news! Your email address has been successfully verified for your SourceCo Marketplace account.\n\nWhat happens next?\n- Your application is now under review by our team\n- We'll evaluate your profile and approve it within a few hours\n- Once approved, you'll receive another email with access instructions\n- You'll then be able to browse listings and request owner conversations\n\nTimeline: Most applications are reviewed and approved within 2-4 hours during business hours.\n\nWe're excited to have you join our marketplace community!\n\nIf you have any questions, please don't hesitate to contact our support team.\n\nThe SourceCo Team`
      };
      
    default:
      return {
        subject: 'SourceCo Marketplace Notification',
        html: `<p>Hello ${firstName},</p><p>You have a new notification from SourceCo Marketplace.</p>`,
        text: `Hello ${firstName},\n\nYou have a new notification from SourceCo Marketplace.`
      };
  }
}

async function scheduleEmailRetry(emailRequest: EmailDeliveryRequest, correlationId: string) {
  const retryCount = (emailRequest.retryCount || 0) + 1;
  const delayMs = Math.pow(2, retryCount) * 1000; // Exponential backoff
  
  console.log(`[${correlationId}] Scheduling retry ${retryCount} in ${delayMs}ms`);
  
  // In a production environment, you would use a proper job queue
  // For now, we'll use a simple setTimeout approach
  setTimeout(async () => {
    try {
      await supabase.functions.invoke('enhanced-email-delivery', {
        body: {
          ...emailRequest,
          retryCount,
          correlationId
        }
      });
    } catch (error) {
      console.error(`[${correlationId}] Retry failed:`, error);
    }
  }, delayMs);
}

serve(handler);
