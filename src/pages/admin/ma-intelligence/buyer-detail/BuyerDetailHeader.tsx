import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Sparkles,
  MoreVertical,
  Archive,
  Trash2,
} from "lucide-react";
import { IntelligenceBadge } from "@/components/ma-intelligence";
import type { BuyerDetailHeaderProps } from "./types";

export function BuyerDetailHeader({
  buyer,
  coverage,
  percentage,
  onNavigateBack,
  onEnrich,
  onArchive,
  onDelete,
}: BuyerDetailHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1 flex-1">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNavigateBack}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {buyer.platform_company_name || buyer.pe_firm_name}
            </h1>
            {buyer.platform_company_name && (
              <p className="text-muted-foreground">
                PE Firm: {buyer.pe_firm_name}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <IntelligenceBadge coverage={coverage} />
        <Badge variant="secondary">{percentage}% complete</Badge>
        {buyer.fee_agreement_status && (
          <Badge
            variant={
              buyer.fee_agreement_status === "Active"
                ? "default"
                : buyer.fee_agreement_status === "Expired"
                ? "secondary"
                : "outline"
            }
          >
            {buyer.fee_agreement_status}
          </Badge>
        )}
        {buyer.addon_only && <Badge variant="outline">Add-on Only</Badge>}
        {buyer.platform_only && <Badge variant="outline">Platform Only</Badge>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreVertical className="w-4 h-4 mr-2" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEnrich}>
              <Sparkles className="w-4 h-4 mr-2" />
              Enrich Buyer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Archive Buyer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Buyer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
