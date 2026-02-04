import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DealScoreBadge } from "../DealScoreBadge";
import {
  RefreshCw,
  ExternalLink,
  MoreHorizontal,
  Sparkles,
  Archive,
  Trash2,
  Target,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  CheckCircle2,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import type { MADeal } from "@/lib/ma-intelligence/types";
import { formatDistanceToNow } from "date-fns";

type SortColumn = "name" | "location" | "revenue" | "ebitda" | "score" | "added";
type SortDirection = "asc" | "desc";

interface TrackerDealsTableProps {
  deals: MADeal[];
  selectedDeals: Set<string>;
  onToggleSelect: (dealId: string) => void;
  onSelectAll: () => void;
  onRefresh: () => void;
  onScore: (dealId: string) => void;
  onEnrich: (dealId: string) => void;
  onArchive: (dealId: string) => void;
  onDelete: (dealId: string) => void;
}

export function TrackerDealsTable({
  deals,
  selectedDeals,
  onToggleSelect,
  onSelectAll,
  onRefresh,
  onScore,
  onEnrich,
  onArchive,
  onDelete,
}: TrackerDealsTableProps) {
  const navigate = useNavigate();
  const [sortColumn, setSortColumn] = useState<SortColumn>("added");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortableHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <TableHead>
      <button
        onClick={() => toggleSort(column)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortColumn === column ? (
          sortDirection === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );

  // Sort deals
  const sortedDeals = [...deals].sort((a, b) => {
    let aVal: any, bVal: any;

    switch (sortColumn) {
      case "name":
        aVal = (a.deal_name || "").toLowerCase();
        bVal = (b.deal_name || "").toLowerCase();
        break;
      case "location":
        aVal = (a.headquarters || "").toLowerCase();
        bVal = (b.headquarters || "").toLowerCase();
        break;
      case "revenue":
        aVal = a.revenue || 0;
        bVal = b.revenue || 0;
        break;
      case "ebitda":
        aVal = a.ebitda_amount || 0;
        bVal = b.ebitda_amount || 0;
        break;
      case "score":
        aVal = a.deal_score || 0;
        bVal = b.deal_score || 0;
        break;
      case "added":
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      default:
        return 0;
    }

    if (typeof aVal === "string") {
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? comparison : -comparison;
    } else {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }
  });

  if (deals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No deals in this tracker yet</p>
        <p className="text-sm text-muted-foreground">
          Add deals manually or import from CSV
        </p>
      </div>
    );
  }

  const allSelected = deals.length > 0 && selectedDeals.size === deals.length;

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="w-[60px]">Rank</TableHead>
            <SortableHeader column="name">Deal Name</SortableHeader>
            <SortableHeader column="location">Location</SortableHeader>
            <SortableHeader column="revenue">Revenue</SortableHeader>
            <SortableHeader column="ebitda">EBITDA</SortableHeader>
            <SortableHeader column="score">Score</SortableHeader>
            <TableHead className="w-[140px]">Engagement</TableHead>
            <SortableHeader column="added">Added</SortableHeader>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedDeals.map((deal, index) => {
            const revenue = deal.revenue
              ? `$${deal.revenue >= 1000000 ? `${(deal.revenue / 1000000).toFixed(1)}M` : `${(deal.revenue / 1000).toFixed(0)}K`}`
              : "—";

            const ebitda = deal.ebitda_amount
              ? `$${deal.ebitda_amount >= 1000000 ? `${(deal.ebitda_amount / 1000000).toFixed(1)}M` : `${(deal.ebitda_amount / 1000).toFixed(0)}K`}`
              : deal.ebitda_percentage
              ? `${deal.ebitda_percentage}%`
              : "—";

            const isEnriched = !!deal.last_enriched_at;
            const geography = deal.geography?.[0] || deal.headquarters;

            // Mock engagement counts - TODO: Replace with actual data from buyer_deal_scores table
            const approvedCount = 0;
            const interestedCount = 0;
            const passedCount = 0;

            return (
              <TableRow
                key={deal.id}
                className="cursor-pointer hover:bg-muted/30"
                onClick={() => navigate(`/admin/ma-intelligence/deals/${deal.id}`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedDeals.has(deal.id)}
                    onCheckedChange={() => onToggleSelect(deal.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="text-sm text-muted-foreground">#{index + 1}</div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement reorder up
                        }}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement reorder down
                        }}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-primary hover:underline">
                        {deal.deal_name}
                      </div>
                      {isEnriched && (
                        <Sparkles className="w-3 h-3 text-yellow-500" />
                      )}
                    </div>
                    {deal.company_website && (
                      <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                        {deal.company_website}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{geography || "—"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{revenue}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{ebitda}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {deal.deal_score !== null && deal.deal_score !== undefined ? (
                      <>
                        <DealScoreBadge score={deal.deal_score} size="sm" />
                        {/* TODO: Add score trend arrow based on previous score */}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-3 h-3" />
                      {approvedCount}
                    </div>
                    <div className="flex items-center gap-1 text-blue-600">
                      <ThumbsUp className="w-3 h-3" />
                      {interestedCount}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <XCircle className="w-3 h-3" />
                      {passedCount}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(deal.created_at), {
                      addSuffix: true,
                    })}
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onScore(deal.id)}>
                        <Target className="w-4 h-4 mr-2" />
                        Score
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEnrich(deal.id)}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Enrich
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onArchive(deal.id)}>
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(deal.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="text-sm text-muted-foreground">
          Showing {deals.length} deal{deals.length !== 1 ? "s" : ""}
          {selectedDeals.size > 0 && (
            <span className="ml-2">
              • {selectedDeals.size} selected
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
