/**
 * DealPipelineCard — Sidebar card representing a single deal in the buyer's pipeline.
 *
 * Each card occupies the left column of the My Deals page.  Clicking a card
 * selects it and populates the right-hand detail panel.
 *
 * ┌─────────────────────────────────────────┐
 * │  [Icon]  Multi Division Collision…  ●3  │
 * │          Auto Services · $1.2M EBITDA   │
 * │  ███████ ██████ ░░░░░ ░░░░░ ░░░░ ░░░░  │  ← pipeline bar
 * │  [NDA Pending]      Updated 3 days ago  │
 * │                           [Sign NDA →]  │  ← per-deal CTA
 * └─────────────────────────────────────────┘
 *
 * Design decisions:
 *
 *   • **Gold left-border accent** on the selected card — a thin 3px
 *     vertical gold bar that instantly tells the buyer which deal is
 *     active.  More distinctive than the previous border-darkening.
 *
 *   • **Per-deal CTA button** — the biggest UX win of the redesign.
 *     Instead of just showing a status pill, the card includes a
 *     contextual action: "Sign NDA →", "Sign Agreement →", "View Deal Memo →",
 *     etc.  This reduces clicks-to-action from 3 (click card → find tab
 *     → find action) to 1.
 *
 *   • **Pipeline progress bar** — 6 colored segments for the deal stages.
 *     Navy for completed, gold for current, light gray for future.
 *     Each segment has a tooltip explaining the stage.
 *
 *   • **SVG category icons** (not emojis) — kept from the original
 *     implementation because they're more professional for the M&A
 *     context.  The icon container switches to navy background when the
 *     card is selected.
 *
 *   • **EBITDA display** — shown instead of revenue, since EBITDA is
 *     the primary valuation metric buyers care about in deal scanning.
 *
 * Stage derivation:
 *   The current pipeline stage is computed from `request.status` +
 *   `ndaSigned` + `hasCim` (deal memo access).  This ensures the card
 *   always reflects the real deal state rather than stale cached data.
 */

import { formatDistanceToNow } from 'date-fns';
import { cn, formatCompactCurrency } from '@/lib/utils';
import { Clock, ArrowRight } from 'lucide-react';
import type { ConnectionRequest } from '@/types';
import {
  TechnologyIcon,
  HealthcareIcon,
  ManufacturingIcon,
  FinanceIcon,
  RetailIcon,
  RealEstateIcon,
  FoodBeverageIcon,
  ProfessionalServicesIcon,
  ConstructionIcon,
  TransportationIcon,
  EducationIcon,
  HospitalityIcon,
  EnergyIcon,
  MediaIcon,
  AutomotiveIcon,
  AgricultureIcon,
  TelecommunicationsIcon,
  ConsumerGoodsIcon,
  BusinessServicesIcon,
  DefaultCategoryIcon,
} from '@/components/icons/CategoryIcons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CONNECTION_STATUSES } from '@/constants';

/* ─── Pipeline stages (same 6-stage model as DealDetailHeader) ───────── */

const PIPELINE_STAGES = [
  { id: 'interested', label: 'Interested', description: 'You expressed interest in this deal' },
  {
    id: 'nda_signed',
    label: 'NDA Signed',
    description: 'Non-disclosure agreement has been signed',
  },
  {
    id: 'under_review',
    label: 'Under Review',
    description: 'Deal owner is reviewing your profile and interest',
  },
  {
    id: 'ioi_submitted',
    label: 'IOI Submitted',
    description: 'Indication of Interest has been submitted',
  },
  { id: 'loi', label: 'LOI', description: 'Letter of Intent stage' },
  { id: 'closed', label: 'Closed', description: 'Deal has been closed' },
] as const;

type PipelineStageId = (typeof PIPELINE_STAGES)[number]['id'];

/* ─── Props ────────────────────────────────────────────────────────────── */

interface DealPipelineCardProps {
  request: ConnectionRequest;
  isSelected: boolean;
  unreadCount: number;
  ndaSigned?: boolean;
  hasCim?: boolean;
  onSelect: () => void;
  pendingAction?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

/**
 * Map category string → SVG icon component.
 * Uses keyword matching against the full list of SourceCo category icons.
 */
function getCategoryIcon(category?: string) {
  if (!category) return DefaultCategoryIcon;
  const cat = category.toLowerCase();
  if (cat.includes('technology') || cat.includes('software')) return TechnologyIcon;
  if (cat.includes('healthcare') || cat.includes('medical')) return HealthcareIcon;
  if (cat.includes('manufacturing')) return ManufacturingIcon;
  if (cat.includes('finance') || cat.includes('insurance')) return FinanceIcon;
  if (cat.includes('retail') || cat.includes('e-commerce')) return RetailIcon;
  if (cat.includes('real estate')) return RealEstateIcon;
  if (cat.includes('food') || cat.includes('beverage')) return FoodBeverageIcon;
  if (cat.includes('professional services')) return ProfessionalServicesIcon;
  if (cat.includes('construction')) return ConstructionIcon;
  if (cat.includes('transportation') || cat.includes('logistics')) return TransportationIcon;
  if (cat.includes('education')) return EducationIcon;
  if (cat.includes('hospitality') || cat.includes('tourism')) return HospitalityIcon;
  if (cat.includes('energy') || cat.includes('utilities')) return EnergyIcon;
  if (cat.includes('media') || cat.includes('entertainment')) return MediaIcon;
  if (cat.includes('automotive')) return AutomotiveIcon;
  if (cat.includes('agriculture')) return AgricultureIcon;
  if (cat.includes('telecommunications')) return TelecommunicationsIcon;
  if (cat.includes('consumer goods')) return ConsumerGoodsIcon;
  if (cat.includes('business services')) return BusinessServicesIcon;
  return DefaultCategoryIcon;
}

/**
 * Derive the current pipeline stage from deal state signals.
 *
 * Priority order: hasCim (deal memo access) > ndaSigned > interested.
 * Rejected deals always show as 'interested' (first stage).
 */
function getCurrentStage(status: string, ndaSigned?: boolean, hasCim?: boolean): PipelineStageId {
  if (status === CONNECTION_STATUSES.REJECTED) return 'interested';
  if (hasCim) return 'under_review';
  if (ndaSigned) return 'nda_signed';
  return 'interested';
}

function getStageIndex(stageId: PipelineStageId): number {
  return PIPELINE_STAGES.findIndex((s) => s.id === stageId);
}

/**
 * Stage pill styling — color-coded badge for the current stage.
 *
 * Uses amber for early stages (interest/NDA), blue for mid-stages
 * (review/IOI), green for late stages (LOI/Closed).
 */
const stageColors: Record<PipelineStageId, { bg: string; text: string; border: string }> = {
  interested: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  nda_signed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  under_review: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  ioi_submitted: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  loi: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  closed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};
void stageColors;

/**
 * Unified connection-request status label + colors.
 *
 * These labels match the helpers in BuyerMessages/helpers.ts and the
 * step labels in DealProcessSteps.tsx so that buyers see consistent
 * terminology across every surface: message threads, deal cards, and
 * the pipeline stepper.
 *
 *   pending  → "Under Review"  (amber)
 *   approved → "Connected"     (green)
 *   rejected → "Not Selected"  (muted)
 */
function getRequestStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Under Review';
    case 'approved':
      return 'Connected';
    case 'rejected':
      return 'Not Selected';
    default:
      return 'Under Review';
  }
}

function getRequestStatusColors(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'pending':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'approved':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'rejected':
      return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' };
    default:
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  }
}

/**
 * Determine the contextual CTA label shown on the card.
 *
 * The CTA tells the buyer exactly what they should do next for this
 * deal.  Returns null if no immediate action is available (e.g. under
 * review with nothing pending).
 */
function getCtaLabel(status: string, ndaSigned?: boolean, hasCim?: boolean): string | null {
  if (status === CONNECTION_STATUSES.REJECTED) return null;
  if (!ndaSigned) return 'Sign NDA';
  if (hasCim) return 'View Deal Memo';
  // NDA signed but not yet under review
  return null;
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function DealPipelineCard({
  request,
  isSelected,
  unreadCount,
  ndaSigned,
  hasCim,
  onSelect,
  pendingAction,
}: DealPipelineCardProps) {
  const CategoryIcon = getCategoryIcon(request.listing?.category);
  const currentStage = getCurrentStage(request.status, ndaSigned, hasCim);
  const currentStageIndex = getStageIndex(currentStage);
  const isRejected = request.status === CONNECTION_STATUSES.REJECTED;

  // Unified connection-request status (shown in the pill at the bottom)
  const requestStatusLabel = getRequestStatusLabel(request.status);
  const requestStatusColors = getRequestStatusColors(request.status);

  const ebitdaDisplay = request.listing?.ebitda
    ? formatCompactCurrency(request.listing.ebitda)
    : null;

  const ctaLabel = getCtaLabel(request.status, ndaSigned, hasCim);

  return (
    <TooltipProvider>
      <button
        onClick={onSelect}
        className={cn(
          'w-full text-left rounded-xl border transition-all duration-200 p-4 group relative',
          isSelected
            ? 'border-[#0f1f3d] bg-[#fdfcfa] shadow-[0_4px_16px_rgba(15,31,61,0.10)]'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.04)]',
          isRejected && 'opacity-60',
        )}
      >
        {/* Gold left-border accent on selected card */}
        {isSelected && (
          <div className="absolute left-[-1px] top-3 bottom-3 w-[3px] rounded-r-full bg-[#c9a84c]" />
        )}

        {/* Top row: Category icon + Title + Unread badge */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              isSelected ? 'bg-[#0f1f3d]' : 'bg-slate-100 group-hover:bg-slate-200',
            )}
          >
            <CategoryIcon
              className={cn('h-4.5 w-4.5', isSelected ? 'text-[#c9a84c]' : 'text-slate-600')}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#0f1f3d] truncate">
                {request.listing?.title || 'Untitled'}
              </h3>
              {unreadCount > 0 && (
                <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shrink-0">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>

            {/* Category + EBITDA */}
            <div className="flex items-center gap-2 mt-0.5">
              {request.listing?.category && (
                <span className="text-xs text-slate-500 truncate">{request.listing.category}</span>
              )}
              {ebitdaDisplay && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs font-medium text-slate-600">{ebitdaDisplay} EBITDA</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline progress bar — navy for done, gold for current, gray for future */}
        <div className="mt-3 flex items-center gap-0.5">
          {PIPELINE_STAGES.map((stage, i) => {
            const isCompleted = i <= currentStageIndex;
            const isCurrent = i === currentStageIndex;
            return (
              <Tooltip key={stage.id} delayDuration={200}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-all duration-300',
                      isRejected && isCompleted
                        ? 'bg-slate-300'
                        : isCompleted && isCurrent
                          ? 'bg-[#c9a84c]'
                          : isCompleted
                            ? 'bg-[#0f1f3d]'
                            : 'bg-slate-100',
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{stage.label}</p>
                  <p className="text-muted-foreground">{stage.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom row: Stage pill + Timestamp + CTA / Pending badge */}
        <div className="mt-2.5 flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
              `${requestStatusColors.bg} ${requestStatusColors.text} ${requestStatusColors.border}`,
            )}
          >
            {requestStatusLabel}
          </span>

          <span className="flex items-center gap-1 text-[10px] text-slate-400 ml-auto">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(request.updated_at || request.created_at), {
              addSuffix: true,
            })}
          </span>
        </div>

        {/* Per-deal CTA button — the key UX improvement */}
        {(ctaLabel || pendingAction) && !isRejected && (
          <div className="mt-2.5 flex items-center justify-between">
            {pendingAction && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                {pendingAction}
              </span>
            )}
            {ctaLabel && (
              <span className="inline-flex items-center gap-1 ml-auto text-[11px] font-semibold text-[#c9a84c] border border-[#c9a84c] px-2.5 py-1 rounded-md hover:bg-[#c9a84c] hover:text-white transition-colors">
                {ctaLabel}
                <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </div>
        )}
      </button>
    </TooltipProvider>
  );
}
