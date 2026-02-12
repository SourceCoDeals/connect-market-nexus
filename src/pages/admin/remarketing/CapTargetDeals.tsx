import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Building2,
  ArrowUpDown,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { DealSourceBadge } from "@/components/remarketing/DealSourceBadge";
import { cn } from "@/lib/utils";

interface CapTargetDeal {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  captarget_client_name: string | null;
  captarget_contact_date: string | null;
  captarget_outreach_channel: string | null;
  captarget_interest_type: string | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  main_contact_title: string | null;
  main_contact_phone: string | null;
  captarget_sheet_tab: string | null;
  website: string | null;
  description: string | null;
  pushed_to_all_deals: boolean | null;
  pushed_to_all_deals_at: string | null;
  deal_source: string | null;
  status: string | null;
  created_at: string;
  enriched_at: string | null;
}

type SortColumn =
  | "company_name"
  | "client_name"
  | "contact_name"
  | "interest_type"
  | "outreach_channel"
  | "contact_date"
  | "pushed";
type SortDirection = "asc" | "desc";

export default function CapTargetDeals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [interestFilter, setInterestFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [pushedFilter, setPushedFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>("contact_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Push in progress
  const [isPushing, setIsPushing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  // Fetch CapTarget deals
  const {
    data: deals,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["remarketing", "captarget-deals"],
    refetchOnMount: "always",
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(
          `
          id,
          title,
          internal_company_name,
          captarget_client_name,
          captarget_contact_date,
          captarget_outreach_channel,
          captarget_interest_type,
          main_contact_name,
          main_contact_email,
          main_contact_title,
          main_contact_phone,
          captarget_sheet_tab,
          website,
          description,
          pushed_to_all_deals,
          pushed_to_all_deals_at,
          deal_source,
          status,
          created_at,
          enriched_at
        `
        )
        .eq("deal_source", "captarget")
        .order("captarget_contact_date", {
          ascending: false,
          nullsFirst: false,
        });

      if (error) throw error;
      return data as CapTargetDeal[];
    },
  });

  // Get unique client names for filter dropdown
  const clientNames = useMemo(() => {
    if (!deals) return [];
    const names = new Set(
      deals
        .map((d) => d.captarget_client_name)
        .filter(Boolean) as string[]
    );
    return Array.from(names).sort();
  }, [deals]);

  // Filter + sort deals
  const filteredDeals = useMemo(() => {
    if (!deals) return [];

    let filtered = deals.filter((deal) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch =
          (deal.title || "").toLowerCase().includes(q) ||
          (deal.internal_company_name || "").toLowerCase().includes(q) ||
          (deal.captarget_client_name || "").toLowerCase().includes(q) ||
          (deal.main_contact_name || "").toLowerCase().includes(q) ||
          (deal.main_contact_email || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Client filter
      if (clientFilter !== "all" && deal.captarget_client_name !== clientFilter)
        return false;

      // Interest type filter
      if (
        interestFilter !== "all" &&
        deal.captarget_interest_type !== interestFilter
      )
        return false;

      // Channel filter
      if (
        channelFilter !== "all" &&
        deal.captarget_outreach_channel !== channelFilter
      )
        return false;

      // Pushed filter
      if (pushedFilter === "pushed" && !deal.pushed_to_all_deals) return false;
      if (pushedFilter === "not_pushed" && deal.pushed_to_all_deals)
        return false;

      // Date range filter
      if (dateFrom && deal.captarget_contact_date) {
        if (deal.captarget_contact_date < dateFrom) return false;
      }
      if (dateTo && deal.captarget_contact_date) {
        if (deal.captarget_contact_date > dateTo + "T23:59:59") return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA: any, valB: any;

      switch (sortColumn) {
        case "company_name":
          valA = (a.internal_company_name || a.title || "").toLowerCase();
          valB = (b.internal_company_name || b.title || "").toLowerCase();
          break;
        case "client_name":
          valA = (a.captarget_client_name || "").toLowerCase();
          valB = (b.captarget_client_name || "").toLowerCase();
          break;
        case "contact_name":
          valA = (a.main_contact_name || "").toLowerCase();
          valB = (b.main_contact_name || "").toLowerCase();
          break;
        case "interest_type":
          valA = a.captarget_interest_type || "";
          valB = b.captarget_interest_type || "";
          break;
        case "outreach_channel":
          valA = a.captarget_outreach_channel || "";
          valB = b.captarget_outreach_channel || "";
          break;
        case "contact_date":
          valA = a.captarget_contact_date || "";
          valB = b.captarget_contact_date || "";
          break;
        case "pushed":
          valA = a.pushed_to_all_deals ? 1 : 0;
          valB = b.pushed_to_all_deals ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [
    deals,
    search,
    clientFilter,
    interestFilter,
    channelFilter,
    pushedFilter,
    dateFrom,
    dateTo,
    sortColumn,
    sortDirection,
  ]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Selection helpers
  const allSelected =
    filteredDeals.length > 0 &&
    filteredDeals.every((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDeals.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Push to All Deals
  const handlePushToAllDeals = useCallback(
    async (dealIds: string[]) => {
      if (dealIds.length === 0) return;
      setIsPushing(true);

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;

      // Filter out already-pushed deals
      const unpushedIds = dealIds.filter((id) => {
        const deal = deals?.find((d) => d.id === id);
        if (deal?.pushed_to_all_deals) {
          skippedCount++;
          return false;
        }
        return true;
      });

      for (const id of unpushedIds) {
        const { error } = await supabase
          .from("listings")
          .update({
            status: "active",
            pushed_to_all_deals: true,
            pushed_to_all_deals_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) {
          failCount++;
          console.error(`Failed to push deal ${id}:`, error);
        } else {
          successCount++;
        }
      }

      setIsPushing(false);
      setSelectedIds(new Set());

      const parts = [];
      if (successCount > 0)
        parts.push(`${successCount} deal${successCount !== 1 ? "s" : ""} pushed`);
      if (skippedCount > 0)
        parts.push(`${skippedCount} already pushed`);
      if (failCount > 0)
        parts.push(`${failCount} failed`);

      toast({
        title: "Push to All Deals",
        description: parts.join(". ") + ".",
      });

      queryClient.invalidateQueries({
        queryKey: ["remarketing", "captarget-deals"],
      });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    },
    [toast, queryClient, deals]
  );

  // Enrich selected deals
  const handleEnrichSelected = useCallback(
    async (dealIds: string[]) => {
      if (dealIds.length === 0) return;
      setIsEnriching(true);

      let queued = 0;
      for (const id of dealIds) {
        try {
          await supabase.functions.invoke("enrich-deal", {
            body: { dealId: id },
          });
          queued++;
        } catch (err) {
          console.error(`Failed to enrich deal ${id}:`, err);
        }
      }

      setIsEnriching(false);
      setSelectedIds(new Set());

      toast({
        title: "Enrichment Started",
        description: `${queued} deal${queued !== 1 ? "s" : ""} queued for enrichment.`,
      });

      // Refresh after a delay for enrichment to complete
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["remarketing", "captarget-deals"],
        });
      }, 5000);
    },
    [toast, queryClient]
  );

  const interestTypeLabel = (type: string | null) => {
    switch (type) {
      case "interest":
        return "Interest";
      case "no_interest":
        return "No Interest";
      case "keep_in_mind":
        return "Keep in Mind";
      default:
        return "Unknown";
    }
  };

  const interestTypeBadgeClass = (type: string | null) => {
    switch (type) {
      case "interest":
        return "bg-green-50 text-green-700 border-green-200";
      case "no_interest":
        return "bg-red-50 text-red-700 border-red-200";
      case "keep_in_mind":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  // Summary stats
  const totalDeals = deals?.length || 0;
  const unpushedCount =
    deals?.filter((d) => !d.pushed_to_all_deals).length || 0;
  const interestCount =
    deals?.filter((d) => d.captarget_interest_type === "interest").length || 0;

  const SortHeader = ({
    column,
    children,
  }: {
    column: SortColumn;
    children: React.ReactNode;
  }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(column)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          "h-3 w-3",
          sortColumn === column ? "text-foreground" : "text-muted-foreground/50"
        )}
      />
    </button>
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            CapTarget Deals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalDeals} total deals &middot; {unpushedCount} un-pushed &middot;{" "}
            {interestCount} showing interest
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company, client, contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Client filter */}
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Client Name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clientNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Interest type filter */}
            <Select value={interestFilter} onValueChange={setInterestFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Interest Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="interest">Interest</SelectItem>
                <SelectItem value="no_interest">No Interest</SelectItem>
                <SelectItem value="keep_in_mind">Keep in Mind</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            {/* Channel filter */}
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="Cold Call">Cold Call</SelectItem>
                <SelectItem value="Cold Email">Cold Email</SelectItem>
                <SelectItem value="Not Interested">Not Interested</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            {/* Pushed filter */}
            <Select value={pushedFilter} onValueChange={setPushedFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Pushed Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pushed">Pushed</SelectItem>
                <SelectItem value="not_pushed">Not Pushed</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px] h-9"
                placeholder="From"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px] h-9"
                placeholder="To"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} deal{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            onClick={() => handlePushToAllDeals(Array.from(selectedIds))}
            disabled={isPushing}
            className="gap-2"
          >
            {isPushing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Push to All Deals
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEnrichSelected(Array.from(selectedIds))}
            disabled={isEnriching}
            className="gap-2"
          >
            {isEnriching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Enrich Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Deals Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader column="company_name">Company</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="client_name">Client</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="contact_name">Contact</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="interest_type">Interest</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="outreach_channel">Channel</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="contact_date">Date</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="pushed">Pushed</SortHeader>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-medium">No CapTarget deals found</p>
                      <p className="text-sm mt-1">
                        Deals will appear here after the nightly sync runs.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeals.map((deal) => (
                    <TableRow
                      key={deal.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        deal.pushed_to_all_deals && "bg-green-50/60 hover:bg-green-50"
                      )}
                      onClick={() =>
                        navigate(
                          `/admin/remarketing/captarget-deals/${deal.id}`,
                          { state: { from: "/admin/remarketing/captarget-deals" } }
                        )
                      }
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className="w-[40px]"
                      >
                        <Checkbox
                          checked={selectedIds.has(deal.id)}
                          onCheckedChange={() => toggleSelect(deal.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground truncate max-w-[220px]">
                            {deal.internal_company_name || deal.title || "—"}
                          </span>
                          {deal.website && (
                            <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                              {deal.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-[160px] block">
                          {deal.captarget_client_name || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {deal.main_contact_name || "—"}
                          </span>
                          {deal.main_contact_title && (
                            <span className="text-xs text-muted-foreground">
                              {deal.main_contact_title}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={interestTypeBadgeClass(
                            deal.captarget_interest_type
                          )}
                        >
                          {interestTypeLabel(deal.captarget_interest_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {deal.captarget_outreach_channel || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {deal.captarget_contact_date
                            ? format(
                                new Date(deal.captarget_contact_date),
                                "MMM d, yyyy"
                              )
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {deal.pushed_to_all_deals ? (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200 gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Pushed
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Footer stats */}
      <p className="text-xs text-muted-foreground text-center">
        Showing {filteredDeals.length} of {totalDeals} deals
      </p>
    </div>
  );
}
