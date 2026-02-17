import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ExternalLink,
  MoreVertical,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";

interface BuyerDealScore {
  id: string;
  buyer_id: string;
  deal_id: string;
  scored_at: string;
  geography_score: number | null;
  service_score: number | null;
  acquisition_score: number | null;
  portfolio_score: number | null;
  business_model_score: number | null;
  thesis_bonus: number | null;
  composite_score: number | null;
  fit_reasoning: string | null;
  selected_for_outreach: boolean | null;
  passed_on_deal: boolean | null;
  passed_at: string | null;
  pass_category: string | null;
  pass_reason: string | null;
  interested: boolean | null;
  hidden_from_deal: boolean | null;
  deal?: {
    id: string;
    title: string;
    listing_id: string | null;
  };
  tracker?: {
    id: string;
    name: string;
  };
}

interface BuyerDealHistoryTabProps {
  buyerId: string;
}

type FilterStatus = "all" | "selected" | "interested" | "passed" | "hidden";

export function BuyerDealHistoryTab({ buyerId }: BuyerDealHistoryTabProps) {
  const [dealScores, setDealScores] = useState<BuyerDealScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const { toast } = useToast();

  useEffect(() => {
    loadDealScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId]);

  const loadDealScores = async () => {
    try {
      const { data: scoresData, error: scoresError } = await supabase
        .from("buyer_deal_scores")
        .select("*")
        .eq("buyer_id", buyerId)
        .order("scored_at", { ascending: false });

      if (scoresError) throw scoresError;

      // Load deal info (deals table uses 'title', not 'deal_name')
      const dealIds = scoresData?.map((s) => s.deal_id) || [];
      
      const { data: dealsData } = await supabase
        .from("deals")
        .select("id, title, listing_id")
        .in("id", dealIds);

      // For now, skip tracker lookup since deals don't have tracker_id
      // Map data
      const enrichedScores = scoresData?.map((score) => {
        const deal = dealsData?.find((d) => d.id === score.deal_id);
        return {
          ...score,
          deal: deal ? {
            id: deal.id,
            title: deal.title || 'Unknown Deal',
            listing_id: deal.listing_id
          } : undefined,
          tracker: undefined,
        };
      });

      setDealScores((enrichedScores || []) as BuyerDealScore[]);
    } catch (error: any) {
      toast({
        title: "Error loading deal history",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDealScores = useMemo(() => {
    switch (filterStatus) {
      case "selected":
        return dealScores.filter((score) => score.selected_for_outreach);
      case "interested":
        return dealScores.filter((score) => score.interested);
      case "passed":
        return dealScores.filter((score) => score.passed_on_deal);
      case "hidden":
        return dealScores.filter((score) => score.hidden_from_deal);
      default:
        return dealScores;
    }
  }, [dealScores, filterStatus]);

  const handleToggleHidden = async (scoreId: string, currentlyHidden: boolean) => {
    try {
      const { error } = await supabase
        .from("buyer_deal_scores")
        .update({ hidden_from_deal: !currentlyHidden })
        .eq("id", scoreId);

      if (error) throw error;

      toast({
        title: currentlyHidden ? "Deal unhidden" : "Deal hidden",
        description: currentlyHidden
          ? "The deal is now visible"
          : "The deal has been hidden from this buyer",
      });

      loadDealScores();
    } catch (error: any) {
      toast({
        title: "Error updating deal",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (score: BuyerDealScore) => {
    if (score.selected_for_outreach) {
      return <Badge variant="default">Selected</Badge>;
    }
    if (score.interested) {
      return <Badge variant="secondary">Interested</Badge>;
    }
    if (score.passed_on_deal) {
      return <Badge variant="outline">Passed</Badge>;
    }
    if (score.hidden_from_deal) {
      return <Badge variant="outline">Hidden</Badge>;
    }
    return <Badge variant="secondary">Scored</Badge>;
  };

  const getScoreBadgeVariant = (score: number | null) => {
    if (!score) return "outline";
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "outline";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
        <TabsList>
          <TabsTrigger value="all">
            All ({dealScores.length})
          </TabsTrigger>
          <TabsTrigger value="selected">
            Selected ({dealScores.filter((s) => s.selected_for_outreach).length})
          </TabsTrigger>
          <TabsTrigger value="interested">
            Interested ({dealScores.filter((s) => s.interested).length})
          </TabsTrigger>
          <TabsTrigger value="passed">
            Passed ({dealScores.filter((s) => s.passed_on_deal).length})
          </TabsTrigger>
          <TabsTrigger value="hidden">
            Hidden ({dealScores.filter((s) => s.hidden_from_deal).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Deal Scores Table */}
      {filteredDealScores.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No deals found for this filter</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal Name</TableHead>
                <TableHead>Tracker</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Geography</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pass Reason</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDealScores.map((score) => (
                <TableRow key={score.id}>
                  <TableCell>
                    <Link
                      to={`/admin/ma-intelligence/deals/${score.deal_id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {score.deal?.title || "Unknown Deal"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {score.tracker?.name || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Badge variant={getScoreBadgeVariant(score.composite_score)}>
                              {score.composite_score?.toFixed(0) || "—"}
                            </Badge>
                            {score.fit_reasoning && (
                              <Info className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                        </TooltipTrigger>
                        {score.fit_reasoning && (
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">{score.fit_reasoning}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {score.geography_score?.toFixed(0) || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {score.service_score?.toFixed(0) || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(score)}</TableCell>
                  <TableCell>
                    {score.passed_on_deal && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-sm text-muted-foreground">
                              {score.pass_category}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-medium">
                                Category: {score.pass_category}
                              </p>
                              {score.pass_reason && (
                                <p className="text-sm">{score.pass_reason}</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/ma-intelligence/deals/${score.deal_id}`}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Deal
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggleHidden(
                              score.id,
                              score.hidden_from_deal || false
                            )
                          }
                        >
                          {score.hidden_from_deal ? (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Unhide
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
