import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function scorePillClass(score: number | null): string {
  if (score == null) return 'bg-muted text-muted-foreground';
  if (score >= 80) return 'bg-emerald-100 text-emerald-800';
  if (score >= 60) return 'bg-blue-100 text-blue-800';
  if (score >= 40) return 'bg-amber-100 text-amber-800';
  if (score >= 20) return 'bg-orange-100 text-orange-800';
  return 'bg-muted text-muted-foreground';
}

export function exitTimingBadge(timing: string | null) {
  if (!timing) return null;
  const config: Record<string, { label: string; className: string }> = {
    now: { label: 'Exit Now', className: 'bg-red-50 text-red-700 border-red-200' },
    '1-2years': { label: '1-2 Years', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    exploring: { label: 'Exploring', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  };
  const c = config[timing] || {
    label: timing,
    className: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold px-1.5 py-0', c.className)}>
      {c.label}
    </Badge>
  );
}

export function qualityBadge(label: string | null) {
  if (!label) return null;
  const config: Record<string, string> = {
    'Very Strong': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Strong: 'bg-teal-50 text-teal-700 border-teal-200',
    Solid: 'bg-blue-50 text-blue-700 border-blue-200',
    Average: 'bg-amber-50 text-amber-700 border-amber-200',
    'Needs Work': 'bg-red-50 text-red-700 border-red-200',
  };
  const cls = config[label] || 'bg-muted text-muted-foreground border-border';
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold px-1.5 py-0', cls)}>
      {label}
    </Badge>
  );
}

export function calculatorBadge(type: string) {
  const config: Record<string, { label: string; className: string }> = {
    general: { label: 'General', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    auto_shop: { label: 'Auto Shop', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    hvac: { label: 'HVAC', className: 'bg-orange-50 text-orange-700 border-orange-200' },
    collision: { label: 'Collision', className: 'bg-purple-50 text-purple-700 border-purple-200' },
    specialty: { label: 'Specialty', className: 'bg-teal-50 text-teal-700 border-teal-200' },
    mechanical: {
      label: 'Mechanical',
      className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
  };
  const c = config[type] || {
    label: type.replace(/_/g, ' '),
    className: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold px-1.5 py-0', c.className)}>
      {c.label}
    </Badge>
  );
}

// ─── New helpers for the redesigned dense table ───

export type SignalTone = 'red' | 'amber' | 'blue' | 'emerald' | 'violet' | 'slate';

const SIGNAL_TONES: Record<SignalTone, string> = {
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
};

/** Tiny micro-pill for the Signals column. Stripe/Linear density. */
export function signalPill(label: string, tone: SignalTone = 'slate', icon?: React.ReactNode) {
  return (
    <span
      key={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-semibold leading-[16px] whitespace-nowrap',
        SIGNAL_TONES[tone],
      )}
    >
      {icon}
      {label}
    </span>
  );
}

/** Map a score / quality_label to a 4-step strength tier (1–4). */
export function scoreTier(score: number | null, qualityLabel: string | null): number {
  if (score != null) {
    if (score >= 80) return 4;
    if (score >= 60) return 3;
    if (score >= 40) return 2;
    if (score > 0) return 1;
    return 0;
  }
  if (qualityLabel) {
    const map: Record<string, number> = {
      'Very Strong': 4,
      Strong: 4,
      Solid: 3,
      Average: 2,
      'Needs Work': 1,
    };
    return map[qualityLabel] ?? 0;
  }
  return 0;
}

/** 4-dot strength meter — works even when score is null but quality_label exists. */
export function ScoreMeter({ tier, className }: { tier: number; className?: string }) {
  const colorMap: Record<number, string> = {
    4: 'bg-emerald-500',
    3: 'bg-blue-500',
    2: 'bg-amber-500',
    1: 'bg-orange-500',
    0: 'bg-muted-foreground/25',
  };
  return (
    <span className={cn('inline-flex items-center gap-[3px]', className)} aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i <= tier ? colorMap[tier] : 'bg-muted-foreground/15',
          )}
        />
      ))}
    </span>
  );
}

/** Compute EBITDA margin %. Returns null if either value missing or revenue<=0. */
export function computeMargin(ebitda: number | null, revenue: number | null): number | null {
  if (ebitda == null || revenue == null || revenue <= 0) return null;
  return Math.round((ebitda / revenue) * 100);
}

/** Color class for margin % — quiet, semantic. */
export function marginToneClass(margin: number | null): string {
  if (margin == null) return 'text-muted-foreground';
  if (margin >= 20) return 'text-emerald-600';
  if (margin >= 10) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Eyebrow state — single colored dot + label above the company name ───

export type EyebrowTone = 'emerald' | 'red' | 'amber' | 'muted-emerald' | 'orange' | 'slate';

const EYEBROW_TONES: Record<EyebrowTone, { dot: string; text: string }> = {
  emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700' },
  red: { dot: 'bg-red-500', text: 'text-red-700' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-700' },
  'muted-emerald': { dot: 'bg-emerald-400', text: 'text-emerald-600/80' },
  orange: { dot: 'bg-orange-400', text: 'text-orange-600/80' },
  slate: { dot: 'bg-slate-400', text: 'text-slate-600' },
};

/**
 * Tiny eyebrow line above the company name — single colored dot + label.
 * Use for the dominant signal only (open-to-intros, exit-now, priority, etc.).
 */
export function EyebrowState({
  label,
  tone = 'slate',
  className,
}: {
  label: string;
  tone?: EyebrowTone;
  className?: string;
}) {
  const t = EYEBROW_TONES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] leading-none',
        t.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} aria-hidden />
      {label}
    </span>
  );
}
