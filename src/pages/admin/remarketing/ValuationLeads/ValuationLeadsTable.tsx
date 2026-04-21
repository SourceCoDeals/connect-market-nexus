import { useState, useCallback, useMemo } from 'react';
import { ArchiveDealDialog } from '@/components/admin/deals/ArchiveDealDialog';
import { formatCompactCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useShiftSelect } from '@/hooks/useShiftSelect';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { toast as sonnerToast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpDown,
  CheckCircle2,
  MoreHorizontal,
  ExternalLink,
  Star,
  Sparkles,
  Phone,
  Network,
  Archive,
  Calculator,
  ThumbsDown,
  Linkedin,
  Mail,
  Globe,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClickToDialPhone } from '@/components/shared/ClickToDialPhone';
import type { ValuationLead, SortColumn } from './types';
import { extractDisplayIdentifier, formatAge, formatCompactRange } from './helpers';
import { CredibilityBadge, readCredibility } from './CredibilityBadge';
import { EyebrowState, type EyebrowTone, computeMargin, marginToneClass } from './BadgeComponents';
import { CompanyLogo } from '@/components/admin/CompanyLogo';

// Tight, focused column model — Apple/Stripe-grade signal density.
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  company: 320,
  ebitda: 110,
  revenue: 110,
  valuation: 130,
  margin: 80,
  signals: 140,
};

interface ValuationLeadsTableProps {
  paginatedLeads: ValuationLead[];
  activeTab: string;
  sortColumn: SortColumn;
  sortDirection: string;
  handleSort: (col: SortColumn) => void;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  allSelected: boolean;
  toggleSelectAll: () => void;
  toggleSelect: (id: string, e?: React.MouseEvent) => void;
  handleRowClick: (lead: ValuationLead) => void;
  handleOpenDeal: (lead: ValuationLead) => void;
  handlePushToAllDeals: (leadIds: string[]) => void;
  handleReEnrich: (leadIds: string[]) => void;
  handlePushAndEnrich: (leadIds: string[]) => void;
  handleMarkNotFit: (leadIds: string[]) => void;
  handleAssignOwner: (lead: ValuationLead, ownerId: string | null) => void;
  handleFindContacts?: (leadIds: string[]) => void;
  adminProfiles: Record<string, { id: string; displayName: string }> | undefined;
  safePage: number;
  PAGE_SIZE: number;
  refetch: () => void;
}

/** Determine the dominant row state — drives the leftmost dot + accent border. */
function rowState(lead: ValuationLead): {
  tone: 'priority' | 'pushed' | 'notfit' | 'new';
  dotClass: string;
  accentClass: string;
  label: string;
} {
  if (lead.not_a_fit) {
    return {
      tone: 'notfit',
      dotClass: 'bg-orange-400',
      accentClass: 'border-l-orange-300/50',
      label: 'Not a fit',
    };
  }
  if (lead.is_priority_target) {
    return {
      tone: 'priority',
      dotClass: 'bg-amber-500',
      accentClass: 'border-l-amber-400',
      label: 'Priority target',
    };
  }
  if (lead.pushed_to_all_deals) {
    return {
      tone: 'pushed',
      dotClass: 'bg-emerald-500',
      accentClass: 'border-l-emerald-400',
      label: 'Pushed to Active Deals',
    };
  }
  return {
    tone: 'new',
    dotClass: 'bg-muted-foreground/30',
    accentClass: 'border-l-transparent',
    label: 'New lead',
  };
}

/** Format owner initials (e.g., "Marcus Smith" → "MS"). */
function ownerInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase();
}

export function ValuationLeadsTable({
  paginatedLeads,
  activeTab: _activeTab,
  sortColumn,
  sortDirection: _sortDirection,
  handleSort,
  selectedIds,
  setSelectedIds,
  allSelected,
  toggleSelectAll,
  toggleSelect: _toggleSelect,
  handleRowClick,
  handleOpenDeal,
  handlePushToAllDeals,
  handleReEnrich,
  handlePushAndEnrich,
  handleMarkNotFit,
  handleAssignOwner,
  handleFindContacts,
  adminProfiles,
  safePage: _safePage,
  PAGE_SIZE: _PAGE_SIZE,
  refetch,
}: ValuationLeadsTableProps) {
  const queryClient = useQueryClient();

  const orderedIds = useMemo(() => paginatedLeads.map((l) => l.id), [paginatedLeads]);
  const { handleToggle: handleShiftToggle } = useShiftSelect(
    orderedIds,
    selectedIds,
    setSelectedIds,
  );

  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);

  const startResize = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = colWidths[col] ?? DEFAULT_COL_WIDTHS[col] ?? 120;
      const onMouseMove = (mv: MouseEvent) => {
        const newW = Math.max(60, startW + mv.clientX - startX);
        setColWidths((prev) => ({ ...prev, [col]: newW }));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [colWidths],
  );

  const SortHeader = ({
    column,
    children,
    align = 'left',
  }: {
    column: SortColumn;
    children: React.ReactNode;
    align?: 'left' | 'right' | 'center';
  }) => (
    <button
      className={cn(
        'inline-flex items-center gap-1 hover:text-foreground transition-colors text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80',
        align === 'right' && 'flex-row-reverse',
        align === 'center' && 'justify-center',
      )}
      onClick={() => handleSort(column)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          'h-3 w-3',
          sortColumn === column ? 'text-foreground' : 'text-muted-foreground/40',
        )}
      />
    </button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="overflow-hidden border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: colWidths.company }} />
                <col style={{ width: colWidths.ebitda }} />
                <col style={{ width: colWidths.revenue }} />
                <col style={{ width: colWidths.valuation }} />
                <col style={{ width: colWidths.margin }} />
                <col style={{ width: colWidths.signals }} />
                <col style={{ width: 36 }} />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b-border/60">
                  <TableHead className="w-[36px] py-2.5">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead
                    className="relative overflow-visible py-2.5"
                    style={{ width: colWidths.company }}
                  >
                    <SortHeader column="display_name">Company</SortHeader>
                    <div
                      onMouseDown={(e) => startResize('company', e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
                    />
                  </TableHead>
                  <TableHead
                    className="relative overflow-visible py-2.5 text-right"
                    style={{ width: colWidths.ebitda }}
                  >
                    <SortHeader column="ebitda" align="right">
                      EBITDA
                    </SortHeader>
                    <div
                      onMouseDown={(e) => startResize('ebitda', e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
                    />
                  </TableHead>
                  <TableHead
                    className="relative overflow-visible py-2.5 text-right"
                    style={{ width: colWidths.revenue }}
                  >
                    <SortHeader column="revenue" align="right">
                      Revenue
                    </SortHeader>
                    <div
                      onMouseDown={(e) => startResize('revenue', e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
                    />
                  </TableHead>
                  <TableHead
                    className="relative overflow-visible py-2.5 text-right"
                    style={{ width: colWidths.valuation }}
                  >
                    <SortHeader column="valuation" align="right">
                      Valuation
                    </SortHeader>
                    <div
                      onMouseDown={(e) => startResize('valuation', e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
                    />
                  </TableHead>
                  <TableHead
                    className="relative overflow-visible py-2.5 text-right"
                    style={{ width: colWidths.margin }}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                      Margin
                    </span>
                    <div
                      onMouseDown={(e) => startResize('margin', e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
                    />
                  </TableHead>
                  <TableHead
                    className="relative overflow-visible py-2.5 text-right"
                    style={{ width: colWidths.signals }}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                      Status
                    </span>
                  </TableHead>
                  <TableHead className="w-[36px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      <Calculator className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-medium">No valuation calculator leads yet</p>
                      <p className="text-sm mt-1">
                        Leads will appear here when submitted through SourceCo calculators.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead) => {
                    const state = rowState(lead);
                    const ident = extractDisplayIdentifier(lead);
                    const enrichedLogo =
                      (lead.website_enrichment_data?.favicon_url as string) || null;
                    const credibility = readCredibility(lead.website_enrichment_data);
                    const isLowCredibility =
                      credibility.tier === 'low_signal' || credibility.tier === 'shell';
                    const margin = computeMargin(lead.ebitda, lead.revenue);
                    const owner = lead.deal_owner_id ? adminProfiles?.[lead.deal_owner_id] : null;

                    // ─── Eyebrow: pick the single most important state ───
                    let eyebrow: { label: string; tone: EyebrowTone } | null = null;
                    if (lead.open_to_intros === true && lead.exit_timing === 'now') {
                      eyebrow = { label: 'Open to intros · Exit Now', tone: 'emerald' };
                    } else if (lead.open_to_intros === true && lead.exit_timing === '1-2years') {
                      eyebrow = { label: 'Open to intros · 1–2 Yrs', tone: 'emerald' };
                    } else if (lead.open_to_intros === true) {
                      eyebrow = { label: 'Open to intros', tone: 'emerald' };
                    } else if (lead.exit_timing === 'now') {
                      eyebrow = { label: 'Exit Now', tone: 'red' };
                    } else if (lead.is_priority_target) {
                      eyebrow = { label: 'Priority target', tone: 'amber' };
                    } else if (lead.exit_timing === '1-2years') {
                      eyebrow = { label: '1–2 Yrs', tone: 'amber' };
                    } else if (lead.pushed_to_all_deals) {
                      eyebrow = { label: 'Pushed to Deals', tone: 'muted-emerald' };
                    } else if (lead.not_a_fit) {
                      eyebrow = { label: 'Not a fit', tone: 'orange' };
                    }

                    const ageMs = Date.now() - new Date(lead.created_at).getTime();
                    const ageDays = Math.floor(ageMs / 86_400_000);
                    const isStale =
                      ageDays > 14 &&
                      !lead.pushed_to_all_deals &&
                      !lead.deal_owner_id &&
                      !lead.not_a_fit;

                    const statusIcons: React.ReactNode[] = [];
                    if (lead.is_priority_target) {
                      statusIcons.push(
                        <Tooltip key="prio">
                          <TooltipTrigger asChild>
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Priority target</TooltipContent>
                        </Tooltip>,
                      );
                    }
                    if (lead.needs_buyer_search) {
                      statusIcons.push(
                        <Tooltip key="fb">
                          <TooltipTrigger asChild>
                            <Network className="h-3.5 w-3.5 text-violet-600" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Find buyer</TooltipContent>
                        </Tooltip>,
                      );
                    }
                    if (lead.needs_owner_contact || lead.need_to_contact_owner) {
                      statusIcons.push(
                        <Tooltip key="co">
                          <TooltipTrigger asChild>
                            <Phone className="h-3.5 w-3.5 text-blue-600" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">Contact owner</TooltipContent>
                        </Tooltip>,
                      );
                    }

                    return (
                      <TableRow
                        key={lead.id}
                        className={cn(
                          'group cursor-pointer border-l-2 transition-colors h-[60px]',
                          'border-b border-border/50 hover:bg-muted/30',
                          state.accentClass,
                          lead.not_a_fit && 'opacity-50',
                        )}
                        onClick={() => handleRowClick(lead)}
                      >
                        <TableCell
                          onClick={(e) => {
                            e.stopPropagation();
                            const isChecked = !selectedIds.has(lead.id);
                            handleShiftToggle(lead.id, isChecked, e);
                          }}
                          className="w-[36px] py-2"
                        >
                          <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => {}} />
                        </TableCell>

                        <TableCell className="py-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <CompanyLogo
                              website={ident.sublineKind === 'website' ? ident.subline : null}
                              email={ident.sublineKind === 'email' ? ident.subline : null}
                              name={ident.name}
                              enrichedLogoUrl={enrichedLogo}
                              size="md"
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              {eyebrow && (
                                <div className="mb-0.5">
                                  <EyebrowState label={eyebrow.label} tone={eyebrow.tone} />
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <button
                                  className={cn(
                                    'text-left font-semibold text-[14px] leading-tight truncate hover:text-primary transition-colors min-w-0',
                                    isLowCredibility
                                      ? 'text-muted-foreground/70'
                                      : 'text-foreground',
                                  )}
                                  style={{ letterSpacing: '-0.01em' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDeal(lead);
                                  }}
                                  title={ident.name}
                                >
                                  {ident.name}
                                </button>
                                <CredibilityBadge signal={credibility} />
                                {lead.phone && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        onClick={(e) => e.stopPropagation()}
                                        className="shrink-0 inline-flex"
                                      >
                                        <ClickToDialPhone
                                          phone={lead.phone}
                                          name={lead.full_name || lead.display_name || undefined}
                                          email={lead.email || undefined}
                                          company={lead.business_name || undefined}
                                          entityType="leads"
                                          entityId={lead.id}
                                          valuationLeadId={lead.id}
                                          iconOnly
                                          size="xs"
                                          className="text-emerald-600/80 hover:text-emerald-700"
                                        />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      {lead.phone}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {lead.linkedin_url && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={lead.linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="shrink-0 text-[#0A66C2]/80 hover:text-[#0A66C2] transition-colors"
                                        aria-label="LinkedIn profile"
                                      >
                                        <Linkedin className="h-3 w-3" strokeWidth={2.5} />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">LinkedIn</TooltipContent>
                                  </Tooltip>
                                )}
                                {/* Hover-reveal "find" pill — only when both phone & LinkedIn are missing
                                    AND we have enough data to actually search (full_name + email). */}
                                {!lead.phone &&
                                  !lead.linkedin_url &&
                                  lead.full_name &&
                                  lead.email &&
                                  handleFindContacts && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleFindContacts([lead.id]);
                                          }}
                                          className="shrink-0 inline-flex items-center gap-0.5 rounded-full border border-dashed border-muted-foreground/30 px-1.5 py-px text-[10px] font-medium text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                          aria-label="Find phone & LinkedIn for this lead"
                                        >
                                          <Search className="h-2.5 w-2.5" strokeWidth={2.5} />
                                          <span>find</span>
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs">
                                        Search Serper + Blitz for phone &amp; LinkedIn
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground min-w-0">
                                {ident.sublineKind === 'website' && ident.subline && (
                                  <a
                                    href={ident.sublineHref!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 truncate hover:text-foreground hover:underline min-w-0"
                                    title={ident.subline}
                                  >
                                    <Globe className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">{ident.subline}</span>
                                  </a>
                                )}
                                {ident.sublineKind === 'email' && ident.subline && (
                                  <a
                                    href={ident.sublineHref!}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 truncate hover:text-foreground hover:underline min-w-0"
                                    title={ident.subline}
                                  >
                                    <Mail className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">{ident.subline}</span>
                                  </a>
                                )}
                                {ident.sublineKind === 'none' && (
                                  <span className="text-muted-foreground/50">No contact</span>
                                )}
                                <span className="text-muted-foreground/40">·</span>
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 shrink-0',
                                    isStale && 'text-amber-600 font-medium',
                                  )}
                                >
                                  {isStale && (
                                    <span
                                      className="h-1 w-1 rounded-full bg-amber-500"
                                      aria-hidden
                                    />
                                  )}
                                  {formatAge(lead.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-2 text-right">
                          {lead.ebitda != null ? (
                            <span
                              className="text-[14px] font-semibold tabular-nums text-foreground"
                              style={{ letterSpacing: '-0.01em' }}
                            >
                              {formatCompactCurrency(lead.ebitda)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-sm">—</span>
                          )}
                        </TableCell>

                        <TableCell className="py-2 text-right">
                          {lead.revenue != null ? (
                            <span className="text-[13px] tabular-nums text-muted-foreground">
                              {formatCompactCurrency(lead.revenue)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-sm">—</span>
                          )}
                        </TableCell>

                        <TableCell className="py-2 text-right">
                          {(() => {
                            const range = formatCompactRange(
                              lead.valuation_low,
                              lead.valuation_high,
                            );
                            if (range) {
                              return (
                                <span className="text-[13px] tabular-nums text-foreground/80 whitespace-nowrap">
                                  {range}
                                </span>
                              );
                            }
                            if (lead.valuation_mid != null) {
                              return (
                                <span className="text-[13px] tabular-nums text-foreground/80 whitespace-nowrap">
                                  {formatCompactCurrency(lead.valuation_mid)}
                                </span>
                              );
                            }
                            return <span className="text-muted-foreground/40 text-sm">—</span>;
                          })()}
                        </TableCell>

                        <TableCell className="py-2 text-right">
                          {margin != null ? (
                            <span
                              className={cn(
                                'text-[13px] font-semibold tabular-nums',
                                marginToneClass(margin),
                              )}
                            >
                              {margin}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-sm">—</span>
                          )}
                        </TableCell>

                        <TableCell onClick={(e) => e.stopPropagation()} className="py-2">
                          <div className="flex items-center justify-end gap-2">
                            {statusIcons.length > 0 && (
                              <div className="flex items-center gap-1.5">{statusIcons}</div>
                            )}
                            {adminProfiles && (
                              <Select
                                value={lead.deal_owner_id || 'unassigned'}
                                onValueChange={(val) =>
                                  handleAssignOwner(lead, val === 'unassigned' ? null : val)
                                }
                              >
                                <SelectTrigger className="h-7 w-auto px-1 text-xs border-none bg-transparent hover:bg-muted gap-0 [&>svg]:hidden">
                                  <SelectValue>
                                    {owner ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                            {ownerInitials(owner.displayName)}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="text-xs">
                                          {owner.displayName}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 border border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground/60 transition-opacity">
                                        +
                                      </span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {Object.values(adminProfiles).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell onClick={(e) => e.stopPropagation()} className="py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-60 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenDeal(lead)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open Deal Page
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (lead.pushed_to_all_deals && lead.pushed_listing_id)
                                    handleReEnrich([lead.id]);
                                  else handlePushAndEnrich([lead.id]);
                                }}
                              >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Enrich Deal
                              </DropdownMenuItem>
                              {handleFindContacts && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFindContacts([lead.id]);
                                  }}
                                  disabled={!!(lead.linkedin_url && lead.phone)}
                                >
                                  <Search className="h-4 w-4 mr-2" />
                                  {lead.linkedin_url && lead.phone
                                    ? 'Phone & LinkedIn found'
                                    : 'Find Phone & LinkedIn'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!lead.pushed_listing_id) {
                                    sonnerToast.error('Push deal to Active Deals first');
                                    return;
                                  }
                                  const newVal = !lead.needs_buyer_search;
                                  const now = new Date().toISOString();
                                  await supabase
                                    .from('listings')
                                    .update({
                                      needs_buyer_search: newVal,
                                      needs_buyer_search_at: newVal ? now : null,
                                    })
                                    .eq('id', lead.pushed_listing_id);
                                  sonnerToast.success(
                                    newVal ? 'Flagged: Find Buyer' : 'Flag removed',
                                  );
                                  queryClient.invalidateQueries({
                                    queryKey: ['remarketing', 'valuation-leads'],
                                  });
                                }}
                              >
                                <Network className="h-4 w-4 mr-2" />
                                Flag: Find Buyer
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!lead.pushed_listing_id) {
                                    sonnerToast.error('Push deal to Active Deals first');
                                    return;
                                  }
                                  const newVal = !lead.needs_owner_contact;
                                  await supabase
                                    .from('listings')
                                    .update({ needs_owner_contact: newVal })
                                    .eq('id', lead.pushed_listing_id);
                                  sonnerToast.success(
                                    newVal ? 'Flagged: Need to Contact Owner' : 'Flag removed',
                                  );
                                  queryClient.invalidateQueries({
                                    queryKey: ['remarketing', 'valuation-leads'],
                                  });
                                }}
                              >
                                <Phone className="h-4 w-4 mr-2" />
                                Flag: Need to Contact Owner
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newVal = !lead.is_priority_target;
                                  const { error } = await supabase
                                    .from('valuation_leads')
                                    .update({ is_priority_target: newVal } as never)
                                    .eq('id', lead.id);
                                  if (error) sonnerToast.error('Failed to update priority');
                                  else {
                                    queryClient.invalidateQueries({
                                      queryKey: ['remarketing', 'valuation-leads'],
                                    });
                                    sonnerToast.success(
                                      newVal ? 'Marked as priority' : 'Priority removed',
                                    );
                                  }
                                }}
                                className={lead.is_priority_target ? 'text-amber-600' : ''}
                              >
                                <Star
                                  className={`h-4 w-4 mr-2 ${lead.is_priority_target ? 'fill-amber-500 text-amber-500' : ''}`}
                                />
                                {lead.is_priority_target ? 'Remove Priority' : 'Mark as Priority'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newVal = !lead.needs_buyer_universe;
                                  const { error } = await supabase
                                    .from('valuation_leads')
                                    .update({ needs_buyer_universe: newVal } as never)
                                    .eq('id', lead.id);
                                  if (error) sonnerToast.error('Failed to update flag');
                                  else {
                                    queryClient.invalidateQueries({
                                      queryKey: ['remarketing', 'valuation-leads'],
                                    });
                                    sonnerToast.success(
                                      newVal ? 'Flagged: Needs Buyer Universe' : 'Flag removed',
                                    );
                                  }
                                }}
                                className={lead.needs_buyer_universe ? 'text-blue-600' : ''}
                              >
                                <Network
                                  className={cn(
                                    'h-4 w-4 mr-2',
                                    lead.needs_buyer_universe && 'text-blue-600',
                                  )}
                                />
                                {lead.needs_buyer_universe
                                  ? 'Remove Buyer Universe Flag'
                                  : 'Needs Buyer Universe'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newVal = !lead.need_to_contact_owner;
                                  const { error } = await supabase
                                    .from('valuation_leads')
                                    .update({ need_to_contact_owner: newVal } as never)
                                    .eq('id', lead.id);
                                  if (error) sonnerToast.error('Failed to update flag');
                                  else {
                                    queryClient.invalidateQueries({
                                      queryKey: ['remarketing', 'valuation-leads'],
                                    });
                                    sonnerToast.success(
                                      newVal ? 'Flagged: Need to Contact Owner' : 'Flag removed',
                                    );
                                  }
                                }}
                                className={lead.need_to_contact_owner ? 'text-orange-600' : ''}
                              >
                                <Phone
                                  className={cn(
                                    'h-4 w-4 mr-2',
                                    lead.need_to_contact_owner && 'text-orange-600',
                                  )}
                                />
                                {lead.need_to_contact_owner
                                  ? 'Remove Contact Owner Flag'
                                  : 'Need to Contact Owner'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handlePushToAllDeals([lead.id])}
                                disabled={!!lead.pushed_to_all_deals}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Approve to Active Deals
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-orange-600 focus:text-orange-600"
                                onClick={() => handleMarkNotFit([lead.id])}
                              >
                                <ThumbsDown className="h-4 w-4 mr-2" />
                                Mark as Not a Fit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setArchiveTarget({
                                    id: lead.id,
                                    name:
                                      lead.business_name ||
                                      lead.display_name ||
                                      lead.full_name ||
                                      'Unknown Lead',
                                  })
                                }
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archive Deal
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <ArchiveDealDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        deal={archiveTarget ? { id: archiveTarget.id, name: archiveTarget.name } : null}
        onConfirmArchive={async (reason) => {
          if (!archiveTarget) return;
          const { error } = await supabase
            .from('valuation_leads')
            .update({ is_archived: true, archive_reason: reason } as never)
            .eq('id', archiveTarget.id);
          if (error) throw error;
          setArchiveTarget(null);
          refetch();
        }}
      />
    </TooltipProvider>
  );
}
