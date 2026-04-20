import { useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ExternalLink,
  Mail,
  User,
  Calendar,
  MapPin,
  Building2,
  Briefcase,
  Users,
  Sparkles,
  Target,
  TrendingUp,
  Globe,
  ArrowRight,
  Clock,
  DollarSign,
  ThumbsDown,
  Star,
  Award,
  Send,
  CheckCircle2,
  Ban,
  Pencil,
} from 'lucide-react';
import { MatchToolLeadOutreachDialog } from '@/components/remarketing/MatchToolLeadOutreachDialog';
import { useMatchToolLeadOutreachTracking } from '@/hooks/admin/use-match-tool-lead-outreach-tracking';
import { ClickToDialPhone } from '@/components/shared/ClickToDialPhone';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isValidEmail } from '@/lib/email-validation';
import type { MatchToolLead } from './types';

interface MatchToolLeadPanelProps {
  lead: MatchToolLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrich: (lead_id: string, website: string, opts?: { force?: boolean }) => void;
  isEnriching: boolean;
  onPushToDeals?: (leadIds: string[]) => void;
  onMarkNotFit?: (leadIds: string[]) => void;
  onViewDeal?: (listingId: string) => void;
  isPushing?: boolean;
}

function cleanDomain(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

function getDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname;
  } catch {
    return url;
  }
}

const REVENUE_LABELS: Record<string, string> = {
  under_500k: '<$500K',
  '500k_1m': '$500K–1M',
  '1m_5m': '$1M–5M',
  '5m_10m': '$5M–10M',
  '10m_25m': '$10M–25M',
  '25m_50m': '$25M–50M',
  '50m_plus': '$50M+',
};

const PROFIT_LABELS: Record<string, string> = {
  under_100k: '<$100K',
  '100k_500k': '$100K–500K',
  '500k_1m': '$500K–1M',
  '1m_3m': '$1M–3M',
  '3m_5m': '$3M–5M',
  '5m_plus': '$5M+',
};

const TIMELINE_CONFIG: Record<string, { label: string; color: string }> = {
  less_than_6_months: {
    label: '<6 months',
    color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  '6_to_12_months': {
    label: '6–12 months',
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  '1_to_2_years': { label: '1–2 years', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  '2_plus_years': { label: '2+ years', color: 'bg-muted text-muted-foreground' },
  not_sure: { label: 'Not sure', color: 'bg-muted text-muted-foreground' },
};

const FUNNEL_STEPS = ['hero', 'basics', 'financials', 'results', 'form'];

export function MatchToolLeadPanel({
  lead,
  open,
  onOpenChange,
  onEnrich,
  isEnriching,
  onPushToDeals,
  onMarkNotFit,
  onViewDeal,
  isPushing,
}: MatchToolLeadPanelProps) {
  const enrichedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (open && lead && !lead.enrichment_data && !enrichedIdsRef.current.has(lead.id)) {
      enrichedIdsRef.current.add(lead.id);
      onEnrich(lead.id, lead.website);
    }
  }, [open, lead?.id]);

  if (!lead) return null;

  const rawEnrichment = lead.enrichment_data as Record<string, any> | null;
  // Treat an empty heuristic shell (no company_name AND no one_liner) as "no enrichment"
  // so the UI shows the Retry CTA instead of a blank card.
  const isEmptyEnrichment =
    !!rawEnrichment && !rawEnrichment.company_name && !rawEnrichment.one_liner;
  const enrichment = isEmptyEnrichment ? null : rawEnrichment;
  const domain = getDomain(lead.website);
  const websiteUrl = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;
  const raw = lead.raw_inputs as Record<string, any> | null;

  // Seller intent data
  const exitTiming = raw?.exit_timing || raw?.timeline || lead.timeline;
  const intentScore = raw?.intent_score ? Number(raw.intent_score) : null;
  const converted = raw?.converted === true || lead.submission_stage === 'full_form';
  const matchCount = raw?.match_count ? Number(raw.match_count) : null;

  // Business profile
  const selfReportedName = raw?.company_name || raw?.business_name;
  const sector = raw?.sector;

  // Location
  const city = raw?.city;
  const region = raw?.region;
  const country = raw?.country;
  const location = city && region ? `${city}, ${region}` : city || region || country || null;
  const lat = raw?.latitude;
  const lon = raw?.longitude;

  // Traffic source
  const trafficSource = raw?.source;
  const utmSource = raw?.utm_source;
  const utmMedium = raw?.utm_medium;
  const utmCampaign = raw?.utm_campaign;
  const hasUtm = utmSource || utmMedium || utmCampaign;

  // Funnel journey
  const reachedStep = raw?.reached_step;
  const reachedStepIndex = reachedStep ? FUNNEL_STEPS.indexOf(reachedStep) : -1;

  const timelineConfig = exitTiming
    ? TIMELINE_CONFIG[exitTiming] || { label: exitTiming, color: 'bg-muted text-muted-foreground' }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px] p-0 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-5">
            {/* Header */}
            <SheetHeader className="space-y-3">
              <div className="flex items-start gap-3">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                  alt=""
                  className="h-10 w-10 rounded-lg border border-border/50 bg-muted/30 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-base font-semibold tracking-tight truncate">
                    {enrichment?.company_name ||
                      selfReportedName ||
                      lead.business_name ||
                      cleanDomain(lead.website)}
                  </SheetTitle>
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                  >
                    {cleanDomain(lead.website)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {converted ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Wants Buyers
                  </span>
                ) : lead.submission_stage === 'financials' ? (
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                    Financials
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Browse
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground/60">
                  {new Date(lead.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </SheetHeader>

            {/* ── Seller Intent ── */}
            {(timelineConfig || intentScore !== null || converted) && (
              <Section title="Seller Intent">
                <div className="space-y-2.5">
                  {timelineConfig && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground">Exit Timeline</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${timelineConfig.color}`}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {timelineConfig.label}
                      </span>
                    </div>
                  )}
                  {intentScore !== null && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-muted-foreground">Intent Score</span>
                        <span className="text-[13px] font-semibold text-foreground">
                          {intentScore}/100
                        </span>
                      </div>
                      <Progress value={intentScore} className="h-1.5" />
                    </div>
                  )}
                  {converted && (
                    <div className="flex items-center gap-2 rounded-md bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                      <Target className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                        Submitted form — wants buyer list
                      </span>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── Contact Info ── */}
            {(lead.full_name || lead.email || lead.phone) && (
              <Section title="Contact">
                {lead.full_name && <InfoRow icon={User} label={lead.full_name} />}
                {lead.email && (
                  <InfoRow icon={Mail} label={lead.email} href={`mailto:${lead.email}`} />
                )}
                {lead.phone && (
                  <ClickToDialPhone
                    phone={lead.phone}
                    name={lead.full_name || undefined}
                    email={lead.email || undefined}
                    company={lead.business_name || undefined}
                    size="sm"
                  />
                )}
              </Section>
            )}

            {/* ── Business Profile + Financials ── */}
            {(lead.revenue || lead.profit || sector) && (
              <Section title="Business Profile">
                {sector && <InfoRow icon={Building2} label={sector} />}
                {lead.revenue && (
                  <InfoRow
                    icon={Briefcase}
                    label={`Revenue: ${REVENUE_LABELS[lead.revenue] || lead.revenue}`}
                  />
                )}
                {lead.profit && (
                  <InfoRow
                    icon={TrendingUp}
                    label={`Profit: ${PROFIT_LABELS[lead.profit] || lead.profit}`}
                  />
                )}
              </Section>
            )}

            {/* ── Buyer Match Results ── */}
            {matchCount !== null && matchCount > 0 && (
              <Section title="Match Results">
                <div className="flex items-center gap-3 rounded-md bg-primary/5 border border-primary/10 px-3 py-2.5">
                  <Users className="h-4 w-4 text-primary flex-shrink-0" />
                  <div>
                    <span className="text-[15px] font-semibold text-foreground">{matchCount}</span>
                    <span className="text-[12px] text-muted-foreground ml-1.5">buyers matched</span>
                  </div>
                </div>
              </Section>
            )}

            {/* ── Location ── */}
            {location && (
              <Section title="Visitor Location">
                <InfoRow icon={MapPin} label={location} />
                {lat && lon && (
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-1 ml-5.5"
                  >
                    View on map <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </Section>
            )}

            {/* ── Funnel Journey ── */}
            {reachedStepIndex >= 0 && (
              <Section title="Funnel Journey">
                <div className="flex items-center gap-1">
                  {FUNNEL_STEPS.map((step, i) => (
                    <div key={step} className="flex items-center">
                      <div
                        className={`flex items-center justify-center rounded-full h-6 px-2 text-[10px] font-medium transition-colors ${
                          i <= reachedStepIndex
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted/50 text-muted-foreground/40'
                        }`}
                      >
                        {step}
                      </div>
                      {i < FUNNEL_STEPS.length - 1 && (
                        <ArrowRight
                          className={`h-2.5 w-2.5 mx-0.5 ${
                            i < reachedStepIndex ? 'text-primary/40' : 'text-muted-foreground/20'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {lead.submission_count && lead.submission_count > 1 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {lead.submission_count} visits
                  </p>
                )}
              </Section>
            )}

            {/* ── Traffic Source ── */}
            {(trafficSource || hasUtm) && (
              <Section title="Traffic Source">
                {trafficSource && <InfoRow icon={Globe} label={`Source: ${trafficSource}`} />}
                {utmSource && <InfoRow icon={Globe} label={`UTM Source: ${utmSource}`} />}
                {utmMedium && <InfoRow icon={Globe} label={`UTM Medium: ${utmMedium}`} />}
                {utmCampaign && <InfoRow icon={Globe} label={`UTM Campaign: ${utmCampaign}`} />}
              </Section>
            )}

            {/* ── Company Intelligence ── */}
            <Section title="Company Intelligence">
              {isEnriching && !enrichment ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : isEnriching ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <p className="text-[11px] text-muted-foreground/60 mt-2">
                    Generating company intel…
                  </p>
                </div>
              ) : enrichment ? (
                <div className="space-y-3">
                  {enrichment.one_liner && (
                    <p className="text-[13px] text-foreground/90 leading-relaxed">
                      {enrichment.one_liner}
                    </p>
                  )}
                  {enrichment.industry && <InfoRow icon={Building2} label={enrichment.industry} />}
                  {enrichment.geography && <InfoRow icon={MapPin} label={enrichment.geography} />}
                  {enrichment.employee_estimate && (
                    <InfoRow icon={Users} label={`~${enrichment.employee_estimate} employees`} />
                  )}
                  {enrichment.year_founded && (
                    <InfoRow icon={Calendar} label={`Founded ${enrichment.year_founded}`} />
                  )}
                  {enrichment.revenue_estimate && (
                    <InfoRow
                      icon={Briefcase}
                      label={`Est. revenue: ${enrichment.revenue_estimate}`}
                    />
                  )}

                  {enrichment.services?.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[11px] font-medium text-muted-foreground/70 mb-1.5">
                        Services
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(enrichment.services as string[]).map((s: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {enrichment.notable_signals?.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[11px] font-medium text-muted-foreground/70 mb-1.5">
                        Signals
                      </p>
                      <div className="space-y-1">
                        {(enrichment.notable_signals as string[]).map((s: string, i: number) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <Sparkles className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span className="text-[12px] text-foreground/70">{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[12px] text-muted-foreground/50">
                    Couldn't generate intel for this website
                  </p>
                  <button
                    onClick={() => lead && onEnrich(lead.id, lead.website, { force: true })}
                    className="text-[11px] text-primary hover:text-primary/80 underline"
                  >
                    Retry enrichment
                  </button>
                </div>
              )}
            </Section>

            {/* ── Score & Quality ── */}
            {(lead.lead_score != null || lead.quality_label || lead.is_priority_target) && (
              <Section title="Score & Quality">
                {lead.lead_score != null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground">Lead Score</span>
                      <span className="text-[13px] font-semibold text-foreground">
                        {lead.lead_score}/100
                      </span>
                    </div>
                    <Progress value={lead.lead_score} className="h-1.5" />
                  </div>
                )}
                {lead.quality_label && (
                  <div className="flex items-center gap-2 pt-1">
                    <Award className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[12px] text-foreground/80">{lead.quality_label}</span>
                  </div>
                )}
                {lead.is_priority_target && (
                  <div className="flex items-center gap-2 pt-1">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-[12px] font-medium text-amber-700 dark:text-amber-400">
                      Priority Target
                    </span>
                  </div>
                )}
                {lead.scoring_notes && (
                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-1">
                    {lead.scoring_notes}
                  </p>
                )}
              </Section>
            )}

            {/* ── Owner Outreach ── */}
            {isValidEmail(lead.email) && !lead.excluded && (
              <Section title="Owner Outreach">
                <OwnerOutreachBlock lead={lead} />
              </Section>
            )}

            {/* ── Admin metadata ── */}
            {(lead.deal_owner_id ||
              lead.pushed_listing_id ||
              lead.status ||
              lead.exclusion_reason) && (
              <Section title="Admin">
                <div className="space-y-1.5">
                  {lead.status && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/60">Status</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground/70 border-border/30"
                      >
                        {lead.status}
                      </Badge>
                    </div>
                  )}
                  {lead.pushed_listing_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/60">Listing ID</span>
                      <span className="font-mono text-[10px] text-muted-foreground/70 truncate max-w-[200px]">
                        {lead.pushed_listing_id}
                      </span>
                    </div>
                  )}
                  {lead.deal_owner_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/60">Deal Owner</span>
                      <span className="font-mono text-[10px] text-muted-foreground/70 truncate max-w-[200px]">
                        {lead.deal_owner_id}
                      </span>
                    </div>
                  )}
                  {lead.exclusion_reason && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground/60 shrink-0">
                        Excluded
                      </span>
                      <span className="text-[11px] text-muted-foreground/70 text-right">
                        {lead.exclusion_reason}
                      </span>
                    </div>
                  )}
                  {lead.excluded && (
                    <div className="pt-1.5">
                      <button
                        onClick={() => onEnrich(lead.id, lead.website, { force: true })}
                        disabled={isEnriching}
                        className="text-[11px] text-primary hover:text-primary/80 underline disabled:opacity-50"
                      >
                        Re-evaluate quarantine
                      </button>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── Status badges ── */}
            {(lead.pushed_to_all_deals ||
              lead.not_a_fit ||
              lead.is_priority_target ||
              lead.excluded ||
              lead.is_archived) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-border/20">
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
                {lead.excluded && (
                  <Badge
                    variant="outline"
                    className="text-[11px] text-destructive/70 border-destructive/30"
                  >
                    Quarantined
                  </Badge>
                )}
                {lead.is_archived && (
                  <Badge
                    variant="outline"
                    className="text-[11px] text-muted-foreground/60 border-border/30"
                  >
                    Archived
                  </Badge>
                )}
              </div>
            )}

            {/* ── Raw payload (collapsible) ── */}
            {raw && Object.keys(raw).length > 0 && (
              <Section title="Raw Payload">
                <details className="group">
                  <summary className="text-[11px] text-muted-foreground/60 cursor-pointer hover:text-muted-foreground">
                    View raw submission data
                  </summary>
                  <pre className="mt-2 text-[10px] text-muted-foreground/70 bg-muted/30 rounded-md p-2.5 overflow-x-auto leading-relaxed max-h-64">
                    {JSON.stringify(raw, null, 2)}
                  </pre>
                </details>
              </Section>
            )}

            {/* ── Timestamps ── */}
            <div className="text-[11px] text-muted-foreground/30 space-y-0.5 pt-2 border-t border-border/20">
              <p className="pt-2">
                Submitted: {format(new Date(lead.created_at), 'MMM d, yyyy h:mm a')}
              </p>
              {lead.updated_at && lead.updated_at !== lead.created_at && (
                <p>Updated: {format(new Date(lead.updated_at), 'MMM d, yyyy h:mm a')}</p>
              )}
              {lead.pushed_to_all_deals_at && (
                <p>Pushed: {format(new Date(lead.pushed_to_all_deals_at), 'MMM d, yyyy h:mm a')}</p>
              )}
              {lead.last_enriched_at && (
                <p>Enriched: {format(new Date(lead.last_enriched_at), 'MMM d, yyyy h:mm a')}</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* ─── Actions Footer ─── */}
        {(onPushToDeals || onMarkNotFit || onViewDeal) && (
          <div className="px-6 py-3 border-t border-border shrink-0 flex items-center gap-3 bg-background/80 backdrop-blur-sm">
            {lead.pushed_listing_id && onViewDeal ? (
              <Button
                onClick={() => onViewDeal(lead.pushed_listing_id!)}
                className="flex-1 h-10 text-[13px] font-medium"
              >
                View Deal <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            ) : onPushToDeals ? (
              <Button
                onClick={() => onPushToDeals([lead.id])}
                disabled={isPushing}
                className="flex-1 h-10 text-[13px] font-medium"
              >
                <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                Push to Active Deals
              </Button>
            ) : null}
            {!lead.not_a_fit && onMarkNotFit && (
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
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<any>;
  label: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
      <span className="text-[13px] text-foreground/80 truncate">{label}</span>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="hover:text-primary transition-colors block">
        {content}
      </a>
    );
  }
  return content;
}

function OwnerOutreachBlock({ lead }: { lead: MatchToolLead }) {
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: tracking } = useMatchToolLeadOutreachTracking(lead.id);

  const status = (tracking?.emailStatus ?? lead.outreach_email_status) as
    | 'sent'
    | 'failed'
    | 'suppressed'
    | null;
  const sentAt = tracking?.emailSentAt ?? lead.outreach_email_sent_at;
  const hookKind = lead.outreach_hook_kind;
  const sendCount = tracking?.sendCount ?? lead.outreach_send_count ?? 0;
  const hasSent = status === 'sent' || sendCount > 0;

  const handleQuickSend = async (isResend: boolean) => {
    if (sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-match-tool-lead-outreach', {
        body: { matchToolLeadId: lead.id, isResend },
      });
      if (error) throw error;
      const skipped = (data as { skipped?: boolean; reason?: string } | null)?.skipped;
      if (skipped) {
        toast.info(`Skipped: ${(data as { reason?: string }).reason ?? 'no send'}`);
      } else {
        toast.success(isResend ? 'Resent intro email' : 'Intro email sent');
      }
    } catch (e) {
      toast.error(`Failed to send: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  const dialog = (
    <MatchToolLeadOutreachDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      matchToolLeadId={lead.id}
      leadEmail={lead.email}
      leadName={lead.full_name}
      businessName={lead.business_name}
      revenueBucket={lead.revenue}
      profitBucket={lead.profit}
      qualityTier={lead.quality_tier}
      industry={lead.industry}
      timeline={lead.timeline}
      enrichmentData={lead.enrichment_data}
      hasSent={hasSent}
    />
  );

  if (status === 'suppressed') {
    return (
      <div className="flex items-center gap-2">
        <Ban className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="text-[12px] text-muted-foreground">Suppressed (unsubscribed/bounced)</span>
      </div>
    );
  }

  if (hasSent) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[12px] text-foreground/80">
            Intro sent {sentAt ? formatDistanceToNow(new Date(sentAt), { addSuffix: true }) : ''}
            {hookKind ? ` · ${hookKind.replace(/_/g, ' ')}` : ''}
          </span>
        </div>
        {sendCount > 1 && (
          <p className="text-[11px] text-muted-foreground/60">{sendCount} total sends</p>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-7 text-[11px]" onClick={() => setDialogOpen(true)}>
            <Pencil className="h-3 w-3 mr-1.5" />
            Resend / edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => handleQuickSend(true)}
            disabled={sending}
          >
            <Send className="h-3 w-3 mr-1.5" />
            {sending ? 'Sending…' : 'Quick send'}
          </Button>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {status === 'failed' && (
        <p className="text-[11px] text-destructive/80">Last send failed. Retry below.</p>
      )}
      {!status && <p className="text-[11px] text-muted-foreground/60">No intro email sent yet.</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 text-[12px]" onClick={() => setDialogOpen(true)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Compose outreach
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-[12px]"
          onClick={() => handleQuickSend(false)}
          disabled={sending}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {sending ? 'Sending…' : 'Quick send'}
        </Button>
      </div>
      {dialog}
    </div>
  );
}
