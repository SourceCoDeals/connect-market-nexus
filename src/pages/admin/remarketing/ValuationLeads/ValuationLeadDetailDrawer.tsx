import { useState, useEffect, useRef, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ThumbsDown,
  ArrowRight,
  DollarSign,
  Linkedin,
  ExternalLink,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  Search,
  Mail,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatCompactCurrency } from '@/lib/utils';
import { ClickToDialPhone } from '@/components/shared/ClickToDialPhone';
import { CallActivityList } from '@/components/remarketing/CallActivityList';
import { ValuationLeadOutreachDialog } from '@/components/remarketing/ValuationLeadOutreachDialog';
import { useValuationLeadOutreachTracking } from '@/hooks/admin/use-valuation-lead-outreach-tracking';
import type { ValuationLead } from './types';
import { extractBusinessName, inferWebsite } from './helpers';
import { calculatorBadge } from './BadgeComponents';
import { parseCalculatorInputs, parseValuationResults } from './detailHelpers';
import { CredibilityNote, readCredibility } from './CredibilityBadge';
import { isValidEmail, pickValidEmail } from '@/lib/email-validation';

// ─── Helpers ───

const ABBREVIATIONS: Record<string, string> = {
  ebitda: 'EBITDA',
  ltm: 'LTM',
  roi: 'ROI',
  sde: 'SDE',
  utm: 'UTM',
  id: 'ID',
  kpi: 'KPI',
  cta: 'CTA',
  url: 'URL',
  ip: 'IP',
  os: 'OS',
  yoy: 'YoY',
  mom: 'MoM',
  arr: 'ARR',
  mrr: 'MRR',
  gp: 'GP',
  cac: 'CAC',
  ltv: 'LTV',
  noi: 'NOI',
  dscr: 'DSCR',
  re: 'RE',
};

const CURRENCY_KEYS =
  /revenue|ebitda|valuation|asset|income|cash|debt|salary|wage|cost|price|profit|earning|capex|opex|sde|noi/i;
const PERCENT_KEYS = /margin|rate|churn|ratio|percent|pct|yield|discount|growth/i;

function formatFieldLabel(key: string): string {
  const words = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((w) => {
      const lower = w.toLowerCase();
      if (ABBREVIATIONS[lower]) return ABBREVIATIONS[lower];
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function formatDisplayValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (val === 'true' || val === 'false') return val === 'true' ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);

  const str = String(val);
  const num = typeof val === 'number' ? val : parseFloat(str.replace(/[$,\s]/g, ''));

  if (!isNaN(num) && str.trim() !== '') {
    if (PERCENT_KEYS.test(key) && num > 0 && num <= 1) return `${(num * 100).toFixed(1)}%`;
    if (PERCENT_KEYS.test(key) && num > 1 && num <= 100) return `${num.toFixed(1)}%`;
    if (CURRENCY_KEYS.test(key)) {
      if (num >= 1_000_000) return formatCompactCurrency(num);
      if (num >= 1000) return `$${num.toLocaleString('en-US')}`;
      if (num > 0) return `$${num.toLocaleString('en-US')}`;
    }
    if (Number.isInteger(num) && num >= 1000) return num.toLocaleString('en-US');
    if (!Number.isInteger(num)) return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return str;
}

/** Derive a letter grade from quality_label / tier */
function getQualityGrade(lead: ValuationLead, tier: string | null): string | null {
  if (tier) {
    const t = tier.toUpperCase();
    if (t === '1' || t === 'A' || t.includes('PREMIUM') || t.includes('TOP')) return 'A';
    if (t === '2' || t === 'B' || t.includes('GOOD') || t.includes('STRONG')) return 'B';
    if (t === '3' || t === 'C' || t.includes('AVERAGE') || t.includes('MODERATE')) return 'C';
    if (t === '4' || t === 'D' || t.includes('LOW') || t.includes('WEAK')) return 'D';
    return t.charAt(0);
  }
  if (lead.quality_label) {
    const ql = lead.quality_label.toUpperCase();
    if (ql.includes('PREMIUM') || ql.includes('EXCELLENT') || ql.includes('TOP')) return 'A';
    if (ql.includes('GOOD') || ql.includes('STRONG') || ql.includes('HIGH')) return 'B';
    if (ql.includes('AVERAGE') || ql.includes('MODERATE') || ql.includes('FAIR')) return 'C';
    return 'D';
  }
  return null;
}

// ─── Sub-components ───

/** Company favicon — re-exported via the shared admin component for visual consistency. */
import { CompanyLogo as SharedCompanyLogo } from '@/components/admin/CompanyLogo';

function CompanyLogo({
  website,
  name,
  enrichedLogoUrl,
}: {
  website: string | null;
  name: string;
  enrichedLogoUrl?: string | null;
}) {
  return (
    <SharedCompanyLogo website={website} name={name} enrichedLogoUrl={enrichedLogoUrl} size="lg" />
  );
}

/** Inline copyable value */
function CopyableValue({ value, children }: { value: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="inline-flex items-center gap-1 group">
      {children}
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
        title="Copy"
      >
        {copied ? (
          <Check className="h-2.5 w-2.5 text-muted-foreground" />
        ) : (
          <Copy className="h-2.5 w-2.5 text-muted-foreground/30 hover:text-muted-foreground" />
        )}
      </button>
    </span>
  );
}

/** Collapsible section wrapper */
function Section({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full border-t border-border/20 py-3 flex items-center gap-2 transition-colors">
        <span
          className="text-[13px] font-medium text-foreground flex-1 text-left"
          style={{ letterSpacing: '-0.01em' }}
        >
          {title}
        </span>
        {summary && (
          <span className="text-[13px] text-muted-foreground/60 font-normal mr-1 tabular-nums">
            {summary}
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-1 pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DetailRow({
  label,
  value,
  className: cls,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex justify-between items-center py-2', cls)}>
      <span className="text-[13px] text-muted-foreground/70">{label}</span>
      <span className="text-[13px] text-foreground text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}

function ReadinessBar({ label, score }: { label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));

  return (
    <div className="py-1.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[13px] text-muted-foreground/70">{label}</span>
        <span className="text-[13px] font-semibold text-foreground tabular-nums">{score}</span>
      </div>
      <div className="h-[2px] rounded-full bg-border/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground/40 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ValuationRangeBar({ low, mid, high }: { low: number; mid: number; high: number }) {
  const range = high - low;
  const midPct = range > 0 ? ((mid - low) / range) * 100 : 50;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] text-muted-foreground/50 tabular-nums">
        <span>{formatCompactCurrency(low)}</span>
        <span className="font-medium text-foreground">{formatCompactCurrency(mid)}</span>
        <span>{formatCompactCurrency(high)}</span>
      </div>
      <div className="relative h-[2px] rounded-full bg-border/30 overflow-visible">
        <div className="absolute inset-0 rounded-full bg-foreground/8" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-foreground border-2 border-background shadow-sm"
          style={{ left: `${midPct}%`, marginLeft: '-4px' }}
        />
      </div>
    </div>
  );
}

/** Small inline logo for section headers */
function InlineCompanyLogo({
  website,
  name,
  enrichedLogoUrl,
}: {
  website: string | null;
  name: string;
  enrichedLogoUrl?: string | null;
}) {
  return (
    <SharedCompanyLogo website={website} name={name} enrichedLogoUrl={enrichedLogoUrl} size="sm" />
  );
}

/** Truncate at sentence boundary or char count */
function getSummarySentence(text: string, maxChars = 140): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  // Find first sentence end
  const sentenceMatch = trimmed.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch && sentenceMatch[0].length <= maxChars) {
    return sentenceMatch[0].trim();
  }
  // Fallback to char truncation at word boundary
  const sliced = trimmed.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced) + '…';
}

// ─── Main Component ───

interface Props {
  lead: ValuationLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPushToDeals: (leadIds: string[]) => void;
  onMarkNotFit: (leadIds: string[]) => void;
  onViewDeal: (listingId: string) => void;
  isPushing?: boolean;
  refetchLeads?: () => void;
  onFindContacts?: (leadIds: string[]) => void;
  isFindingContacts?: boolean;
}

export function ValuationLeadDetailDrawer({
  lead,
  open,
  onOpenChange,
  onPushToDeals,
  onMarkNotFit,
  onViewDeal,
  isPushing,
  refetchLeads,
  onFindContacts,
  isFindingContacts,
}: Props) {
  // ─── On-demand enrichment ───
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const enrichAttemptedRef = useRef<string | null>(null);
  // Local patch applied immediately when the function returns,
  // so the panel updates without waiting for the table refetch.
  const [enrichmentPatch, setEnrichmentPatch] = useState<{
    id: string;
    website_enrichment_data: Record<string, unknown>;
    website_enriched_at: string;
  } | null>(null);

  // Outreach email dialog state
  const [outreachDialogOpen, setOutreachDialogOpen] = useState(false);
  const { data: outreachTracking } = useValuationLeadOutreachTracking(lead?.id);

  const triggerEnrichment = useCallback(
    async (force = false) => {
      if (!lead?.id || !inferWebsite(lead)) return;
      setIsEnriching(true);
      setEnrichError(false);
      try {
        const { data, error } = await supabase.functions.invoke('enrich-valuation-lead-website', {
          body: { valuation_lead_id: lead.id, website: inferWebsite(lead), force },
        });
        if (error) throw error;
        // Patch immediately with returned payload (works for both fresh + skipped responses)
        const payload = data as {
          website_enrichment_data?: Record<string, unknown>;
          website_enriched_at?: string;
        } | null;
        if (payload?.website_enrichment_data && payload?.website_enriched_at) {
          setEnrichmentPatch({
            id: lead.id,
            website_enrichment_data: payload.website_enrichment_data,
            website_enriched_at: payload.website_enriched_at,
          });
        }
        refetchLeads?.();
      } catch (err) {
        console.error('[enrichment] Failed:', err);
        setEnrichError(true);
      } finally {
        setIsEnriching(false);
      }
    },
    [lead, refetchLeads],
  );

  // Auto-trigger enrichment when drawer opens for un-enriched leads
  useEffect(() => {
    if (!lead?.id || !open) return;
    const ws = inferWebsite(lead);
    if (!ws || lead.website_enriched_at) return;
    if (enrichAttemptedRef.current === lead.id) return;
    enrichAttemptedRef.current = lead.id;
    triggerEnrichment(false);
  }, [lead?.id, open, lead?.website_enriched_at, triggerEnrichment]);

  if (!lead) return null;

  // Apply local patch if it matches the current lead
  const effectiveEnrichmentData = (
    enrichmentPatch?.id === lead.id
      ? enrichmentPatch.website_enrichment_data
      : lead.website_enrichment_data
  ) as Record<string, unknown> | null;
  const effectiveEnrichedAt =
    enrichmentPatch?.id === lead.id
      ? enrichmentPatch.website_enriched_at
      : lead.website_enriched_at;

  const businessName = extractBusinessName(lead);
  const website = inferWebsite(lead);
  const inputs = parseCalculatorInputs(lead.raw_calculator_inputs);
  const results = parseValuationResults(lead.raw_valuation_results);

  // Parse website enrichment data
  const enrichment = effectiveEnrichmentData;
  const enrichedLogo = (enrichment?.logo_url as string) || null;
  const enrichedDescription = (enrichment?.description as string) || null;
  // enrichment?.tagline available but not displayed separately
  const enrichedServices = Array.isArray(enrichment?.services)
    ? (enrichment.services as string[])
    : [];
  const enrichedFoundedYear = enrichment?.founded_year as number | null;
  const enrichedEmployees = (enrichment?.employee_count_estimate as string) || null;
  const enrichedHQ = (enrichment?.headquarters as string) || null;
  const enrichedDifferentiators = Array.isArray(enrichment?.key_differentiators)
    ? (enrichment.key_differentiators as string[])
    : [];
  const enrichedTargetCustomers = (enrichment?.target_customers as string) || null;
  const hasEnrichment = enrichment != null && Object.keys(enrichment).length > 1; // >1 because favicon_url is always present

  const timeAgo = formatDistanceToNow(new Date(lead.created_at), { addSuffix: true });
  const locationParts = [lead.user_location, lead.location, lead.region].filter(Boolean);
  const displayLocation = locationParts[0] || null;

  const primaryPhone = lead.buyer_intro_phone || lead.phone;
  const primaryEmail = pickValidEmail(lead.buyer_intro_email, lead.work_email, lead.email);
  const isOpen = lead.open_to_intros === true;
  const qualityGrade = getQualityGrade(lead, results?.tier ?? null);

  const readinessDrivers =
    lead.readiness_drivers && typeof lead.readiness_drivers === 'object'
      ? Object.entries(lead.readiness_drivers as Record<string, unknown>)
          .filter(([, v]) => v != null && !isNaN(Number(v)))
          .map(([k, v]) => ({ label: formatFieldLabel(k), score: Number(v) }))
      : [];

  const websiteDomain = website?.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || null;

  // Collect all unique emails — drop junk strings the enricher writes (e.g. "no email found").
  const emails: { value: string; suffix?: string }[] = [];
  if (isValidEmail(lead.email)) emails.push({ value: lead.email! });
  if (isValidEmail(lead.work_email) && lead.work_email !== lead.email)
    emails.push({ value: lead.work_email!, suffix: 'work' });
  if (
    isValidEmail(lead.buyer_intro_email) &&
    lead.buyer_intro_email !== lead.email &&
    lead.buyer_intro_email !== lead.work_email
  )
    emails.push({ value: lead.buyer_intro_email!, suffix: 'intro' });

  // Collect all unique phones
  const phones: { value: string; suffix?: string }[] = [];
  if (lead.phone) phones.push({ value: lead.phone });
  if (lead.buyer_intro_phone && lead.buyer_intro_phone !== lead.phone)
    phones.push({ value: lead.buyer_intro_phone, suffix: 'intro' });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[720px] p-0 flex flex-col gap-0">
        {/* ═══════════════════════════════════════════════
            ZONE 1 — Unified Identity + Contact Header
            ═══════════════════════════════════════════════ */}

        <SheetHeader className="px-6 pt-6 pb-4 shrink-0 space-y-0">
          <div className="flex items-start gap-4">
            <CompanyLogo website={website} name={businessName} enrichedLogoUrl={enrichedLogo} />
            <div className="min-w-0 flex-1 space-y-1">
              <SheetTitle
                className="text-xl font-semibold text-foreground leading-tight truncate"
                style={{ letterSpacing: '-0.02em' }}
              >
                {businessName}
              </SheetTitle>

              {/* Meta line: industry · location · time */}
              <p className="text-sm text-muted-foreground">
                {[lead.industry, displayLocation, timeAgo].filter(Boolean).join(' · ')}
              </p>

              {/* Website domain + credibility note */}
              {websiteDomain && (
                <div className="space-y-1">
                  <a
                    href={`https://${websiteDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground/70 hover:text-foreground underline-offset-4 hover:underline transition-colors inline-block"
                  >
                    {websiteDomain}
                  </a>
                  <CredibilityNote signal={readCredibility(enrichment)} />
                </div>
              )}

              {/* Contact inline: name · email · phone */}
              <div className="pt-1 space-y-0.5">
                <p className="text-sm text-foreground flex items-center flex-wrap gap-x-1">
                  {lead.full_name && <span className="font-medium">{lead.full_name}</span>}
                  {lead.full_name && emails.length > 0 && (
                    <span className="text-muted-foreground/30">·</span>
                  )}
                  {emails.map((e, i) => (
                    <span key={e.value} className="inline-flex items-center gap-x-1">
                      {i > 0 && <span className="text-muted-foreground/30">·</span>}
                      <CopyableValue value={e.value}>
                        <a
                          href={`mailto:${e.value}`}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {e.value}
                        </a>
                      </CopyableValue>
                    </span>
                  ))}
                </p>

                {/* Phones inline */}
                {phones.length > 0 && (
                  <p className="text-sm flex items-center gap-x-1">
                    {phones.map((p, i) => (
                      <span key={p.value} className="inline-flex items-center gap-x-1">
                        {i > 0 && <span className="text-muted-foreground/30">·</span>}
                        <CopyableValue value={p.value}>
                          <a
                            href={`tel:${p.value}`}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {p.value}
                          </a>
                        </CopyableValue>
                      </span>
                    ))}
                  </p>
                )}

                {/* LinkedIn */}
                {lead.linkedin_url && (
                  <a
                    href={lead.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    <Linkedin className="h-3 w-3" />
                    LinkedIn
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}

                {/* Find contact info — only when phone or LinkedIn missing */}
                {onFindContacts && (!lead.phone || !lead.linkedin_url) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFindContacts([lead.id]);
                    }}
                    disabled={isFindingContacts}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {isFindingContacts ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Search className="h-3 w-3" />
                    )}
                    Find{' '}
                    {!lead.phone && !lead.linkedin_url
                      ? 'phone & LinkedIn'
                      : !lead.phone
                        ? 'phone'
                        : 'LinkedIn'}
                  </button>
                )}

                {/* Intro status + timeline — inline text, not pills */}
                <p className="text-[11px] text-muted-foreground/50 pt-0.5 flex items-center gap-x-2">
                  <span className="inline-flex items-center gap-1">
                    {isOpen && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                    {isOpen ? 'Open to intros' : 'Not open'}
                  </span>
                  {lead.exit_timing && (
                    <>
                      <span className="text-muted-foreground/20">·</span>
                      <span>{lead.exit_timing}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Phone + Email outreach CTAs */}
        {(primaryPhone || primaryEmail) && (
          <div className="px-6 pb-4 shrink-0 flex items-center gap-2">
            {primaryPhone && (
              <div className="flex-1 bg-foreground text-background rounded-lg h-11 flex items-center justify-center">
                <ClickToDialPhone
                  phone={primaryPhone}
                  name={lead.full_name || businessName}
                  email={primaryEmail || undefined}
                  company={businessName}
                  entityType="leads"
                  entityId={lead.id}
                  valuationLeadId={lead.id}
                  size="md"
                  className="!text-background text-[14px] font-medium tracking-tight"
                />
              </div>
            )}
            {primaryEmail &&
              (() => {
                const sentCount = outreachTracking?.sendCount ?? 0;
                const hasSent = sentCount > 0;
                const lastSent = outreachTracking?.emailSentAt;
                const lifecycle = outreachTracking?.highestLifecycle;
                return (
                  <button
                    type="button"
                    onClick={() => setOutreachDialogOpen(true)}
                    className={cn(
                      'h-11 px-4 rounded-lg flex items-center gap-2 text-[13px] font-medium tracking-tight transition-colors',
                      hasSent
                        ? 'bg-muted hover:bg-muted/70 text-foreground border border-border/60'
                        : 'bg-foreground text-background hover:bg-foreground/90',
                      primaryPhone ? '' : 'flex-1 justify-center',
                    )}
                    title={
                      hasSent && lastSent
                        ? `Last sent ${formatDistanceToNow(new Date(lastSent), { addSuffix: true })}${lifecycle ? ` · ${lifecycle}` : ''}`
                        : 'Send outreach email'
                    }
                  >
                    {hasSent ? (
                      <>
                        <Mail className="h-4 w-4" />
                        <span>
                          Sent
                          {lastSent && (
                            <span className="text-muted-foreground ml-1 font-normal">
                              · {formatDistanceToNow(new Date(lastSent), { addSuffix: true })}
                            </span>
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Email</span>
                      </>
                    )}
                  </button>
                );
              })()}
          </div>
        )}

        {/* Outreach email dialog */}
        {primaryEmail && (
          <ValuationLeadOutreachDialog
            open={outreachDialogOpen}
            onOpenChange={setOutreachDialogOpen}
            valuationLeadId={lead.id}
            leadEmail={primaryEmail}
            leadName={lead.full_name}
            businessName={businessName}
            revenue={lead.revenue}
            ebitda={lead.ebitda}
            valuationMid={lead.valuation_mid}
            valuationLow={lead.valuation_low}
            valuationHigh={lead.valuation_high}
            qualityTier={lead.quality_tier}
            industry={lead.industry}
            exitTiming={lead.exit_timing}
            hasSent={(outreachTracking?.sendCount ?? 0) > 0}
          />
        )}

        {/* Deal Snapshot — 2×3 grid with valuation range integrated */}
        <div className="px-6 pb-4 shrink-0">
          <div className="bg-muted/30 rounded-xl p-5">
            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
              {[
                {
                  label: 'Revenue',
                  value: lead.revenue ? formatCompactCurrency(lead.revenue) : '—',
                },
                { label: 'EBITDA', value: lead.ebitda ? formatCompactCurrency(lead.ebitda) : '—' },
                {
                  label: 'Valuation',
                  value: results?.businessValue
                    ? formatCompactCurrency(results.businessValue.mid)
                    : lead.valuation_mid
                      ? formatCompactCurrency(lead.valuation_mid)
                      : '—',
                },
                {
                  label: 'Readiness',
                  value: lead.readiness_score != null ? `${lead.readiness_score}` : '—',
                },
                { label: 'Growth', value: lead.growth_trend || '—' },
                { label: 'Grade', value: qualityGrade || '—', isGrade: true },
              ].map(({ label, value, isGrade }) => (
                <div key={label}>
                  <p className="text-[11px] text-muted-foreground/50 font-medium">{label}</p>
                  <p
                    className={cn(
                      'font-semibold text-foreground mt-0.5 tabular-nums',
                      isGrade ? 'text-2xl font-bold leading-none' : 'text-lg',
                    )}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Valuation range bar — integrated inside snapshot */}
            {results?.businessValue && (
              <div className="mt-4 pt-4 border-t border-border/20">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-[11px] text-muted-foreground/50 font-medium">
                    Valuation Range
                  </p>
                  {results.ebitdaMultiple && (
                    <p className="text-[11px] text-muted-foreground/40 tabular-nums">
                      {results.ebitdaMultiple.toFixed(1)}x EBITDA
                      {results.revenueMultiple
                        ? ` · ${results.revenueMultiple.toFixed(2)}x Rev`
                        : ''}
                    </p>
                  )}
                </div>
                <ValuationRangeBar
                  low={results.businessValue.low}
                  mid={results.businessValue.mid}
                  high={results.businessValue.high}
                />
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            ZONE 1.5 — Company Intelligence (always visible)
            ═══════════════════════════════════════════════ */}

        {hasEnrichment &&
          (() => {
            const summary = enrichedDescription
              ? getSummarySentence(enrichedDescription, 140)
              : null;
            const metaParts = [
              enrichedFoundedYear ? `Founded ${enrichedFoundedYear}` : null,
              enrichedEmployees ? `~${enrichedEmployees} employees` : null,
              enrichedHQ || null,
              lead.locations_count ? `${lead.locations_count} locations` : null,
            ].filter(Boolean);
            const hasMore = Boolean(
              (enrichedDescription && enrichedDescription.trim() !== summary) ||
              enrichedServices.length > 0 ||
              enrichedDifferentiators.length > 0 ||
              (enrichedTargetCustomers && enrichedTargetCustomers !== enrichedDescription),
            );
            const visibleServices = enrichedServices.slice(0, 6);
            const extraServices = enrichedServices.length - visibleServices.length;
            const visibleDiffs = enrichedDifferentiators.slice(0, 3);
            const targetIsRedundant =
              enrichedTargetCustomers &&
              enrichedDescription &&
              enrichedDescription
                .toLowerCase()
                .includes(enrichedTargetCustomers.toLowerCase().slice(0, 30));

            return (
              <div className="px-6 pb-4 shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <InlineCompanyLogo
                    website={website}
                    name={businessName}
                    enrichedLogoUrl={enrichedLogo}
                  />
                  <p className="text-[11px] text-muted-foreground/50 font-medium">
                    About the Business
                  </p>
                </div>

                {!aboutExpanded && summary && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{summary}</p>
                )}

                {metaParts.length > 0 && (
                  <p className="text-[12px] text-muted-foreground/60 mt-1">
                    {metaParts.join(' · ')}
                  </p>
                )}

                {aboutExpanded && (
                  <div className="mt-2 space-y-1.5">
                    {enrichedDescription && enrichedDescription.trim() !== summary && (
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        {enrichedDescription}
                      </p>
                    )}
                    {visibleServices.length > 0 && (
                      <p className="text-[12px] text-muted-foreground/70">
                        <span className="text-muted-foreground/40">Services: </span>
                        {visibleServices.join(' · ')}
                        {extraServices > 0 && (
                          <span className="text-muted-foreground/40"> · +{extraServices} more</span>
                        )}
                      </p>
                    )}
                    {visibleDiffs.length > 0 && (
                      <p className="text-[12px] text-muted-foreground/70">
                        <span className="text-muted-foreground/40">Differentiators: </span>
                        {visibleDiffs.join(' · ')}
                      </p>
                    )}
                    {enrichedTargetCustomers && !targetIsRedundant && (
                      <p className="text-[12px] text-muted-foreground/70">
                        <span className="text-muted-foreground/40">Serves: </span>
                        {enrichedTargetCustomers}
                      </p>
                    )}
                  </div>
                )}

                {hasMore && (
                  <button
                    onClick={() => setAboutExpanded((v) => !v)}
                    className="text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors mt-1.5"
                  >
                    {aboutExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            );
          })()}

        {/* Enriching state — active loading or retry */}
        {!hasEnrichment && website && (
          <div className="px-6 pb-3 shrink-0">
            {isEnriching ? (
              <p className="text-[11px] text-muted-foreground/40 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 animate-pulse" />
                Enriching company data…
              </p>
            ) : enrichError ? (
              <p className="text-[11px] text-muted-foreground/40 flex items-center gap-1.5">
                Enrichment failed ·{' '}
                <button
                  onClick={() => triggerEnrichment(true)}
                  className="underline hover:text-foreground transition-colors"
                >
                  Retry
                </button>
              </p>
            ) : effectiveEnrichedAt ? (
              <p className="text-[11px] text-muted-foreground/40">Website data unavailable</p>
            ) : (
              <button
                onClick={() => triggerEnrichment(false)}
                className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors underline"
              >
                Enrich company data
              </button>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            ZONE 2 — Scrollable Detail Sections
            ═══════════════════════════════════════════════ */}

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-2 space-y-0">
            {/* Property Value */}
            {results?.propertyValue && (
              <div className="pb-3">
                <p className="text-[11px] text-muted-foreground/50 font-medium mb-1">
                  Property Value
                </p>
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {formatCompactCurrency(results.propertyValue.mid)}
                  <span className="text-[13px] text-muted-foreground font-normal ml-2">
                    ({formatCompactCurrency(results.propertyValue.low)} –{' '}
                    {formatCompactCurrency(results.propertyValue.high)})
                  </span>
                </p>
                {results.propertyValue.capRate && (
                  <p className="text-[13px] text-muted-foreground/60 mt-0.5">
                    Cap Rate: {(results.propertyValue.capRate * 100).toFixed(1)}%
                    {results.propertyValue.envDiscount
                      ? ` · Env. Discount: ${(results.propertyValue.envDiscount * 100).toFixed(0)}%`
                      : ''}
                  </p>
                )}
              </div>
            )}

            {/* Analysis Narrative — plain paragraph */}
            {results?.narrative && (
              <div className="py-2">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {results.narrative}
                </p>
              </div>
            )}

            {/* ─── Collapsible Sections ─── */}

            {/* Business Profile — only non-duplicated fields */}
            {(lead.revenue_model ||
              lead.years_in_business ||
              lead.locations_count != null ||
              lead.owner_dependency ||
              lead.owned_assets != null ||
              lead.custom_industry) && (
              <Section title="Business Profile" defaultOpen>
                <div className="divide-y divide-border/10">
                  {lead.revenue_model && (
                    <DetailRow
                      label="Revenue Model"
                      value={<span className="capitalize">{lead.revenue_model}</span>}
                    />
                  )}
                  {lead.custom_industry && (
                    <DetailRow label="Custom Industry" value={lead.custom_industry} />
                  )}
                  {lead.years_in_business && (
                    <DetailRow label="Years in Business" value={lead.years_in_business} />
                  )}
                  {website && (
                    <DetailRow
                      label="Website"
                      value={
                        <a
                          href={`https://${website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline underline-offset-4"
                        >
                          {websiteDomain}
                        </a>
                      }
                    />
                  )}
                  {lead.owned_assets != null && (
                    <DetailRow
                      label="Tangible Assets"
                      value={formatCompactCurrency(lead.owned_assets)}
                    />
                  )}
                  {lead.locations_count != null && (
                    <DetailRow label="Locations" value={String(lead.locations_count)} />
                  )}
                  {lead.owner_dependency && (
                    <DetailRow label="Owner Dependency" value={lead.owner_dependency} />
                  )}
                </div>
              </Section>
            )}

            {/* Financial Details */}
            {lead.financial_details &&
              typeof lead.financial_details === 'object' &&
              Object.keys(lead.financial_details).length > 0 && (
                <Section title="Financial Details">
                  <div className="divide-y divide-border/10">
                    {Object.entries(lead.financial_details as Record<string, unknown>).map(
                      ([key, val]) => {
                        if (val === null || val === undefined || val === '') return null;
                        return (
                          <DetailRow
                            key={key}
                            label={formatFieldLabel(key)}
                            value={formatDisplayValue(key, val)}
                          />
                        );
                      },
                    )}
                  </div>
                </Section>
              )}

            {/* Exit Readiness */}
            {readinessDrivers.length > 0 && (
              <Section
                title="Exit Readiness"
                summary={lead.readiness_score != null ? `${lead.readiness_score}/100` : undefined}
                defaultOpen
              >
                <div className="space-y-0">
                  {readinessDrivers.map(({ label, score }) => (
                    <ReadinessBar key={label} label={label} score={score} />
                  ))}
                </div>
              </Section>
            )}

            {/* Fallback readiness */}
            {readinessDrivers.length === 0 &&
              lead.readiness_drivers &&
              typeof lead.readiness_drivers === 'object' &&
              Object.keys(lead.readiness_drivers).length > 0 && (
                <Section title="Exit Readiness" defaultOpen>
                  <div className="divide-y divide-border/10">
                    {Object.entries(lead.readiness_drivers as Record<string, unknown>).map(
                      ([key, val]) => (
                        <DetailRow
                          key={key}
                          label={formatFieldLabel(key)}
                          value={
                            <span className="font-mono tabular-nums">
                              {formatDisplayValue(key, val)}
                            </span>
                          }
                        />
                      ),
                    )}
                  </div>
                </Section>
              )}

            {/* Exit Intent */}
            {(lead.exit_timing ||
              lead.exit_structure ||
              lead.exit_involvement ||
              lead.open_to_intros != null) &&
              (() => {
                const eid = (lead.exit_intent_details ?? {}) as Record<string, unknown>;
                const shown = new Set([
                  'exitTiming',
                  'exit_timing',
                  'exitStructure',
                  'exit_structure',
                  'exitInvolvement',
                  'exit_involvement',
                  'openToIntros',
                  'open_to_intros',
                  'buyerIntroEmail',
                  'buyerIntroPhone',
                ]);
                const extras = Object.entries(eid).filter(
                  ([k, v]) => !shown.has(k) && v != null && v !== '',
                );

                return (
                  <Section title="Exit Intent" summary={lead.exit_timing || undefined} defaultOpen>
                    <div className="divide-y divide-border/10">
                      {lead.exit_timing && (
                        <DetailRow label="Exit Timeline" value={lead.exit_timing} />
                      )}
                      {lead.exit_structure && (
                        <DetailRow label="Preferred Structure" value={lead.exit_structure} />
                      )}
                      {lead.exit_involvement && (
                        <DetailRow label="Post-Sale Involvement" value={lead.exit_involvement} />
                      )}
                      {lead.open_to_intros != null && (
                        <DetailRow
                          label="Open to Introductions"
                          value={
                            <span className="flex items-center gap-1.5">
                              {lead.open_to_intros && (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              )}
                              {lead.open_to_intros ? 'Yes' : 'No'}
                            </span>
                          }
                        />
                      )}
                      {lead.buyer_intro_phone && (
                        <DetailRow
                          label="Intro Phone"
                          value={
                            <a href={`tel:${lead.buyer_intro_phone}`} className="hover:underline">
                              {lead.buyer_intro_phone}
                            </a>
                          }
                        />
                      )}
                      {lead.buyer_intro_email && (
                        <DetailRow
                          label="Intro Email"
                          value={
                            <a
                              href={`mailto:${lead.buyer_intro_email}`}
                              className="hover:underline"
                            >
                              {lead.buyer_intro_email}
                            </a>
                          }
                        />
                      )}
                      {extras.map(([key, val]) => (
                        <DetailRow
                          key={key}
                          label={formatFieldLabel(key)}
                          value={formatDisplayValue(key, val)}
                        />
                      ))}
                    </div>
                  </Section>
                );
              })()}

            {/* Valuation Analysis */}
            {(results?.qualityLabel ||
              results?.buyerLane ||
              (results && results.scoreBreakdown.length > 0) ||
              (results &&
                (results.positiveFactors.length > 0 || results.negativeFactors.length > 0))) && (
              <Section title="Valuation Analysis">
                <div className="space-y-4">
                  {/* Quality + Buyer Lane side by side */}
                  {(results?.qualityLabel || results?.buyerLane) && (
                    <div className="grid grid-cols-2 gap-3">
                      {results?.qualityLabel && (
                        <div className="bg-muted/20 rounded-lg p-3">
                          <p className="text-[11px] text-muted-foreground/50 font-medium">
                            Quality Tier
                          </p>
                          <p className="text-[13px] font-semibold text-foreground mt-1">
                            {results.qualityLabel.label}
                          </p>
                          {results.qualityLabel.description && (
                            <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-snug">
                              {results.qualityLabel.description}
                            </p>
                          )}
                        </div>
                      )}
                      {results?.buyerLane && (
                        <div className="bg-muted/20 rounded-lg p-3">
                          <p className="text-[11px] text-muted-foreground/50 font-medium">
                            Buyer Lane
                          </p>
                          <p className="text-[13px] font-semibold text-foreground mt-1">
                            {results.buyerLane.title}
                          </p>
                          {results.buyerLane.description && (
                            <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-snug">
                              {results.buyerLane.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Score Breakdown */}
                  {results && results.scoreBreakdown.length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted-foreground/50 font-medium mb-2">
                        Score Breakdown
                      </p>
                      <div>
                        {results.scoreBreakdown.map(({ label, value }) => (
                          <div
                            key={label}
                            className="flex justify-between items-center py-2 border-b border-border/10"
                          >
                            <span className="text-[12px] text-muted-foreground/70">{label}</span>
                            <span className="text-[12px] text-foreground font-mono tabular-nums">
                              {typeof value === 'number'
                                ? value > 0
                                  ? `+${value}`
                                  : value
                                : value}
                            </span>
                          </div>
                        ))}
                      </div>
                      {lead.scoring_notes && (
                        <p className="text-[11px] text-muted-foreground/50 mt-2">
                          {lead.scoring_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Strengths / Risks */}
                  {results &&
                    (results.positiveFactors.length > 0 || results.negativeFactors.length > 0) && (
                      <div className="space-y-3">
                        {results.positiveFactors.length > 0 && (
                          <div>
                            <p className="text-[11px] text-muted-foreground/50 font-medium mb-1.5">
                              Strengths
                            </p>
                            <ul className="space-y-1">
                              {results.positiveFactors.map((f, i) => (
                                <li
                                  key={i}
                                  className="text-[13px] text-foreground/60 leading-snug flex items-start gap-2"
                                >
                                  <span className="text-muted-foreground/40 mt-0.5 shrink-0">
                                    +
                                  </span>
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {results.negativeFactors.length > 0 && (
                          <div>
                            <p className="text-[11px] text-muted-foreground/50 font-medium mb-1.5">
                              Risks
                            </p>
                            <ul className="space-y-1">
                              {results.negativeFactors.map((f, i) => (
                                <li
                                  key={i}
                                  className="text-[13px] text-foreground/60 leading-snug flex items-start gap-2"
                                >
                                  <span className="text-muted-foreground/40 mt-0.5 shrink-0">
                                    −
                                  </span>
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Insights */}
                  {lead.valuation_insights &&
                    Array.isArray(lead.valuation_insights) &&
                    lead.valuation_insights.length > 0 && (
                      <div>
                        <p className="text-[11px] text-muted-foreground/50 font-medium mb-1.5">
                          Insights
                        </p>
                        <ul className="space-y-1.5">
                          {lead.valuation_insights.map((insight, i) => (
                            <li key={i} className="text-[13px] text-foreground/60 leading-relaxed">
                              {String(insight)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </Section>
            )}

            {/* Calculator Inputs */}
            {inputs.length > 0 && (
              <Section
                title="Calculator Inputs"
                summary={`${inputs.reduce((sum, g) => sum + g.fields.length, 0)}`}
              >
                <div className="space-y-4">
                  {inputs.map((group) => (
                    <div key={group.groupName}>
                      <p className="text-[11px] text-muted-foreground/50 font-medium mb-1.5">
                        {group.groupName}
                      </p>
                      <div className="divide-y divide-border/10">
                        {group.fields.map((field, idx) => (
                          <div key={idx} className="flex justify-between items-start gap-3 py-2">
                            <span className="text-[13px] text-muted-foreground/70 min-w-0 flex-1">
                              {field.question}
                            </span>
                            <span className="text-[13px] text-foreground shrink-0 text-right max-w-[200px]">
                              {formatDisplayValue(field.question, field.label)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Calculator Specific Data */}
            {lead.calculator_specific_data &&
              typeof lead.calculator_specific_data === 'object' &&
              Object.keys(lead.calculator_specific_data).length > 0 && (
                <Section title="Calculator Data">
                  <div className="divide-y divide-border/10">
                    {Object.entries(lead.calculator_specific_data as Record<string, unknown>).map(
                      ([key, val]) => {
                        if (val === null || val === undefined || val === '') return null;
                        return (
                          <DetailRow
                            key={key}
                            label={formatFieldLabel(key)}
                            value={formatDisplayValue(key, val)}
                          />
                        );
                      },
                    )}
                  </div>
                </Section>
              )}

            {/* Session & Attribution */}
            {(lead.session_metadata || lead.cta_clicked != null) &&
              (() => {
                const sm = (lead.session_metadata ?? {}) as Record<string, unknown>;
                const hasSessionData = Object.keys(sm).length > 0;
                if (!hasSessionData && lead.cta_clicked == null) return null;

                const deviceLabel =
                  [
                    sm.device_type || sm.device,
                    sm.screen_width && sm.screen_height
                      ? `${sm.screen_width}×${sm.screen_height}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || null;
                const browserLabel =
                  [sm.browser, sm.browser_version].filter(Boolean).join(' ') || null;
                const referrerUrl = (sm.referrer_url || sm.referrer) as string | undefined;
                const truncatedReferrer =
                  referrerUrl && referrerUrl.length > 50
                    ? referrerUrl.slice(0, 50) + '…'
                    : referrerUrl;
                const sessionStarted = sm.session_started_at as string | undefined;

                return (
                  <Section title="Session & Attribution">
                    <div className="divide-y divide-border/10">
                      {deviceLabel ? <DetailRow label="Device" value={deviceLabel} /> : null}
                      {browserLabel ? <DetailRow label="Browser" value={browserLabel} /> : null}
                      {sm.os ? <DetailRow label="OS" value={String(sm.os)} /> : null}
                      {sm.language ? (
                        <DetailRow label="Language" value={String(sm.language)} />
                      ) : null}
                      {sm.timezone ? (
                        <DetailRow label="Timezone" value={String(sm.timezone)} />
                      ) : null}
                      {sm.is_embed != null ? (
                        <DetailRow label="Embedded" value={sm.is_embed ? 'Yes (iframe)' : 'No'} />
                      ) : null}
                      {sm.user_location ? (
                        <DetailRow label="Session Location" value={String(sm.user_location)} />
                      ) : null}
                      {sessionStarted ? (
                        <DetailRow
                          label="Session Started"
                          value={format(new Date(sessionStarted), 'MMM d, yyyy h:mm a')}
                        />
                      ) : null}
                      {lead.cta_clicked != null ? (
                        <DetailRow label="CTA Clicked" value={lead.cta_clicked ? 'Yes' : 'No'} />
                      ) : null}
                      {sm.is_completed != null ? (
                        <DetailRow label="Completed" value={sm.is_completed ? 'Yes' : 'No'} />
                      ) : null}
                      {sm.drop_off_step ? (
                        <DetailRow label="Drop-off Step" value={String(sm.drop_off_step)} />
                      ) : null}
                      {sm.completed_at ? (
                        <DetailRow
                          label="Session Completed"
                          value={format(new Date(String(sm.completed_at)), 'MMM d, yyyy h:mm a')}
                        />
                      ) : null}
                      {Boolean(
                        sm.utm_source ||
                        sm.utm_medium ||
                        sm.utm_campaign ||
                        sm.utm_content ||
                        sm.utm_term,
                      ) && (
                        <>
                          <div className="pt-2 pb-1">
                            <p className="text-[11px] text-muted-foreground/50 font-medium">
                              Attribution
                            </p>
                          </div>
                          {sm.utm_source ? (
                            <DetailRow label="Source" value={String(sm.utm_source)} />
                          ) : null}
                          {sm.utm_medium ? (
                            <DetailRow label="Medium" value={String(sm.utm_medium)} />
                          ) : null}
                          {sm.utm_campaign ? (
                            <DetailRow label="Campaign" value={String(sm.utm_campaign)} />
                          ) : null}
                          {sm.utm_content ? (
                            <DetailRow label="Content" value={String(sm.utm_content)} />
                          ) : null}
                          {sm.utm_term ? (
                            <DetailRow label="Term" value={String(sm.utm_term)} />
                          ) : null}
                        </>
                      )}
                      {referrerUrl ? (
                        <DetailRow
                          label="Referrer"
                          value={
                            <a
                              href={referrerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline truncate max-w-[220px] inline-block text-[13px]"
                            >
                              {truncatedReferrer}
                            </a>
                          }
                        />
                      ) : null}
                      {sm.user_agent ? (
                        <details className="py-2">
                          <summary className="text-[11px] text-muted-foreground/50 cursor-pointer hover:text-foreground">
                            User Agent
                          </summary>
                          <p className="text-[10px] text-muted-foreground/40 mt-1 break-all leading-relaxed">
                            {String(sm.user_agent)}
                          </p>
                        </details>
                      ) : null}
                    </div>
                  </Section>
                );
              })()}

            {/* Tags */}
            {lead.tags && typeof lead.tags === 'object' && Object.keys(lead.tags).length > 0 && (
              <Section title="Tags">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(lead.tags as Record<string, unknown>).map(([key, val]) => (
                    <Badge
                      key={key}
                      variant="outline"
                      className="text-[11px] text-muted-foreground/60 border-border/30"
                    >
                      {key}: {String(val)}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}

            {/* Admin */}
            {(lead.calculator_session_id ||
              lead.source_submission_id ||
              lead.deal_owner_id ||
              lead.synced_at ||
              lead.listing_description ||
              lead.needs_buyer_search ||
              lead.needs_buyer_universe ||
              lead.need_to_contact_owner ||
              lead.needs_owner_contact ||
              lead.is_archived) && (
              <Section title="Admin">
                <div className="divide-y divide-border/10">
                  {lead.calculator_session_id && (
                    <DetailRow
                      label="Session ID"
                      value={
                        <span className="font-mono text-[10px]">{lead.calculator_session_id}</span>
                      }
                    />
                  )}
                  {lead.source_submission_id && (
                    <DetailRow
                      label="Submission ID"
                      value={
                        <span className="font-mono text-[10px]">{lead.source_submission_id}</span>
                      }
                    />
                  )}
                  {lead.deal_owner_id && (
                    <DetailRow
                      label="Deal Owner ID"
                      value={<span className="font-mono text-[10px]">{lead.deal_owner_id}</span>}
                    />
                  )}
                  {lead.listing_description && (
                    <DetailRow
                      label="Listing Description"
                      value={
                        <span className="text-[10px] max-w-[250px] truncate inline-block">
                          {lead.listing_description}
                        </span>
                      }
                    />
                  )}
                  {lead.needs_buyer_search && <DetailRow label="Needs Buyer Search" value="Yes" />}
                  {lead.needs_buyer_universe && (
                    <DetailRow label="Needs Buyer Universe" value="Yes" />
                  )}
                  {(lead.need_to_contact_owner || lead.needs_owner_contact) && (
                    <DetailRow label="Needs Owner Contact" value="Yes" />
                  )}
                  {lead.is_archived && <DetailRow label="Archived" value="Yes" />}
                </div>
              </Section>
            )}

            {/* Status badges — minimal, at bottom */}
            {(lead.calculator_type ||
              lead.pushed_to_all_deals ||
              lead.not_a_fit ||
              lead.is_priority_target) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-border/20">
                {lead.calculator_type && calculatorBadge(lead.calculator_type)}
                {lead.pushed_to_all_deals && (
                  <Badge
                    variant="outline"
                    className="text-[11px] text-muted-foreground/60 border-border/30"
                  >
                    In Active Deals
                  </Badge>
                )}
                {lead.not_a_fit && (
                  <Badge
                    variant="outline"
                    className="text-[11px] text-muted-foreground/60 border-border/30"
                  >
                    Not a Fit
                  </Badge>
                )}
                {lead.is_priority_target && (
                  <Badge
                    variant="outline"
                    className="text-[11px] text-muted-foreground/60 border-border/30"
                  >
                    Priority
                  </Badge>
                )}
                {lead.marketing_opt_in != null && (
                  <span className="text-[11px] text-muted-foreground/40">
                    Marketing: {lead.marketing_opt_in ? 'Opted in' : 'Not opted in'}
                    {(lead.submission_count ?? 0) > 1 && ` · ${lead.submission_count} submissions`}
                  </span>
                )}
              </div>
            )}

            {/* ─── Call Activity (PhoneBurner) ─── */}
            <Section title="Call Activity" defaultOpen>
              <CallActivityList valuationLeadId={lead.id} leadEmail={primaryEmail} />
            </Section>

            {/* Timestamps */}
            <div className="text-[11px] text-muted-foreground/30 space-y-0.5 pt-2 border-t border-border/20">
              <p className="pt-2">
                Submitted: {format(new Date(lead.created_at), 'MMM d, yyyy h:mm a')}
              </p>
              {lead.updated_at && lead.updated_at !== lead.created_at && (
                <p>Updated: {format(new Date(lead.updated_at), 'MMM d, yyyy h:mm a')}</p>
              )}
              {lead.initial_unlock_at && (
                <p>First seen: {format(new Date(lead.initial_unlock_at), 'MMM d, yyyy h:mm a')}</p>
              )}
              {lead.pushed_to_all_deals_at && (
                <p>Pushed: {format(new Date(lead.pushed_to_all_deals_at), 'MMM d, yyyy h:mm a')}</p>
              )}
              {lead.synced_at && (
                <p>Synced: {format(new Date(lead.synced_at), 'MMM d, yyyy h:mm a')}</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* ─── Actions Footer ─── */}
        <div className="px-6 py-3 border-t border-border shrink-0 flex items-center gap-3 bg-background/80 backdrop-blur-sm">
          {lead.pushed_listing_id ? (
            <Button
              onClick={() => onViewDeal(lead.pushed_listing_id!)}
              className="flex-1 h-10 text-[13px] font-medium"
            >
              View Deal <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          ) : (
            <Button
              onClick={() => onPushToDeals([lead.id])}
              disabled={isPushing}
              className="flex-1 h-10 text-[13px] font-medium"
            >
              <DollarSign className="h-3.5 w-3.5 mr-1.5" />
              Push to Active Deals
            </Button>
          )}
          {!lead.not_a_fit && (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 text-muted-foreground"
              onClick={() => onMarkNotFit([lead.id])}
              title="Mark as Not a Fit"
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
