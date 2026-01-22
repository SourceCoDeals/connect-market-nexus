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
  Building2, 
  MapPin, 
  TrendingUp,
  Users,
  Target
} from "lucide-react";
import { ScoreTierBadge } from "./ScoreTierBadge";
import type { ScoreTier } from "@/types/remarketing";

interface DealScore {
  listing_id: string;
  listing_title?: string;
  listing_location?: string;
  listing_revenue?: number;
  listing_ebitda?: number;
  total_buyers_scored: number;
  tier_a_count: number;
  tier_b_count: number;
  avg_score: number;
}

interface UniverseDealsTableProps {
  deals: DealScore[];
  onScoreDeal?: (listingId: string) => void;
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
  onScoreDeal,
}: UniverseDealsTableProps) => {
  const navigate = useNavigate();

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px]">Deal</TableHead>
            <TableHead className="w-[120px]">Revenue</TableHead>
            <TableHead className="w-[120px]">EBITDA</TableHead>
            <TableHead className="w-[100px] text-center">Buyers Scored</TableHead>
            <TableHead className="w-[160px]">Top Matches</TableHead>
            <TableHead className="w-[100px]">Avg Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No deals scored yet</p>
                <p className="text-sm">Go to Deal Matching to score buyers against listings</p>
              </TableCell>
            </TableRow>
          ) : (
            deals.map((deal) => (
              <TableRow
                key={deal.listing_id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/admin/remarketing/deal-matching?listing=${deal.listing_id}`)}
              >
                {/* Deal Column */}
                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-foreground line-clamp-1">
                        {deal.listing_title || 'Untitled Deal'}
                      </span>
                      {deal.listing_location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {deal.listing_location}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Revenue Column */}
                <TableCell>
                  <span className="text-sm font-medium">
                    {formatCurrency(deal.listing_revenue)}
                  </span>
                </TableCell>

                {/* EBITDA Column */}
                <TableCell>
                  <span className="text-sm">
                    {formatCurrency(deal.listing_ebitda)}
                  </span>
                </TableCell>

                {/* Buyers Scored Column */}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{deal.total_buyers_scored}</span>
                  </div>
                </TableCell>

                {/* Top Matches Column */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {deal.tier_a_count > 0 && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                            {deal.tier_a_count} A
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {deal.tier_a_count} Tier A matches
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {deal.tier_b_count > 0 && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="secondary">
                            {deal.tier_b_count} B
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {deal.tier_b_count} Tier B matches
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {deal.tier_a_count === 0 && deal.tier_b_count === 0 && (
                      <span className="text-sm text-muted-foreground">No top matches</span>
                    )}
                  </div>
                </TableCell>

                {/* Avg Score Column */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, deal.avg_score)}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(deal.avg_score)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
};

export default UniverseDealsTable;
