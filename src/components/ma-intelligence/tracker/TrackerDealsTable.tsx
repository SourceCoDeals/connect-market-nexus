import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DealScoreBadge } from "../DealScoreBadge";
import { RefreshCw, ExternalLink } from "lucide-react";
import type { MADeal } from "@/lib/ma-intelligence/types";

interface TrackerDealsTableProps {
  deals: MADeal[];
  selectedDeals: Set<string>;
  onToggleSelect: (dealId: string) => void;
  onSelectAll: () => void;
  onRefresh: () => void;
}

export function TrackerDealsTable({
  deals,
  selectedDeals,
  onToggleSelect,
  onSelectAll,
  onRefresh,
}: TrackerDealsTableProps) {
  const navigate = useNavigate();

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
            <TableHead className="w-[300px]">Deal Name</TableHead>
            <TableHead className="w-[150px]">Location</TableHead>
            <TableHead className="w-[120px]">Revenue</TableHead>
            <TableHead className="w-[120px]">EBITDA</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[100px]">Score</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => {
            const revenue = deal.revenue
              ? `$${deal.revenue >= 1000000 ? `${(deal.revenue / 1000000).toFixed(1)}M` : `${(deal.revenue / 1000).toFixed(0)}K`}`
              : "—";

            const ebitda = deal.ebitda_amount
              ? `$${deal.ebitda_amount >= 1000000 ? `${(deal.ebitda_amount / 1000000).toFixed(1)}M` : `${(deal.ebitda_amount / 1000).toFixed(0)}K`}`
              : deal.ebitda_percentage
              ? `${deal.ebitda_percentage}%`
              : "—";

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
                  <div className="space-y-1">
                    <div className="font-medium">{deal.deal_name}</div>
                    {deal.company_website && (
                      <div className="text-sm text-muted-foreground truncate max-w-[280px]">
                        {deal.company_website}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{deal.headquarters || "—"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{revenue}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{ebitda}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={deal.status === "active" ? "default" : "secondary"}>
                    {deal.status || "Unknown"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {deal.deal_score !== null && deal.deal_score !== undefined ? (
                    <DealScoreBadge score={deal.deal_score} size="sm" />
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigate(`/admin/ma-intelligence/deals/${deal.id}`)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
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
