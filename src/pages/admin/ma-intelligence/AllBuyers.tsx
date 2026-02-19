import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Users, Search, FileCheck, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

type SortColumn = "name" | "pe_firm" | "industry" | "confidence";
type SortDirection = "asc" | "desc";

interface BuyerRow {
  id: string;
  pe_firm_name: string;
  platform_company_name: string | null;
  platform_website: string | null;
  thesis_summary: string | null;
  thesis_confidence: string | null;
  industry_vertical: string | null;
  tracker_id: string;
  has_fee_agreement: boolean | null;
  fee_agreement_status: string | null;
}

export default function MAAllBuyers() {
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [trackers, setTrackers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Sorting — persisted in URL for back-navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const sortColumn = (searchParams.get("sort") as SortColumn) || "name";
  const sortDirection = (searchParams.get("dir") as SortDirection) || "asc";
  const setSortColumn = (col: SortColumn) => {
    setSearchParams(prev => { prev.set("sort", col); return prev; }, { replace: true });
  };
  const setSortDirection = (dir: SortDirection) => {
    setSearchParams(prev => { prev.set("dir", dir); return prev; }, { replace: true });
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
    const [trackersRes, buyersRes] = await Promise.all([
      supabase.from("industry_trackers").select("id, name").limit(500),
      supabase.from("remarketing_buyers").select("*").order("company_name").limit(2000),
    ]);

    const trackerMap: Record<string, string> = {};
    ((trackersRes.data || []) as any[]).forEach((t) => {
      trackerMap[t.id] = t.name || t.industry_name || 'Unknown';
    });
    setTrackers(trackerMap);

    // Map remarketing_buyers to BuyerRow interface
    const mappedBuyers: BuyerRow[] = ((buyersRes.data || []) as any[]).map((b) => ({
      id: b.id,
      pe_firm_name: b.company_name || b.pe_firm_name || 'Unknown',
      platform_company_name: b.platform_company_name ?? null,
      platform_website: b.platform_website ?? null,
      thesis_summary: b.thesis_summary ?? null,
      thesis_confidence: b.thesis_confidence ?? null,
      industry_vertical: b.industry_vertical ?? null,
      tracker_id: b.industry_tracker_id || b.tracker_id || '',
      has_fee_agreement: b.has_fee_agreement ?? null,
      fee_agreement_status: b.fee_agreement_status ?? null,
    }));
    setBuyers(mappedBuyers);
    setIsLoading(false);
    } catch (error: any) {
      console.error("Failed to load buyers:", error);
      setIsLoading(false);
    }
  };

  const filteredBuyers = useMemo(() => {
    if (!search) return buyers;
    const searchLower = search.toLowerCase();
    return buyers.filter(b =>
      (b.platform_company_name || b.pe_firm_name).toLowerCase().includes(searchLower) ||
      b.pe_firm_name.toLowerCase().includes(searchLower) ||
      (b.industry_vertical?.toLowerCase().includes(searchLower)) ||
      (b.thesis_summary?.toLowerCase().includes(searchLower))
    );
  }, [buyers, search]);

  const sortedBuyers = useMemo(() => {
    return [...filteredBuyers].sort((a, b) => {
      let aVal: string, bVal: string;

      switch (sortColumn) {
        case "name":
          aVal = (a.platform_company_name || a.pe_firm_name).toLowerCase();
          bVal = (b.platform_company_name || b.pe_firm_name).toLowerCase();
          break;
        case "pe_firm":
          aVal = a.pe_firm_name.toLowerCase();
          bVal = b.pe_firm_name.toLowerCase();
          break;
        case "industry":
          aVal = (a.industry_vertical || "").toLowerCase();
          bVal = (b.industry_vertical || "").toLowerCase();
          break;
        case "confidence": {
          const order = { high: 3, medium: 2, low: 1 };
          const aOrder = order[(a.thesis_confidence?.toLowerCase() as keyof typeof order)] || 0;
          const bOrder = order[(b.thesis_confidence?.toLowerCase() as keyof typeof order)] || 0;
          return sortDirection === "asc" ? aOrder - bOrder : bOrder - aOrder;
        }
        default:
          return 0;
      }

      const comparison = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredBuyers, sortColumn, sortDirection]);

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortableHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <TableHead>
      <button
        onClick={() => toggleSort(column)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortColumn === column ? (
          sortDirection === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );

  const uniqueFirms = new Set(buyers.map(b => b.pe_firm_name)).size;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Buyers</h1>
            <p className="text-muted-foreground">
              {uniqueFirms} PE firm{uniqueFirms !== 1 ? "s" : ""} · {buyers.length} platform{buyers.length !== 1 ? "s" : ""}
              {search && <span className="text-primary"> (filtered: {filteredBuyers.length})</span>}
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search platforms, PE firms, industries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {sortedBuyers.length === 0 ? (
          <div className="bg-card rounded-lg border p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">
              {search ? "No matches found" : "No buyers yet"}
            </h3>
            <p className="text-muted-foreground">
              {search
                ? "Try a different search term"
                : "Add buyers to a universe to get started."
              }
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortableHeader column="name">Platform</SortableHeader>
                  <SortableHeader column="pe_firm">PE Firm</SortableHeader>
                  <SortableHeader column="industry">Industry</SortableHeader>
                  <TableHead>Thesis</TableHead>
                  <TableHead className="text-center">Fee Agreement</TableHead>
                  <SortableHeader column="confidence">Confidence</SortableHeader>
                  <TableHead>Buyer Universe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBuyers.map((buyer) => {
                  const trackerName = trackers[buyer.tracker_id];

                  return (
                    <TableRow key={buyer.id} className="group">
                      <TableCell className="font-medium">
                        <Link to={`/admin/ma-intelligence/buyers/${buyer.id}`} className="hover:text-primary transition-colors">
                          {buyer.platform_company_name || buyer.pe_firm_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {buyer.pe_firm_name}
                      </TableCell>
                      <TableCell>
                        {buyer.industry_vertical ? (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {buyer.industry_vertical}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        {buyer.thesis_summary ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground truncate block cursor-default">
                                {buyer.thesis_summary}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm">{buyer.thesis_summary}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {(buyer.has_fee_agreement || buyer.fee_agreement_status === 'Signed') && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1 bg-primary/10 border-primary/20 w-fit mx-auto">
                            <FileCheck className="w-3 h-3" />
                            Signed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {buyer.thesis_confidence ? (
                          <Badge
                            variant={buyer.thesis_confidence.toLowerCase() === "high" ? "default" : "secondary"}
                            className="text-xs capitalize"
                          >
                            {buyer.thesis_confidence}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {trackerName ? (
                          <Badge variant="secondary" className="text-xs">
                            {trackerName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
