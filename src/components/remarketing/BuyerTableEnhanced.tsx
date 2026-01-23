import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  MoreHorizontal, 
  Sparkles, 
  Trash2, 
  MapPin,
  Building,
  ExternalLink,
  Search as SearchIcon,
  DollarSign
} from "lucide-react";
import { IntelligenceBadge } from "./IntelligenceBadge";
import type { DataCompleteness } from "@/types/remarketing";

interface BuyerRow {
  id: string;
  company_name: string;
  company_website?: string | null;
  buyer_type?: string | null;
  pe_firm_name?: string | null;
  pe_firm_website?: string | null;
  hq_city?: string | null;
  hq_state?: string | null;
  thesis_summary?: string | null;
  data_completeness?: string | null;
  target_geographies?: string[];
  geographic_footprint?: string[];
  has_fee_agreement?: boolean | null;
}

interface BuyerTableEnhancedProps {
  buyers: BuyerRow[];
  onEnrich?: (buyerId: string) => void;
  onDelete?: (buyerId: string) => void;
  isEnriching?: string | null;
  showPEColumn?: boolean;
}

export const BuyerTableEnhanced = ({
  buyers,
  onEnrich,
  onDelete,
  isEnriching,
  showPEColumn = true,
}: BuyerTableEnhancedProps) => {
  const navigate = useNavigate();

  const getLocation = (buyer: BuyerRow) => {
    const parts = [];
    if (buyer.hq_city) parts.push(buyer.hq_city);
    if (buyer.hq_state) parts.push(buyer.hq_state);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const getIntelLabel = (completeness: string | null) => {
    switch (completeness) {
      case 'high':
        return { label: 'Enriched', variant: 'default' as const };
      case 'medium':
        return { label: 'Partial', variant: 'secondary' as const };
      default:
        return { label: 'Needs Research', variant: 'outline' as const };
    }
  };

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px]">Platform / Buyer</TableHead>
            {showPEColumn && <TableHead className="w-[180px]">PE Firm</TableHead>}
            <TableHead>Description</TableHead>
            <TableHead className="w-[130px]">Intel</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buyers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showPEColumn ? 5 : 4} className="text-center py-12 text-muted-foreground">
                <SearchIcon className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No buyers found</p>
                <p className="text-sm">Add buyers manually or import from CSV</p>
              </TableCell>
            </TableRow>
          ) : (
            buyers.map((buyer) => {
              const location = getLocation(buyer);
              const intel = getIntelLabel(buyer.data_completeness);
              const isCurrentlyEnriching = isEnriching === buyer.id;

              return (
                <TableRow
                  key={buyer.id}
                  className="cursor-pointer hover:bg-muted/50 group"
                  onClick={() => navigate(`/admin/remarketing/buyers/${buyer.id}`)}
                >
                  {/* Platform / Buyer Column */}
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground truncate">
                            {buyer.company_name}
                          </span>
                          {buyer.data_completeness === 'high' && (
                            <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-xs px-1.5 py-0">
                              Enriched
                            </Badge>
                          )}
                          {buyer.has_fee_agreement && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs px-1.5 py-0 flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Fee Agreed
                            </Badge>
                          )}
                        </div>
                        {location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {location}
                          </div>
                        )}
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

                  {/* PE Firm Column */}
                  {showPEColumn && (
                    <TableCell>
                      {buyer.pe_firm_name ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                            <Building className="h-3 w-3 text-muted-foreground" />
                          </div>
                          {buyer.pe_firm_website ? (
                            <a
                              href={buyer.pe_firm_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {buyer.pe_firm_name}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-sm">{buyer.pe_firm_name}</span>
                          )}
                        </div>
                      ) : buyer.buyer_type === 'pe_firm' ? (
                        <Badge variant="outline" className="text-xs">
                          PE Firm
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}

                  {/* Description Column */}
                  <TableCell>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {buyer.thesis_summary || '—'}
                    </p>
                  </TableCell>

                  {/* Intel Column */}
                  <TableCell>
                    <IntelligenceBadge 
                      completeness={buyer.data_completeness as DataCompleteness | null} 
                      size="sm"
                    />
                  </TableCell>

                  {/* Actions Column */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEnrich && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onEnrich(buyer.id);
                            }}
                            disabled={isCurrentlyEnriching}
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            {isCurrentlyEnriching ? 'Enriching...' : 'Enrich Data'}
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(buyer.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
};

export default BuyerTableEnhanced;
