import { formatCompactCurrency } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { CheckCircle2, Star } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ValuationLead, AdminProfileMap } from './types';
import { extractBusinessName, inferWebsite, scorePillClass } from './helpers';
import { exitTimingBadge, qualityBadge, calculatorBadge } from './badges';
import { LeadRowActions } from './LeadRowActions';

interface LeadTableRowProps {
  lead: ValuationLead;
  idx: number;
  safePage: number;
  pageSize: number;
  activeTab: string;
  isSelected: boolean;
  adminProfiles: AdminProfileMap | undefined;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onRowClick: (lead: ValuationLead) => void;
  onAssignOwner: (lead: ValuationLead, ownerId: string | null) => void;
  onPushToAllDeals: (ids: string[]) => void;
  onPushAndEnrich: (ids: string[]) => void;
  onReEnrich: (ids: string[]) => void;
  refetch: () => void;
}

export function LeadTableRow({
  lead,
  idx,
  safePage,
  pageSize,
  activeTab,
  isSelected,
  adminProfiles,
  onToggleSelect,
  onRowClick,
  onAssignOwner,
  onPushToAllDeals,
  onPushAndEnrich,
  onReEnrich,
  refetch,
}: LeadTableRowProps) {
  return (
    <TableRow
      className={cn(
        'transition-colors cursor-pointer',
        lead.is_priority_target && 'bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30',
        !lead.is_priority_target && lead.pushed_to_all_deals && 'bg-green-50/60 hover:bg-green-50',
        !lead.pushed_to_all_deals && 'hover:bg-muted/40',
      )}
      onClick={() => onRowClick(lead)}
    >
      <TableCell onClick={(e) => e.stopPropagation()} className="w-[40px]">
        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(lead.id)} />
      </TableCell>
      {/* # */}
      <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
        {(safePage - 1) * pageSize + idx + 1}
      </TableCell>
      {/* Company + Website (merged, like DealTableRow) */}
      <TableCell>
        <div>
          <p className="font-medium text-foreground leading-tight">{extractBusinessName(lead)}</p>
          {inferWebsite(lead) && (
            <a
              href={`https://${inferWebsite(lead)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted-foreground hover:text-primary hover:underline truncate max-w-[180px] block"
            >
              {inferWebsite(lead)}
            </a>
          )}
        </div>
      </TableCell>
      {/* Description */}
      <TableCell className="max-w-[220px]">
        {lead.listing_description ? (
          <span
            className="text-sm text-muted-foreground line-clamp-3 leading-tight"
            title={lead.listing_description}
          >
            {lead.listing_description}
          </span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      {/* Calculator type (only on All tab) */}
      {activeTab === 'all' && <TableCell>{calculatorBadge(lead.calculator_type)}</TableCell>}
      {/* Industry */}
      <TableCell>
        <span className="text-sm text-muted-foreground truncate max-w-[140px] block">
          {lead.industry || '\u2014'}
        </span>
      </TableCell>
      {/* Location */}
      <TableCell>
        <span className="text-sm text-muted-foreground truncate block">
          {lead.location || '\u2014'}
        </span>
      </TableCell>
      {/* Deal Owner */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        {adminProfiles ? (
          <Select
            value={lead.deal_owner_id || 'unassigned'}
            onValueChange={(val) => onAssignOwner(lead, val === 'unassigned' ? null : val)}
          >
            <SelectTrigger className="h-7 w-[110px] text-xs border-none bg-transparent hover:bg-muted">
              <SelectValue placeholder="Assign\u2026">
                {lead.deal_owner_id && adminProfiles[lead.deal_owner_id] ? (
                  adminProfiles[lead.deal_owner_id].displayName.split(' ')[0]
                ) : (
                  <span className="text-muted-foreground">Assign&hellip;</span>
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
        ) : (
          <span className="text-xs text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      {/* Revenue */}
      <TableCell className="text-right">
        {lead.revenue != null ? (
          <span className="text-sm tabular-nums">{formatCompactCurrency(lead.revenue)}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      {/* EBITDA */}
      <TableCell className="text-right">
        {lead.ebitda != null ? (
          <span className="text-sm tabular-nums">{formatCompactCurrency(lead.ebitda)}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      {/* Valuation */}
      <TableCell className="text-right">
        {lead.valuation_low != null && lead.valuation_high != null ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatCompactCurrency(lead.valuation_low)}&ndash;
            {formatCompactCurrency(lead.valuation_high)}
          </span>
        ) : lead.valuation_mid != null ? (
          <span className="text-sm tabular-nums">{formatCompactCurrency(lead.valuation_mid)}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      {/* Exit timing */}
      <TableCell>{exitTimingBadge(lead.exit_timing)}</TableCell>
      {/* Buyer Intro */}
      <TableCell className="text-center">
        {lead.open_to_intros === true ? (
          <span className="text-emerald-600 font-semibold text-sm">Yes</span>
        ) : lead.open_to_intros === false ? (
          <span className="text-muted-foreground text-sm">No</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      {/* Quality */}
      <TableCell>{qualityBadge(lead.quality_label)}</TableCell>
      {/* Score */}
      <TableCell className="text-center">
        {lead.lead_score != null ? (
          <span
            className={cn(
              'text-sm font-medium px-2 py-0.5 rounded tabular-nums',
              scorePillClass(lead.lead_score),
            )}
          >
            {lead.lead_score}
          </span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-sm tabular-nums text-foreground">
          {format(new Date(lead.created_at), 'MMM d, yyyy')}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {lead.pushed_to_all_deals ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Pushed
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              New
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        {lead.is_priority_target ? (
          <Star className="h-4 w-4 fill-amber-400 text-amber-400 mx-auto" />
        ) : (
          <span className="text-xs text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <LeadRowActions
          lead={lead}
          onViewDeal={onRowClick}
          onPushAndEnrich={onPushAndEnrich}
          onReEnrich={onReEnrich}
          onPushToAllDeals={onPushToAllDeals}
          refetch={refetch}
        />
      </TableCell>
    </TableRow>
  );
}
