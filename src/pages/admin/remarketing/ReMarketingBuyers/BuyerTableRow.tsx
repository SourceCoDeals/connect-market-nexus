import { useNavigate, Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MoreHorizontal,
  Users,
  Building,
  Pencil,
  Trash2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { IntelligenceBadge } from "@/components/remarketing";
import { isSponsorType, findPeFirmByName, getBuyerTypeLabel } from "./constants";
import type { BuyerTab } from "./constants";

interface BuyerTableRowProps {
  buyer: any;
  globalIdx: number;
  activeTab: BuyerTab;
  selectedIds: Set<string>;
  buyers: any[] | undefined;
  platformCountsByFirm: Map<string, number>;
  buyerIdsWithTranscripts: Set<string> | undefined;
  toggleSelect: (id: string) => void;
  handleEnrichBuyer: (e: React.MouseEvent, buyerId: string) => void;
  deleteMutation: { mutate: (id: string) => void };
}

const BuyerTableRow = ({
  buyer,
  globalIdx,
  activeTab,
  selectedIds,
  buyers,
  platformCountsByFirm,
  buyerIdsWithTranscripts,
  toggleSelect,
  handleEnrichBuyer,
  deleteMutation,
}: BuyerTableRowProps) => {
  const navigate = useNavigate();
  const isSponsor = isSponsorType(buyer.buyer_type);
  const detailPath = isSponsor
    ? `/admin/buyers/pe-firms/${buyer.id}`
    : `/admin/buyers/${buyer.id}`;

  return (
    <TableRow
      key={buyer.id}
      className="cursor-pointer hover:bg-muted/50 group"
      onClick={() => navigate(detailPath)}
    >
      {/* Checkbox */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selectedIds.has(buyer.id)}
          onCheckedChange={() => toggleSelect(buyer.id)}
        />
      </TableCell>

      {/* Row Number */}
      <TableCell className="text-xs text-muted-foreground tabular-nums">
        {globalIdx}
      </TableCell>

      {/* Name Column */}
      <TableCell>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            {isSponsor ? (
              <Building className="h-5 w-5 text-primary" />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">
                {buyer.company_name}
              </span>
            </div>
            {buyer.company_website && (
              <a
                href={buyer.company_website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {buyer.company_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </TableCell>

      {activeTab === 'pe_firm' ? (
        <>
          {/* Type Column (PE Firms tab) */}
          <TableCell>
            <Badge variant="outline" className="text-xs">
              {getBuyerTypeLabel(buyer.buyer_type)}
            </Badge>
          </TableCell>

          {/* Platform Count Column */}
          <TableCell className="text-center">
            <span className="text-sm font-medium">
              {platformCountsByFirm.get(buyer.company_name) || 0}
            </span>
          </TableCell>

          {/* Fee Agreement Column */}
          <TableCell className="text-center">
            {buyer.has_fee_agreement
              ? <span className="text-xs font-medium text-green-600">Yes</span>
              : <span className="text-xs text-muted-foreground">No</span>}
          </TableCell>

          {/* NDA Column */}
          <TableCell className="text-center">
            {buyer.firm_agreement?.nda_signed
              ? <span className="text-xs font-medium text-green-600">Yes</span>
              : <span className="text-xs text-muted-foreground">No</span>}
          </TableCell>

          {/* Marketplace Column */}
          <TableCell className="text-center">
            {buyer.marketplace_firm_id
              ? <span className="text-xs font-medium text-green-600">Yes</span>
              : <span className="text-xs text-muted-foreground">No</span>}
          </TableCell>

          {/* Intel Column */}
          <TableCell>
            <IntelligenceBadge
              hasTranscript={buyerIdsWithTranscripts?.has(buyer.id) || false}
              size="sm"
            />
          </TableCell>
        </>
      ) : (
        <>
          {/* PE Firm Column (All/Platform/other tabs) */}
          <TableCell onClick={(e) => e.stopPropagation()}>
            {buyer.pe_firm_name ? (
              (() => {
                const peFirm = findPeFirmByName(buyers || [], buyer.pe_firm_name);
                return peFirm ? (
                  <Link
                    to={`/admin/buyers/pe-firms/${peFirm.id}`}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                      <Building className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm hover:underline">{buyer.pe_firm_name}</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                      <Building className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm text-muted-foreground">{buyer.pe_firm_name}</span>
                  </div>
                );
              })()
            ) : isSponsor ? (
              <Badge variant="outline" className="text-xs">
                {getBuyerTypeLabel(buyer.buyer_type)}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </TableCell>

          {/* Universe Column */}
          <TableCell>
            {buyer.universe?.name ? (
              <Badge variant="secondary" className="text-xs">
                {buyer.universe.name}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </TableCell>

          {/* Description Column */}
          <TableCell>
            {(buyer.business_summary || buyer.thesis_summary) ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm text-muted-foreground line-clamp-2 cursor-help">
                      {buyer.business_summary || buyer.thesis_summary}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-md whitespace-normal text-sm p-3">
                    {buyer.business_summary || buyer.thesis_summary}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </TableCell>

          {/* Marketplace Column */}
          <TableCell className="text-center">
            {buyer.marketplace_firm_id
              ? <span className="text-xs font-medium text-green-600">Yes</span>
              : <span className="text-xs text-muted-foreground">No</span>}
          </TableCell>

          {/* Fee Agreement Column */}
          <TableCell className="text-center">
            {buyer.has_fee_agreement
              ? <span className="text-xs font-medium text-green-600">Yes</span>
              : <span className="text-xs text-muted-foreground">No</span>}
          </TableCell>

          {/* NDA Column */}
          <TableCell className="text-center">
            {buyer.firm_agreement?.nda_signed
              ? <span className="text-xs font-medium text-green-600">Yes</span>
              : <span className="text-xs text-muted-foreground">No</span>}
          </TableCell>

          {/* Intel Column */}
          <TableCell>
            <IntelligenceBadge
              hasTranscript={buyerIdsWithTranscripts?.has(buyer.id) || false}
              size="sm"
            />
          </TableCell>
        </>
      )}

      {/* Actions Column */}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              navigate(detailPath);
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              {isSponsor ? 'View Firm' : 'Edit'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              handleEnrichBuyer(e, buyer.id);
            }}>
              <Sparkles className="h-4 w-4 mr-2" />
              Enrich
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this buyer?')) {
                  deleteMutation.mutate(buyer.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

export default BuyerTableRow;
