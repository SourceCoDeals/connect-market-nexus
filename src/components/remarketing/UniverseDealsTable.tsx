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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  MapPin, 
  TrendingUp,
  Users,
  Target,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Clock,
  MoreHorizontal,
  Trash2,
  ExternalLink
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UniverseDeal {
  id: string;
  added_at: string;
  status: string;
  listing: {
    id: string;
    title: string;
    location?: string;
    revenue?: number;
    ebitda?: number;
    enriched_at?: string;
    geographic_states?: string[];
  };
}

interface DealEngagement {
  approved: number;
  interested: number;
  passed: number;
  avgScore: number;
}

interface UniverseDealsTableProps {
  deals: UniverseDeal[];
  engagementStats?: Record<string, DealEngagement>;
  onRemoveDeal?: (dealId: string, listingId: string) => void;
  onScoreDeal?: (listingId: string) => void;
  onEnrichDeal?: (listingId: string) => void;
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '—';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export const UniverseDealsTable = ({
  deals,
  engagementStats = {},
  onRemoveDeal,
  onScoreDeal,
  onEnrichDeal,
}: UniverseDealsTableProps) => {
  const navigate = useNavigate();

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[240px]">Deal Name</TableHead>
            <TableHead className="w-[140px]">Service Area</TableHead>
            <TableHead className="w-[80px] text-center">
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                </TooltipTrigger>
                <TooltipContent>Approved buyers</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="w-[80px] text-center">
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent>Interested buyers</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="w-[80px] text-center">
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-1">
                  <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Passed buyers</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="w-[100px]">Added</TableHead>
            <TableHead className="w-[90px] text-right">Revenue</TableHead>
            <TableHead className="w-[90px] text-right">EBITDA</TableHead>
            <TableHead className="w-[80px] text-center">Score</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No deals in this universe</p>
                <p className="text-sm">Add deals to start matching with buyers</p>
              </TableCell>
            </TableRow>
          ) : (
            deals.map((deal) => {
              const engagement = engagementStats[deal.listing.id] || {
                approved: 0,
                interested: 0,
                passed: 0,
                avgScore: 0,
              };
              
              return (
                <TableRow
                  key={deal.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/remarketing/deals/${deal.listing.id}`)}
                >
                  {/* Deal Name */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">
                            {deal.listing.title || 'Untitled Deal'}
                          </span>
                          {deal.listing.enriched_at && (
                            <Badge variant="secondary" className="text-xs px-1.5">
                              <Sparkles className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                        {deal.listing.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {deal.listing.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Service Area */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {deal.listing.geographic_states?.slice(0, 3).map((state) => (
                        <Badge key={state} variant="outline" className="text-xs">
                          {state}
                        </Badge>
                      ))}
                      {(deal.listing.geographic_states?.length || 0) > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(deal.listing.geographic_states?.length || 0) - 3}
                        </Badge>
                      )}
                      {!deal.listing.geographic_states?.length && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Approved */}
                  <TableCell className="text-center">
                    {engagement.approved > 0 ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                        {engagement.approved}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Interested */}
                  <TableCell className="text-center">
                    {engagement.interested > 0 ? (
                      <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                        {engagement.interested}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Passed */}
                  <TableCell className="text-center">
                    {engagement.passed > 0 ? (
                      <span className="text-sm text-muted-foreground">
                        {engagement.passed}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Added */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(deal.added_at), { addSuffix: true })}
                    </span>
                  </TableCell>

                  {/* Revenue */}
                  <TableCell className="text-right">
                    <span className="text-sm font-medium">
                      {formatCurrency(deal.listing.revenue)}
                    </span>
                  </TableCell>

                  {/* EBITDA */}
                  <TableCell className="text-right">
                    <span className="text-sm">
                      {formatCurrency(deal.listing.ebitda)}
                    </span>
                  </TableCell>

                  {/* Score */}
                  <TableCell className="text-center">
                    {engagement.avgScore > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-medium">
                          {Math.round(engagement.avgScore)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/remarketing/deals/${deal.listing.id}`);
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Deal
                        </DropdownMenuItem>
                        {onScoreDeal && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onScoreDeal(deal.listing.id);
                            }}
                          >
                            <Target className="h-4 w-4 mr-2" />
                            Score Deal
                          </DropdownMenuItem>
                        )}
                        {onEnrichDeal && !deal.listing.enriched_at && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onEnrichDeal(deal.listing.id);
                            }}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Enrich Deal
                          </DropdownMenuItem>
                        )}
                        {onRemoveDeal && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveDeal(deal.id, deal.listing.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from Universe
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

export default UniverseDealsTable;
