/**
 * Client-side mirror of `send-match-tool-lead-outreach`'s buildEmailContent().
 * Used to render the in-dialog preview that matches what's actually sent.
 * Keep in sync with supabase/functions/send-match-tool-lead-outreach/index.ts
 *
 * Voice rules (same as valuation):
 * - Open with an observation, never a greeting+filler combo
 * - Use contractions
 * - No CTAs in the intro
 * - Bare first-name signature
 * - Banned punctuation: em-dash and en-dash. Use commas, periods, or "to".
 */

import {
  pickTopHook,
  industryShortLabel,
  extractFoundedYear,
  hashedVariant,
  bucketToRevenue,
  bucketToProfit,
  type HookKind,
  type HookCandidate,
} from './match-tool-outreach-hooks';

export type MatchToolOutreachTemplateKind = 'intro' | 'followup' | 'custom';

export interface MatchToolOutreachEmailParams {
  templateKind: MatchToolOutreachTemplateKind;
  leadId: string;
  firstName: string;
  businessName: string;
  senderName: string;
  senderTitle?: string;
  revenueBucket?: string | null;
  profitBucket?: string | null;
  qualityTier?: string | null;
  industry?: string | null;
  timeline?: string | null;
  enrichmentData?: Record<string, unknown> | null;
}

export interface MatchToolOutreachEmailContent {
  subject: string;
  htmlContent: string;
  textContent: string;
  hook?: HookCandidate;
}

// --- Formatters ---
function fmtCurrency(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n <= 0) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function tierBand(tier: string | null | undefined): string {
  if (!tier) return 'mid';
  const t = tier.toLowerCase();
  if (t.includes('high') || t === 'a' || t.includes('premium')) return 'top';
  if (t.includes('low') || t === 'c' || t === 'd') return 'value';
  return 'mid';
}

export function tierInsight(tier: string | null | undefined): string {
  switch (tierBand(tier)) {
    case 'top':
      return 'owner-independence and recurring-revenue mix';
    case 'value':
      return 'EBITDA margin trend and how clean your add-backs are';
    default:
      return 'documented financials and customer concentration';
  }
}

function firstNameOnly(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || name || '';
}

function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${htmlEscape(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

export function wrapHtml(inner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#222;">
${inner}
</body>
</html>`;
}

// --- Per-lead micro-variance ---
function openingSep(leadId: string): string {
  const v = hashedVariant(leadId, 'open', 3);
  return v === 1 ? ':' : ',';
}

function signoff(leadId: string, senderFirst: string): string {
  const v = hashedVariant(leadId, 'sign', 3);
  if (v === 1) return `Best,\n${senderFirst}`;
  return senderFirst;
}

// --- Intro micro-templates ---
function introBody(args: {
  hook: HookKind;
  firstName: string;
  businessName: string;
  industry: string | null | undefined;
  qualityTier: string | null | undefined;
  revenue: number | null | undefined;
  profit: number | null | undefined;
  enrichmentData: Record<string, unknown> | null | undefined;
  leadId: string;
}): string {
  const {
    hook,
    firstName,
    businessName,
    industry,
    qualityTier,
    revenue,
    profit,
    enrichmentData,
    leadId,
  } = args;
  const sep = openingSep(leadId);
  const insight = tierInsight(qualityTier);
  const revStr = fmtCurrency(revenue);
  const indLabel = industryShortLabel(industry) || (industry || '').trim() || 'your space';

  switch (hook) {
    case 'tenure_signal': {
      const founded = extractFoundedYear(enrichmentData);
      const years = founded ? new Date().getFullYear() - founded : null;
      if (founded) {
        return `${firstName}${sep} noticed ${businessName} has been around since ${founded}. ${years && years >= 20 ? `${years} years` : 'A run that long'} changes the comp set more than people realize. Buyers weight tenure heavily because it's the one variable nobody can fake.

When you're ready to look at what the market would actually pay, that history is the line that does most of the lifting.`;
      }
      return `${firstName}${sep} ${businessName} reads as a business that's been built carefully over real time. That tends to show up in the multiple in ways the topline number alone doesn't capture.`;
    }

    case 'industry_quirk':
      return `${firstName}${sep} ran through what came in on ${businessName}. In ${indLabel} at your size, the variable that almost always ends up doing the most work on the multiple isn't topline. It's ${insight}.

Most owners I see at this stage haven't started tracking it that way yet, which is the opportunity if a transition conversation is anywhere on the horizon.`;

    case 'margin_contrast': {
      if (!revenue || !profit) {
        return `${firstName}${sep} the margin profile on ${businessName} stands out. Worth a longer think than the headline number suggests.`;
      }
      const margin = (profit / revenue) * 100;
      const marginStr = `${margin.toFixed(0)}%`;
      if (margin < 10) {
        return `${firstName}${sep} the ${marginStr} profit line on ${businessName} is the part I keep coming back to. In ${indLabel}, that usually means there's real EBITDA hiding in add-backs that haven't been credited yet.

The cleanup work on that line tends to move what a buyer would pay more than topline growth would.`;
      }
      return `${firstName}${sep} the ${marginStr} margin on ${businessName} is well above where most ${indLabel} businesses your size land. That's the kind of number that gets a second read from anyone underwriting the comp set${revStr ? `, especially against ${revStr} in revenue` : ''}.

That's the angle worth leading with whenever a buyer conversation comes up.`;
    }

    case 'timing_alignment':
      return `${firstName}${sep} saw ${businessName} come through. The piece worth flagging early, ${insight}, is usually the variable that surprises owners later if it's not being tracked already.

Most of the work on it is the kind that compounds, so the sooner the better.`;

    case 'tier_observation':
    default: {
      const numberLine = revStr ? `On ${revStr} of revenue` : `On the profile that came through`;
      return `${firstName}${sep} quick read on ${businessName}. ${numberLine} puts you in a band where ${insight} tends to do most of the heavy lifting on the multiple.

Not always the topline story, but it's the one that usually plays out.`;
    }
  }
}

// --- Followup micro-templates ---
function followupBody(args: {
  hook: HookKind;
  firstName: string;
  businessName: string;
  industry: string | null | undefined;
  qualityTier: string | null | undefined;
  revenue: number | null | undefined;
  profit: number | null | undefined;
  leadId: string;
}): string {
  const { hook, firstName, businessName, industry, qualityTier, revenue, profit, leadId } = args;
  const sep = openingSep(leadId);
  const insight = tierInsight(qualityTier);
  const indLabel = industryShortLabel(industry) || 'your space';

  switch (hook) {
    case 'tenure_signal':
      return `${firstName}${sep} one more on ${businessName}. The longer the operating history, the more the conversation eventually shifts to who else inside the business carries the institutional knowledge. Most owners at your stage underestimate how much that one detail moves the read on transferability.

That's the one I'd quietly start mapping if you haven't already.`;

    case 'industry_quirk':
      return `${firstName}${sep} second pass on ${businessName}. The ${indLabel}-specific thing worth knowing: the businesses that end up with the cleanest reads later are the ones who started tracking ${insight} 12 to 18 months before any kind of transition conversation. It's the lead-time variable.

Not asking anything, just the pattern I see most.`;

    case 'margin_contrast':
      if (revenue && profit) {
        const margin = (profit / revenue) * 100;
        if (margin < 10) {
          return `${firstName}${sep} thought more about the ${businessName} margin line. The single highest-leverage move at this stage is usually a clean walk through add-backs with someone who's done it before. Owner comp, one-time items, real estate adjustments. That work routinely lifts the reported margin by 200 to 400 bps without changing anything operationally.

Just the most honest version of the answer.`;
        }
      }
      return `${firstName}${sep} one more on ${businessName}. With margins where they are, the variable that becomes most valuable to document carefully is what's actually driving them. Pricing power, mix, operating discipline. Buyers and bankers both underwrite the explanation more than the number.

Worth getting written down while it's all fresh.`;

    case 'timing_alignment':
      return `${firstName}${sep} kept thinking about the ${businessName} note. The single thing that compounds most between now and any future conversation is ${insight}. Not because it's complicated. Because it takes calendar time to build a clean record of, and there's no shortcut for that.

Felt worth writing down.`;

    case 'tier_observation':
    default:
      return `${firstName}${sep} second read on ${businessName}. The one piece I'd flag if it were my own number to manage: ${insight} is the variable that quietly moves the band the most over a 12 to 24 month window. Nothing dramatic, just the one that compounds.

That's it.`;
  }
}

// --- Subjects ---
function introSubject(
  hook: HookKind,
  businessName: string,
  industry: string | null | undefined,
): string {
  const biz = businessName || 'your business';
  switch (hook) {
    case 'tenure_signal':
      return `${biz}, the long view`;
    case 'industry_quirk': {
      const label = industryShortLabel(industry);
      return label ? `${biz}, one ${label} thing` : `${biz}, one thing`;
    }
    case 'margin_contrast':
      return `${biz} margins`;
    case 'timing_alignment':
      return `${biz}, the window`;
    case 'tier_observation':
    default:
      return `${biz}, quick read`;
  }
}

function followupSubject(hook: HookKind, businessName: string): string {
  const biz = businessName || 'your business';
  switch (hook) {
    case 'tenure_signal':
      return `${biz}, second look`;
    case 'industry_quirk':
      return `${biz}, second pass`;
    case 'margin_contrast':
      return `${biz}, one more`;
    case 'timing_alignment':
      return `${biz}, kept thinking`;
    case 'tier_observation':
    default:
      return `${biz}, second read`;
  }
}

// --- Main builder ---
export function buildMatchToolOutreachEmail(
  params: MatchToolOutreachEmailParams,
): MatchToolOutreachEmailContent {
  const {
    templateKind,
    leadId,
    firstName,
    businessName,
    senderName,
    revenueBucket,
    profitBucket,
    qualityTier,
    industry,
    timeline,
    enrichmentData,
  } = params;

  const safeFirst = firstName?.trim() || 'there';
  const safeBiz = businessName?.trim() || 'your business';
  const senderFirst = firstNameOnly(senderName) || senderName;
  const stableId = leadId || `${safeBiz}:${safeFirst}`;

  const revenue = bucketToRevenue(revenueBucket);
  const profit = bucketToProfit(profitBucket);

  const hook = pickTopHook({
    leadId: stableId,
    industry,
    timeline,
    qualityTier,
    revenue,
    profit,
    enrichmentData,
  });

  if (templateKind === 'followup') {
    const subject = followupSubject(hook.kind, safeBiz);
    const body = followupBody({
      hook: hook.kind,
      firstName: safeFirst,
      businessName: safeBiz,
      industry,
      qualityTier,
      revenue,
      profit,
      leadId: stableId,
    });
    const text = `${body}\n\n${signoff(stableId, senderFirst)}`;
    return {
      subject,
      textContent: text,
      htmlContent: wrapHtml(textToHtmlParagraphs(text)),
      hook,
    };
  }

  const subject = introSubject(hook.kind, safeBiz, industry);
  const body = introBody({
    hook: hook.kind,
    firstName: safeFirst,
    businessName: safeBiz,
    industry,
    qualityTier,
    revenue,
    profit,
    enrichmentData,
    leadId: stableId,
  });
  const text = `${body}\n\n${signoff(stableId, senderFirst)}`;

  return {
    subject,
    textContent: text,
    htmlContent: wrapHtml(textToHtmlParagraphs(text)),
    hook,
  };
}

export { pickTopHook, industryShortLabel } from './match-tool-outreach-hooks';
export type { HookKind, HookCandidate } from './match-tool-outreach-hooks';
