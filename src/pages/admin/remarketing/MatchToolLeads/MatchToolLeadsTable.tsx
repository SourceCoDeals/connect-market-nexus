import { useCallback, useMemo, useState } from 'react';
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
import {
  ArrowUpDown,
  CheckCircle2,
  MoreHorizontal,
  ExternalLink,
  Sparkles,
  Phone,
  Archive,
  ThumbsDown,
  Linkedin,
  Mail,
  Globe,
  Users,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClickToDialPhone } from '@/components/shared/ClickToDialPhone';
import { CompanyLogo } from '@/components/admin/CompanyLogo';
import type { MatchToolLead, MatchToolSortColumn } from './types';
import {
  REVENUE_LABELS,
  PROFIT_LABELS,
  TIMELINE_LABELS,
  formatAge,
  inferWebsite,
  extractBusinessName,
  extractBusinessNameRaw,
  getStageLabel,
  resolveLocation,
} from './helpers';

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  company: 360,
  contact: 220,
  financials: 200,
  location: 140,
};

interface MatchToolLeadsTableProps {
  paginatedLeads: MatchToolLead[];
  sortColumn: MatchToolSortColumn;
  sortDirection: string;
  handleSort: (col: MatchToolSortColumn) => void;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  allSelected: boolean;
  toggleSelectAll: () => void;
  toggleSelect: (id: string, e?: React.MouseEvent) => void;
  handleRowClick: (lead: MatchToolLead) => void;
  handleOpenDeal: (lead: MatchToolLead) => void;
  handlePushToAllDeals: (leadIds: string[]) => void;
  handleReEnrich: (leadIds: string[]) => void;
  handlePushAndEnrich: (leadIds: string[]) => void;
  handleMarkNotFit: (leadIds: string[]) => void;
  handleArchive: (leadIds: string[]) => void;
  handleDelete: (leadIds: string[]) => void;
  handleAssignOwner: (lead: MatchToolLead, ownerId: string | null) => void;
  handleFindContacts?: (leadIds: string[]) => void;
  adminProfiles: Record<string, { id: string; displayName: string }> | undefined;
  refetch: () => void;
}

function rowAccent(lead: MatchToolLead): { dot: string; border: string; label: string } {
  if (lead.not_a_fit)
    return { dot: 'bg-orange-400', border: 'border-l-orange-300/50', label: 'Not a fit' };
  if (lead.is_priority_target)
    return { dot: 'bg-amber-500', border: 'border-l-amber-400', label: 'Priority' };
  if (lead.pushed_to_all_deals)
    return { dot: 'bg-emerald-500', border: 'border-l-emerald-400', label: 'In Active Deals' };
  if (lead.submission_stage === 'full_form')
    return { dot: 'bg-emerald-400', border: 'border-l-emerald-300', label: 'Wants buyers' };
  return { dot: 'bg-muted-foreground/30', border: 'border-l-transparent', label: 'New' };
}

function ownerInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase();
}

export function MatchToolLeadsTable({
  paginatedLeads,
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
  handleMarkNotFit,
  handleArchive,
  handleDelete,
  handleAssignOwner,
  handleFindContacts,
  adminProfiles,
  refetch: _refetch,
}: MatchToolLeadsTableProps) {
  const orderedIds = useMemo(() => paginatedLeads.map((l) => l.id), [paginatedLeads]);
  const { handleToggle: handleShiftToggle } = useShiftSelect(
    orderedIds,
    selectedIds,
    setSelectedIds,
  );

  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);

  const startResize = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = colWidths[col] ?? DEFAULT_COL_WIDTHS[col] ?? 120;
      const onMouseMove = (mv: MouseEvent) => {
        const newW = Math.max(60, startW + mv.clientX - startX);
        setColWidths((p) => ({ ...p, [col]: newW }));
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
    column: MatchToolSortColumn;
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
                <col style={{ width: colWidths.contact }} />
                <col style={{ width: colWidths.financials }} />
                <col style={{ width: colWidths.location }} />
                <col style={{ width: 100 }} />
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
                    <SortHeader column="business_name">Company</SortHeader>
                    <div
                      onMouseDown={(e) => startResize('company', e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
                    />
                  </TableHead>
                  <TableHead
                    className="relative overflow-visible py-2.5"
                    style={{ width: colWidths.contact }}
                  >
                    <SortHeader column="full_name">Contact</SortHeader>
                    <div
                      onMouseDown={(e) => startResize('contact', e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
                    />
                  </TableHead>
                  <TableHead
                    className="relative overflow-visible py-2.5"
                    style={{ width: colWidths.financials }}
                  >
                    <SortHeader column="revenue">Financials</SortHeader>
                    <div
                      onMouseDown={(e) => startResize('financials', e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
                    />
                  </TableHead>
                  <TableHead
                    className="relative overflow-visible py-2.5"
                    style={{ width: colWidths.location }}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                      Location
                    </span>
                  </TableHead>
                  <TableHead className="py-2.5 text-right">
                    <SortHeader column="created_at" align="right">
                      Date
                    </SortHeader>
                  </TableHead>
                  <TableHead className="w-[36px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-medium">No match tool leads here</p>
                      <p className="text-sm mt-1">
                        Adjust filters or check the Quarantined view if you're missing rows.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead) => {
                    const accent = rowAccent(lead);
                    const business = extractBusinessName(lead);
                    const rawName = extractBusinessNameRaw(lead);
                    const showRawTooltip = !!rawName && rawName.trim() !== business.trim();
                    const domain = inferWebsite(lead);
                    const stage = getStageLabel(lead.submission_stage);
                    const owner = lead.deal_owner_id ? adminProfiles?.[lead.deal_owner_id] : null;
                    const enrichedLogo = (lead.enrichment_data?.favicon_url as string) || null;
                    const locationDisplay = resolveLocation(lead);

                    return (
                      <TableRow
                        key={lead.id}
                        className={cn(
                          'group cursor-pointer border-l-2 transition-colors h-[60px]',
                          'border-b border-border/50 hover:bg-muted/30',
                          accent.border,
                          (lead.not_a_fit || lead.is_archived) && 'opacity-50',
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

                        {/* Company */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <CompanyLogo
                              website={domain}
                              email={lead.email}
                              name={business}
                              enrichedLogoUrl={enrichedLogo}
                              size="md"
                              variant="framed"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {showRawTooltip ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-[14px] font-semibold text-foreground truncate tracking-[-0.01em] cursor-help">
                                        {business}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs max-w-md">
                                      {rawName}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <p className="text-[14px] font-semibold text-foreground truncate tracking-[-0.01em]">
                                    {business}
                                  </p>
                                )}
                                {lead.pushed_to_all_deals && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      In Active Deals
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 min-w-0 text-[11px] text-muted-foreground/70">
                                {domain && (
                                  <a
                                    href={`https://${domain}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 max-w-full hover:text-primary min-w-0"
                                  >
                                    <Globe className="h-2.5 w-2.5 flex-shrink-0" />
                                    <span className="truncate">{domain}</span>
                                  </a>
                                )}
                                {domain && (
                                  <span className="text-muted-foreground/30 flex-shrink-0">·</span>
                                )}
                                <span className="inline-flex items-center gap-1 flex-shrink-0">
                                  <span
                                    className={cn(
                                      'h-1.5 w-1.5 rounded-full',
                                      stage.tone === 'emerald' && 'bg-emerald-500',
                                      stage.tone === 'blue' && 'bg-blue-500',
                                      stage.tone === 'muted' && 'bg-muted-foreground/40',
                                    )}
                                  />
                                  <span className="text-[10.5px] tracking-[0.02em] text-muted-foreground/70 lowercase">
                                    {stage.label}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Contact */}
                        <TableCell className="py-2">
                          {lead.full_name ? (
                            <div className="min-w-0">
                              <p className="text-[13px] text-foreground truncate">
                                {lead.full_name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {lead.email && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={`mailto:${lead.email}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-muted-foreground/60 hover:text-primary"
                                      >
                                        <Mail className="h-3 w-3" />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      {lead.email}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {lead.phone && (
                                  <span onClick={(e) => e.stopPropagation()}>
                                    <ClickToDialPhone
                                      phone={lead.phone}
                                      name={lead.full_name || undefined}
                                      email={lead.email || undefined}
                                      company={business}
                                      size="sm"
                                    />
                                  </span>
                                )}
                                {lead.linkedin_url && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={lead.linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-muted-foreground/60 hover:text-[#0a66c2]"
                                      >
                                        <Linkedin className="h-3 w-3" />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      View LinkedIn
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[12px] text-muted-foreground/50">
                              No contact yet
                            </span>
                          )}
                        </TableCell>

                        {/* Financials */}
                        <TableCell className="py-2">
                          {lead.revenue || lead.profit ? (
                            <div className="space-y-0.5">
                              <div className="flex items-baseline gap-2">
                                <span className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground/55 font-medium w-[44px]">
                                  Rev
                                </span>
                                <span className="text-[12.5px] font-medium text-foreground tabular-nums tracking-[-0.01em]">
                                  {lead.revenue
                                    ? REVENUE_LABELS[lead.revenue] || lead.revenue
                                    : '—'}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground/55 font-medium w-[44px]">
                                  EBITDA
                                </span>
                                <span className="text-[12.5px] font-medium text-foreground tabular-nums tracking-[-0.01em]">
                                  {lead.profit ? PROFIT_LABELS[lead.profit] || lead.profit : '—'}
                                </span>
                              </div>
                              {lead.timeline && (
                                <p className="text-[10.5px] text-muted-foreground/60 pt-0.5 pl-[52px] tracking-[-0.005em]">
                                  Exit in {TIMELINE_LABELS[lead.timeline] || lead.timeline}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/40">—</span>
                          )}
                        </TableCell>

                        {/* Location */}
                        <TableCell className="py-2">
                          {locationDisplay ? (
                            <span className="text-[12px] text-muted-foreground/80 truncate block">
                              {locationDisplay}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/40">—</span>
                          )}
                        </TableCell>

                        {/* (Stage moved inline next to company name) */}

                        {/* Date */}
                        <TableCell className="py-2 text-right">
                          <span className="text-[11px] text-muted-foreground/70">
                            {formatAge(lead.created_at)}
                          </span>
                          {owner && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  onClick={(e) => e.stopPropagation()}
                                  className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-semibold leading-none w-5 h-5"
                                >
                                  {ownerInitials(owner.displayName)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                Owner: {owner.displayName}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>

                        {/* Row actions */}
                        <TableCell className="w-[36px] py-2" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => handleOpenDeal(lead)}>
                                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                Open in Active Deals
                              </DropdownMenuItem>
                              {!lead.pushed_to_all_deals && (
                                <DropdownMenuItem onClick={() => handlePushToAllDeals([lead.id])}>
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                  Push to Active Deals
                                </DropdownMenuItem>
                              )}
                              {lead.website && (
                                <DropdownMenuItem onClick={() => handleReEnrich([lead.id])}>
                                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                                  Re-enrich
                                </DropdownMenuItem>
                              )}
                              {handleFindContacts &&
                                (!lead.linkedin_url || !lead.phone) &&
                                lead.full_name &&
                                lead.email && (
                                  <DropdownMenuItem onClick={() => handleFindContacts([lead.id])}>
                                    <Phone className="h-3.5 w-3.5 mr-2" />
                                    Find Contact Info
                                  </DropdownMenuItem>
                                )}
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1.5">
                                <p className="text-[10px] font-medium uppercase text-muted-foreground/70 mb-1">
                                  Owner
                                </p>
                                <Select
                                  value={lead.deal_owner_id || 'unassigned'}
                                  onValueChange={(v) =>
                                    handleAssignOwner(lead, v === 'unassigned' ? null : v)
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Unassigned" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {Object.values(adminProfiles || {}).map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.displayName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleMarkNotFit([lead.id])}>
                                <ThumbsDown className="h-3.5 w-3.5 mr-2" />
                                Mark Not a Fit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleArchive([lead.id])}>
                                <Archive className="h-3.5 w-3.5 mr-2" />
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete([lead.id])}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
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
    </TooltipProvider>
  );
}
