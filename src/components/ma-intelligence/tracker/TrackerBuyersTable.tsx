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
import { IntelligenceBadge } from "../IntelligenceBadge";
import { RefreshCw, ExternalLink, MoreHorizontal, Sparkles, Archive, Trash2, Users } from "lucide-react";
import type { MABuyer } from "@/lib/ma-intelligence/types";
import { getIntelligenceCoverage, calculateIntelligencePercentage } from "@/lib/ma-intelligence/types";
import { formatDistanceToNow } from "date-fns";

interface TrackerBuyersTableProps {
  buyers: MABuyer[];
  selectedBuyers: Set<string>;
  onToggleSelect: (buyerId: string) => void;
  onSelectAll: () => void;
  onRefresh: () => void;
  onEnrich: (buyerId: string) => void;
  onArchive: (buyerId: string) => void;
  onDelete: (buyerId: string) => void;
}

export function TrackerBuyersTable({
  buyers,
  selectedBuyers,
  onToggleSelect,
  onSelectAll,
  onRefresh,
  onEnrich,
  onArchive,
  onDelete,
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
            <TableHead className="w-[250px]">Name</TableHead>
            <TableHead className="w-[180px]">PE Firm</TableHead>
            <TableHead className="w-[120px]">Industry</TableHead>
            <TableHead className="w-[140px]">Intelligence</TableHead>
            <TableHead className="w-[120px]">Confidence</TableHead>
            <TableHead className="w-[100px]">Contacts</TableHead>
            <TableHead className="w-[140px]">Last Updated</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buyers.map((buyer) => {
            const coverage = getIntelligenceCoverage(buyer);
            const percentage = calculateIntelligencePercentage(buyer);
            const contactsCount = 0; // TODO: Implement contacts counting from related table

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
                  <div className="font-medium text-primary hover:underline">
                    {buyer.platform_company_name || buyer.pe_firm_name}
                  </div>
                  {buyer.platform_website && (
                    <div className="text-xs text-muted-foreground truncate max-w-[230px]">
                      {buyer.platform_website}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{buyer.pe_firm_name}</div>
                </TableCell>
                <TableCell>
                  {buyer.industry_vertical ? (
                    <Badge variant="secondary" className="text-xs">
                      {buyer.industry_vertical}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <IntelligenceBadge coverage={coverage} />
                    <span className="text-sm text-muted-foreground">{percentage}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {buyer.thesis_confidence ? (
                    <Badge
                      variant={
                        buyer.thesis_confidence === "High"
                          ? "default"
                          : buyer.thesis_confidence === "Medium"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {buyer.thesis_confidence}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {contactsCount}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(buyer.data_last_updated || buyer.created_at), {
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
                      <DropdownMenuItem onClick={() => onEnrich(buyer.id)}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Enrich
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onArchive(buyer.id)}>
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(buyer.id)}
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
