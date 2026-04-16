import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAdmin, escapeHtml } from '../_shared/auth.ts';
import { sendEmail } from '../_shared/email-sender.ts';
import { wrapEmailHtml } from '../_shared/email-template-wrapper.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DataRecoveryEmailRequest {
  userIds: string[];
  template: string;
}

const PROFILE_LINK = 'https://marketplace.sourcecodeals.com/profile';

// Mirror the per-buyer-type required-field map from DataRecoveryTab.tsx so we
// can populate {{missingFields}} server-side without trusting client input.
const FIELDS_BY_TYPE: Record<string, string[]> = {
  corporate: ['estimated_revenue'],
  privateEquity: ['fund_size', 'investment_size'],
  familyOffice: ['fund_size', 'aum'],
  searchFund: ['is_funded', 'target_company_size'],
  individual: ['funding_source', 'needs_loan', 'ideal_target'],
  independentSponsor: [
    'investment_size',
    'geographic_focus',
    'industry_expertise',
    'deal_structure_preference',
  ],
};

const ALL_RECOVERY_FIELDS = Array.from(new Set(Object.values(FIELDS_BY_TYPE).flat()));

function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeMissingFields(user: Record<string, unknown>): string[] {
  const buyerType = typeof user.buyer_type === 'string' ? user.buyer_type : '';
  const required = FIELDS_BY_TYPE[buyerType] ?? [];
  return required.filter((f) => {
    const v = user[f];
    return v === null || v === undefined || v === '';
  });
}

// Interpolate {{placeholder}} tokens into a template. We escape the template
// first (so any HTML an admin typed is displayed as text, not rendered), then
// substitute each placeholder with its HTML-escaped value. Placeholder tokens
// contain only `{}` and alphanumerics so they survive the initial escape
// unchanged.
function renderTemplate(template: string, values: Record<string, string>): string {
  let out = escapeHtml(template);
  for (const [key, value] of Object.entries(values)) {
    const token = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    out = out.replace(token, escapeHtml(value));
  }
  return out;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);

  try {
    const auth = await requireAdmin(req, supabase);
    if (!auth.isAdmin) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.authenticated ? 403 : 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { userIds, template }: DataRecoveryEmailRequest = await req.json();

    // Select every field we might need to evaluate "missing" per buyer_type, so
    // {{missingFields}} resolves correctly for each user.
    const profileCols = [
      'id',
      'email',
      'first_name',
      'last_name',
      'buyer_type',
      ...ALL_RECOVERY_FIELDS,
    ]
      .filter((c, i, a) => a.indexOf(c) === i)
      .join(', ');

    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(profileCols)
      .in('id', userIds);

    if (usersError) throw new Error('Failed to fetch user data');
    if (!users || users.length === 0) throw new Error('No users found for the provided IDs');

    const emailPromises = users.map(async (user: Record<string, unknown>) => {
      const email = user.email as string;
      const firstName = (user.first_name as string | null) || '';
      const lastName = (user.last_name as string | null) || '';
      const buyerType = (user.buyer_type as string | null) || '';
      const missingFields = computeMissingFields(user).map(formatFieldName);

      const bodyHtml = renderTemplate(template, {
        firstName: firstName || 'there',
        buyerType: buyerType ? formatFieldName(buyerType) : 'buyer',
        missingFields: missingFields.length ? missingFields.join(', ') : 'several profile fields',
        profileLink: PROFILE_LINK,
      });

      try {
        const result = await sendEmail({
          templateName: 'data_recovery',
          to: email,
          toName: `${firstName} ${lastName}`.trim() || email,
          subject: 'Complete Your Profile - Missing Information',
          htmlContent: wrapEmailHtml({
            bodyHtml: `
              <p>Hi ${escapeHtml(firstName || 'there')},</p>
              <p>Some important information is missing from your profile. Please take a moment to complete it so we can match you with relevant deals.</p>
              ${bodyHtml}
              <div style="text-align: center; margin: 28px 0;">
                <a href="${PROFILE_LINK}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">Complete Profile</a>
              </div>
              <p style="color: #6B6B6B;">The SourceCo Team</p>`,
            preheader: 'Complete your SourceCo profile',
            recipientEmail: email,
          }),
          senderName: 'SourceCo',
          isTransactional: true,
        });

        if (!result.success) throw new Error(result.error || 'Failed to send');
        return { userId: user.id, email, status: 'sent' };
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        return {
          userId: user.id,
          email,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.status === 'sent').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    return new Response(
      JSON.stringify({
        success: true,
        totalEmails: userIds.length,
        successCount,
        failedCount,
        results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  } catch (error: unknown) {
    console.error('Error in send-data-recovery-email function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
};

serve(handler);
