import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  MoreVertical,
  Eye,
  ThumbsUp,
  XCircle,
  EyeOff,
  Sparkles,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
} from "lucide-react";
import { PassReasonDialog } from "./PassReasonDialog";

interface BuyerScore {
  id: string;
  buyer_id: string;
  deal_id: string;
  composite_score: number | null;
  geography_score: number | null;
  service_score: number | null;
  size_match: boolean | null;
  selected_for_outreach: boolean | null;
  passed_on_deal: boolean | null;
  pass_category: string | null;
  pass_reason: string | null;
  interested: boolean | null;
  hidden_from_deal: boolean | null;
  scored_at: string;
  buyer: {
    pe_firm_name: string;
    platform_company_name: string | null;
  };
}

interface DealMatchedBuyersTabProps {
  dealId: string;
}

type FilterTab = "all" | "selected" | "interested" | "passed" | "hidden" | "unscored";
type SortField = "score" | "name" | "pe_firm" | "status";
type SortDirection = "asc" | "desc";

export function DealMatchedBuyersTab({ dealId }: DealMatchedBuyersTabProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [buyerScores, setBuyerScores] = useState<BuyerScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [isPassDialogOpen, setIsPassDialogOpen] = useState(false);

  useEffect(() => {
    loadBuyerScores();
  }, [dealId]);

  const loadBuyerScores = async () => {
    try {
      const { data, error } = await supabase
        .from("buyer_deal_scores")
        .select(`
          *,
          buyer:remarketing_buyers!buyer_id(
            pe_firm_name,
            platform_company_name
          )
        `)
        .eq("deal_id", dealId)
        .order("composite_score", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setBuyerScores((data as any[]) || []);
    } catch (error: any) {
      toast({
        title: "Error loading buyer matches",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculateScores = async () => {
    try {
      const { error } = await supabase.functions.invoke("score-deal-buyers", {
        body: { dealId },
      });

      if (error) throw error;

      toast({
        title: "Recalculation started",
        description: "Buyer scores are being recalculated in the background",
      });

      setTimeout(() => {
        loadBuyerScores();
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Error recalculating scores",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMarkInterested = async (buyerId: string) => {
    try {
      const score = buyerScores.find((s) => s.buyer_id === buyerId);
      if (!score) return;

      const { error } = await supabase
        .from("buyer_deal_scores")
        .update({
          interested: true,
          interested_at: new Date().toISOString(),
        })
        .eq("id", score.id);

      if (error) throw error;

      toast({
        title: "Buyer marked as interested",
        description: "This buyer has been marked as interested in the deal",
      });

      loadBuyerScores();
    } catch (error: any) {
      toast({
        title: "Error updating buyer status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePass = (buyerId: string) => {
    setSelectedBuyerId(buyerId);
    setIsPassDialogOpen(true);
  };

  const handleToggleHidden = async (buyerId: string) => {
    try {
      const score = buyerScores.find((s) => s.buyer_id === buyerId);
      if (!score) return;

      const { error } = await supabase
        .from("buyer_deal_scores")
        .update({
          hidden_from_deal: !score.hidden_from_deal,
        })
        .eq("id", score.id);

      if (error) throw error;

      toast({
        title: score.hidden_from_deal ? "Buyer unhidden" : "Buyer hidden",
        description: score.hidden_from_deal
          ? "This buyer is now visible"
          : "This buyer is now hidden from this deal",
      });

      loadBuyerScores();
    } catch (error: any) {
      toast({
        title: "Error updating buyer visibility",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredAndSortedScores = useMemo(() => {
    let filtered = buyerScores;

    // Apply filter
    switch (filterTab) {
      case "selected":
        filtered = filtered.filter((s) => s.selected_for_outreach);
        break;
      case "interested":
        filtered = filtered.filter((s) => s.interested);
        break;
      case "passed":
        filtered = filtered.filter((s) => s.passed_on_deal);
        break;
      case "hidden":
        filtered = filtered.filter((s) => s.hidden_from_deal);
        break;
      case "unscored":
        filtered = filtered.filter((s) => s.composite_score === null);
        break;
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.buyer.pe_firm_name.toLowerCase().includes(query) ||
          s.buyer.platform_company_name?.toLowerCase().includes(query)
      );
    }

    // Apply sort
    filtered = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "score":
          aValue = a.composite_score ?? -1;
          bValue = b.composite_score ?? -1;
          break;
        case "name":
          aValue = a.buyer.platform_company_name || a.buyer.pe_firm_name;
          bValue = b.buyer.platform_company_name || b.buyer.pe_firm_name;
          break;
        case "pe_firm":
          aValue = a.buyer.pe_firm_name;
          bValue = b.buyer.pe_firm_name;
          break;
        case "status":
          aValue = a.selected_for_outreach
            ? 4
            : a.interested
            ? 3
            : a.passed_on_deal
            ? 2
            : a.hidden_from_deal
            ? 1
            : 0;
          bValue = b.selected_for_outreach
            ? 4
            : b.interested
            ? 3
            : b.passed_on_deal
            ? 2
            : b.hidden_from_deal
            ? 1
            : 0;
          break;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [buyerScores, filterTab, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    );
  };

  const getStatusBadge = (score: BuyerScore) => {
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
    return <Badge variant="outline">—</Badge>;
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-green-600 font-semibold";
    if (score >= 60) return "text-yellow-600 font-medium";
    return "text-orange-600";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Matched Buyers</CardTitle>
              <CardDescription>
                Buyers scored and matched to this deal
              </CardDescription>
            </div>
            <Button onClick={handleRecalculateScores} variant="outline">
              <Sparkles className="w-4 h-4 mr-2" />
              Recalculate All Scores
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex items-center justify-between gap-4">
            <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="selected">Selected</TabsTrigger>
                <TabsTrigger value="interested">Interested</TabsTrigger>
                <TabsTrigger value="passed">Passed</TabsTrigger>
                <TabsTrigger value="hidden">Hidden</TabsTrigger>
                <TabsTrigger value="unscored">Unscored</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search buyers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Table */}
          {filteredAndSortedScores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No buyer matches found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleRecalculateScores}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Calculate Buyer Scores
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("name")}
                      className="h-8 px-2"
                    >
                      Buyer Name
                      {getSortIcon("name")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("pe_firm")}
                      className="h-8 px-2"
                    >
                      PE Firm
                      {getSortIcon("pe_firm")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("score")}
                      className="h-8 px-2"
                    >
                      Score
                      {getSortIcon("score")}
                    </Button>
                  </TableHead>
                  <TableHead>Geo</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort("status")}
                      className="h-8 px-2"
                    >
                      Status
                      {getSortIcon("status")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedScores.map((score, index) => (
                  <TableRow key={score.id}>
                    <TableCell className="font-medium">#{index + 1}</TableCell>
                    <TableCell>
                      <button
                        onClick={() =>
                          navigate(
                            `/admin/ma-intelligence/buyers/${score.buyer_id}?dealId=${dealId}`
                          )
                        }
                        className="text-primary hover:underline text-left"
                      >
                        {score.buyer.platform_company_name || score.buyer.pe_firm_name}
                      </button>
                    </TableCell>
                    <TableCell>{score.buyer.pe_firm_name}</TableCell>
                    <TableCell>
                      {score.composite_score !== null ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={getScoreColor(score.composite_score)}>
                                {score.composite_score}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                <div>Geography: {score.geography_score ?? "—"}</div>
                                <div>Service: {score.service_score ?? "—"}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {score.geography_score !== null ? (
                        <span className={getScoreColor(score.geography_score)}>
                          {score.geography_score}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {score.service_score !== null ? (
                        <span className={getScoreColor(score.service_score)}>
                          {score.service_score}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {score.size_match ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(score)}
                      {score.passed_on_deal && score.pass_reason && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground ml-1 cursor-help">
                                (?)
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs max-w-xs">
                                <div className="font-medium">{score.pass_category}</div>
                                <div>{score.pass_reason}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(
                                `/admin/ma-intelligence/buyers/${score.buyer_id}?dealId=${dealId}`
                              )
                            }
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Buyer in Context
                          </DropdownMenuItem>
                          {!score.interested && !score.passed_on_deal && (
                            <DropdownMenuItem
                              onClick={() => handleMarkInterested(score.buyer_id)}
                            >
                              <ThumbsUp className="w-4 h-4 mr-2" />
                              Mark Interested
                            </DropdownMenuItem>
                          )}
                          {!score.passed_on_deal && (
                            <DropdownMenuItem onClick={() => handlePass(score.buyer_id)}>
                              <XCircle className="w-4 h-4 mr-2" />
                              Pass on Buyer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleToggleHidden(score.buyer_id)}
                          >
                            <EyeOff className="w-4 h-4 mr-2" />
                            {score.hidden_from_deal ? "Unhide" : "Hide"} Buyer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pass Reason Dialog */}
      {selectedBuyerId && (
        <PassReasonDialog
          buyerId={selectedBuyerId}
          dealId={dealId}
          isOpen={isPassDialogOpen}
          onClose={() => {
            setIsPassDialogOpen(false);
            setSelectedBuyerId(null);
          }}
          onPass={() => {
            toast({
              title: "Buyer passed",
              description: "The buyer has been marked as passed for this deal",
            });
            loadBuyerScores();
            setIsPassDialogOpen(false);
            setSelectedBuyerId(null);
          }}
        />
      )}
    </>
  );
}
