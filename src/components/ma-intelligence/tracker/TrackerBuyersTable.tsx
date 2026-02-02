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
import { IntelligenceBadge } from "../IntelligenceBadge";
import { RefreshCw, ExternalLink } from "lucide-react";
import type { MABuyer } from "@/lib/ma-intelligence/types";
import { getIntelligenceCoverage, calculateIntelligencePercentage } from "@/lib/ma-intelligence/types";

interface TrackerBuyersTableProps {
  buyers: MABuyer[];
  selectedBuyers: Set<string>;
  onToggleSelect: (buyerId: string) => void;
  onSelectAll: () => void;
  onRefresh: () => void;
}

export function TrackerBuyersTable({
  buyers,
  selectedBuyers,
  onToggleSelect,
  onSelectAll,
  onRefresh,
}: TrackerBuyersTableProps) {
  const navigate = useNavigate();

  if (buyers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No buyers in this universe yet</p>
        <p className="text-sm text-muted-foreground">
          Add buyers manually or import from CSV
        </p>
      </div>
    );
  }

  const allSelected = buyers.length > 0 && selectedBuyers.size === buyers.length;

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
            <TableHead className="w-[250px]">PE Firm / Platform</TableHead>
            <TableHead className="w-[150px]">Location</TableHead>
            <TableHead className="w-[120px]">Size Range</TableHead>
            <TableHead className="w-[180px]">Intelligence</TableHead>
            <TableHead className="w-[120px]">Last Updated</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buyers.map((buyer) => {
            const coverage = getIntelligenceCoverage(buyer);
            const percentage = calculateIntelligencePercentage(buyer);
            const location = [buyer.hq_city, buyer.hq_state].filter(Boolean).join(", ");

            return (
              <TableRow
                key={buyer.id}
                className="cursor-pointer hover:bg-muted/30"
                onClick={() => navigate(`/admin/ma-intelligence/buyers/${buyer.id}`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedBuyers.has(buyer.id)}
                    onCheckedChange={() => onToggleSelect(buyer.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{buyer.pe_firm_name}</div>
                    {buyer.platform_company_name && (
                      <div className="text-sm text-muted-foreground">
                        {buyer.platform_company_name}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{location || "—"}</div>
                </TableCell>
                <TableCell>
                  {buyer.min_revenue || buyer.max_revenue ? (
                    <div className="text-sm">
                      ${buyer.min_revenue ? `${buyer.min_revenue}M` : "0"}
                      {" - "}
                      ${buyer.max_revenue ? `${buyer.max_revenue}M` : "∞"}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <IntelligenceBadge coverage={coverage} />
                    <span className="text-sm text-muted-foreground">{percentage}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    {new Date(buyer.data_last_updated || buyer.created_at).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigate(`/admin/ma-intelligence/buyers/${buyer.id}`)}
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
          Showing {buyers.length} buyer{buyers.length !== 1 ? "s" : ""}
          {selectedBuyers.size > 0 && (
            <span className="ml-2">
              • {selectedBuyers.size} selected
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
