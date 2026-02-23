import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntelligenceBadge } from "@/components/ma-intelligence";
import type { MABuyer } from "@/lib/ma-intelligence/types";

interface BuyerDetailHeaderProps {
  buyer: MABuyer;
  coverage: string;
  percentage: number;
  dealId: string | null;
  onBack: () => void;
  onEnrich: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onApproveForDeal: () => void;
  onPassDeal: () => void;
}

export function BuyerDetailHeader({
  buyer,
  coverage,
  percentage,
  dealId,
  onBack,
  onEnrich,
  onArchive,
  onDelete,
  onApproveForDeal,
  onPassDeal,
}: BuyerDetailHeaderProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
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
          {buyer.platform_only && (
            <Badge variant="outline">Platform Only</Badge>
          )}

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

      {/* Deal Context Banner */}
      {dealId && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Viewing in deal context</span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onApproveForDeal}>
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve for this Deal
              </Button>
              <Button size="sm" variant="outline" onClick={onPassDeal}>
                <XCircle className="w-4 h-4 mr-1" />
                Pass on this Deal
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {buyer.hq_city && buyer.hq_state
                ? `${buyer.hq_city}, ${buyer.hq_state}`
                : buyer.hq_state || "\u2014"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {buyer.min_revenue || buyer.max_revenue
                ? `$${buyer.min_revenue || 0}M - $${buyer.max_revenue || "\u221E"}M`
                : "\u2014"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">EBITDA Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {buyer.min_ebitda || buyer.max_ebitda
                ? `$${buyer.min_ebitda || 0}M - $${buyer.max_ebitda || "\u221E"}M`
                : "\u2014"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Acquisitions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {buyer.total_acquisitions || 0} total
              {buyer.acquisition_frequency && (
                <span className="text-muted-foreground ml-1">
                  {"\u2022"} {buyer.acquisition_frequency}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
