/**
 * Client-side mirror of `send-valuation-lead-outreach`'s buildEmailContent().
 * Used to render the in-dialog preview that matches what's actually sent.
 * Keep in sync with supabase/functions/send-valuation-lead-outreach/index.ts
 *
 * Architecture: hook-routed micro-templates (see valuation-lead-outreach-hooks.ts).
 * The lead's data picks ONE hook, which routes to a hook-specific 2 to 4 sentence
 * note with its own cadence and signoff rhythm. Per-lead micro-variance
 * (opening punctuation, signoff) is hashed off leadId for reproducibility.
 *
 * Voice rules:
 * - Open with an observation, never a greeting+filler combo
 * - Use contractions (you're, it's)
 * - No CTAs in the intro. The followup is itself the deliverable, no asks
 * - Bare first-name signature, no company line, no title
 * - Banned: "leverage", "optimize", "synergies", "circle back", "side-by-side",
 *   "1-page", "send it", "Just reply", "happy to chat", "value-add"
 * - Banned punctuation: em-dash and en-dash. Use commas, periods, or "to" instead.
 */

import {
  pickTopHook,
  industryShortLabel,
  extractFoundedYear,
  hashedVariant,
  type HookKind,
  type HookCandidate,
} from './valuation-lead-outreach-hooks';

export type ValuationOutreachTemplateKind = 'intro' | 'followup' | 'custom';

export interface ValuationOutreachEmailParams {
  templateKind: ValuationOutreachTemplateKind;
  leadId?: string;
  firstName: string;
  businessName: string;
  senderName: string;
  senderTitle?: string;
  revenue?: number | null;
  ebitda?: number | null;
  valuationMid?: number | null;
  valuationLow?: number | null;
  valuationHigh?: number | null;
  qualityTier?: string | null;
  industry?: string | null;
  exitTiming?: string | null;
  websiteEnrichmentData?: Record<string, unknown> | null;
}

export interface ValuationOutreachEmailContent {
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

function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${htmlEscape(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

function wrapHtml(inner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#222;">
${inner}
</body>
</html>`;
}

// --- Per-lead micro-variance ---
function openingSep(leadId: string): string {
  // 0: comma, 1: colon, 2: comma (no em-dash anywhere)
  const v = hashedVariant(leadId, 'open', 3);
  return v === 1 ? ':' : ',';
}

function signoff(leadId: string, senderFirst: string): string {
  // 0: bare first name, 1: "Best, {first}", 2: bare first name
  const v = hashedVariant(leadId, 'sign', 3);
  if (v === 1) return `Best,\n${senderFirst}`;
  return senderFirst;
}

// --- Hook-specific intro micro-templates ---
function introBody(args: {
  hook: HookKind;
  firstName: string;
  businessName: string;
  industry: string | null | undefined;
  qualityTier: string | null | undefined;
  revenue: number | null | undefined;
  ebitda: number | null | undefined;
  valuationLow: number | null | undefined;
  valuationMid: number | null | undefined;
  valuationHigh: number | null | undefined;
  websiteEnrichmentData: Record<string, unknown> | null | undefined;
  leadId: string;
}): string {
  const {
    hook,
    firstName,
    businessName,
    industry,
    qualityTier,
    revenue,
    ebitda,
    valuationLow,
    valuationMid,
    valuationHigh,
    websiteEnrichmentData,
    leadId,
  } = args;

  const sep = openingSep(leadId);
  const insight = tierInsight(qualityTier);
  const lowStr = fmtCurrency(valuationLow);
  const highStr = fmtCurrency(valuationHigh);
  const midStr = fmtCurrency(valuationMid);
  const revStr = fmtCurrency(revenue);
  const indLabel = industryShortLabel(industry) || (industry || '').trim() || 'your space';

  switch (hook) {
    case 'spread_anomaly': {
      if (lowStr && highStr && valuationLow && valuationHigh) {
        const ratio = (valuationHigh - valuationLow) / valuationLow;
        if (ratio < 0.2) {
          return `${firstName}${sep} the ${lowStr} to ${highStr} band on ${businessName} is unusually tight. That kind of compression usually shows up when the comp set lines up cleanly, which is its own quiet signal about how the model reads your business.

Worth keeping in the back pocket whenever you next look at the number.`;
        }
        return `${firstName}${sep} the ${lowStr} to ${highStr} range on ${businessName} is wider than what I see most weeks. When the band stretches like that, it almost always traces back to one or two big variables doing most of the lifting${insight ? `, usually ${insight}` : ''}.

Knowing which of those two is yours tends to be more useful than the midpoint itself.`;
      }
      // Shouldn't get here if hook was picked, but fall back gracefully
      return `${firstName}${sep} took a second look at the ${businessName} numbers. The range itself is interesting, but the part worth sitting with is what's sitting underneath it.

Mostly comes back to ${insight}.`;
    }

    case 'tenure_signal': {
      const founded = extractFoundedYear(websiteEnrichmentData);
      const years = founded ? new Date().getFullYear() - founded : null;
      if (founded) {
        return `${firstName}${sep} noticed ${businessName} has been around since ${founded}. ${years && years >= 20 ? `${years} years` : 'A run that long'} changes the comp set more than people realize. Institutional buyers weight tenure heavily because it's the one variable nobody can fake.

Whatever the midpoint says today, that's a real asset on the line above it.`;
      }
      return `${firstName}${sep} ${businessName} reads as a business that's been built carefully over real time. That tends to show up in the multiple in ways the number alone doesn't capture.`;
    }

    case 'industry_quirk': {
      return `${firstName}${sep} ran through the ${businessName} numbers. In ${indLabel} at your size, the variable that almost always ends up doing the most work on the multiple isn't topline. It's ${insight}.

Most owners I see at this stage haven't started tracking it that way yet, which is the opportunity.`;
    }

    case 'margin_contrast': {
      if (!revenue || !ebitda) {
        return `${firstName}${sep} the margin profile on ${businessName} stands out. Worth a longer think than the headline number suggests.`;
      }
      const margin = (ebitda / revenue) * 100;
      const marginStr = `${margin.toFixed(0)}%`;
      if (margin < 10) {
        return `${firstName}${sep} the ${marginStr} EBITDA line on ${businessName} is the part I keep coming back to. In ${indLabel}, that usually means there's real EBITDA hiding in add-backs that the model hasn't credited yet.

The cleanup work on that line tends to move the midpoint more than topline growth would.`;
      }
      return `${firstName}${sep} the ${marginStr} margin on ${businessName} is well above where most ${indLabel} businesses your size land. That's the kind of number that gets a second read from anyone underwriting the comp set${revStr ? `, especially against ${revStr} in revenue` : ''}.`;
    }

    case 'timing_alignment': {
      // Dispatched by exit_timing
      return `${firstName}${sep} saw the ${businessName} numbers come through. The piece worth flagging early, ${insight}, is usually the variable that surprises owners later if it's not being tracked already.

Most of the work on it is the kind that compounds, so the sooner the better.`;
    }

    case 'tier_observation':
    default: {
      const numberLine = midStr
        ? `A midpoint around ${midStr}`
        : revStr
          ? `On ${revStr} of revenue`
          : `On the profile that came through`;
      return `${firstName}${sep} quick read on ${businessName}. ${numberLine} puts you in a band where ${insight} tends to do most of the heavy lifting on the multiple.

Not always the topline story, but it's the one that usually plays out.`;
    }
  }
}

// --- Hook-specific followup micro-templates (the followup IS the deliverable) ---
function followupBody(args: {
  hook: HookKind;
  firstName: string;
  businessName: string;
  industry: string | null | undefined;
  qualityTier: string | null | undefined;
  revenue: number | null | undefined;
  ebitda: number | null | undefined;
  valuationLow: number | null | undefined;
  valuationMid: number | null | undefined;
  valuationHigh: number | null | undefined;
  leadId: string;
}): string {
  const { hook, firstName, businessName, industry, qualityTier, revenue, ebitda, leadId } = args;
  const sep = openingSep(leadId);
  const insight = tierInsight(qualityTier);
  const indLabel = industryShortLabel(industry) || 'your space';

  switch (hook) {
    case 'spread_anomaly':
      return `${firstName}${sep} went back through the ${businessName} numbers. The thing I keep coming back to: when the range is shaped the way yours is, the next move that historically narrows it is documenting ${insight} as a recurring KPI. Not for any sale conversation, just because the number stops moving once that's in place.

Felt worth flagging.`;

    case 'tenure_signal':
      return `${firstName}${sep} one more on ${businessName}. The longer the operating history, the more the conversation eventually shifts to who else inside the business carries the institutional knowledge. Most owners at your stage underestimate how much that one detail moves the read on transferability.

That's the one I'd quietly start mapping if you haven't already.`;

    case 'industry_quirk':
      return `${firstName}${sep} second pass on ${businessName}. The ${indLabel}-specific thing worth knowing: the businesses that end up with the cleanest reads later are the ones who started tracking ${insight} 12 to 18 months before any kind of transition conversation. It's the lead-time variable.

Not asking anything, just the pattern I see most.`;

    case 'margin_contrast':
      if (revenue && ebitda) {
        const margin = (ebitda / revenue) * 100;
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

// --- Subject builders ---
function introSubject(
  hook: HookKind,
  businessName: string,
  industry: string | null | undefined,
): string {
  const biz = businessName || 'your business';
  switch (hook) {
    case 'spread_anomaly':
      return `the ${biz} spread`;
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
    case 'spread_anomaly':
      return `one more on ${biz}`;
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
export function buildValuationOutreachEmail(
  params: ValuationOutreachEmailParams,
): ValuationOutreachEmailContent {
  const {
    templateKind,
    leadId,
    firstName,
    businessName,
    senderName,
    revenue,
    ebitda,
    valuationMid,
    valuationLow,
    valuationHigh,
    qualityTier,
    industry,
    exitTiming,
    websiteEnrichmentData,
  } = params;

  const safeFirst = firstName?.trim() || 'there';
  const safeBiz = businessName?.trim() || 'your business';
  const senderFirst = firstNameOnly(senderName) || senderName;
  const stableId = leadId || `${safeBiz}:${safeFirst}`;

  const hook = pickTopHook({
    leadId: stableId,
    industry,
    exitTiming,
    qualityTier,
    revenue,
    ebitda,
    valuationLow,
    valuationMid,
    valuationHigh,
    websiteEnrichmentData,
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
      ebitda,
      valuationLow,
      valuationMid,
      valuationHigh,
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

  // Intro (or 'custom' which the dialog seeds from intro)
  const subject = introSubject(hook.kind, safeBiz, industry);
  const body = introBody({
    hook: hook.kind,
    firstName: safeFirst,
    businessName: safeBiz,
    industry,
    qualityTier,
    revenue,
    ebitda,
    valuationLow,
    valuationMid,
    valuationHigh,
    websiteEnrichmentData,
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

// --- Re-exports for any legacy callers ---
export { pickTopHook, industryShortLabel } from './valuation-lead-outreach-hooks';
export type { HookKind, HookCandidate } from './valuation-lead-outreach-hooks';
