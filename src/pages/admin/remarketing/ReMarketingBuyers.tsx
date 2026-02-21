import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Plus,
  MoreHorizontal,
  Users,
  Building,
  Pencil,
  Trash2,
  ExternalLink,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { BuyerCSVImport, IntelligenceBadge, ReMarketingChat } from "@/components/remarketing";
import type { BuyerType, DataCompleteness } from "@/types/remarketing";
import { normalizeDomain } from "@/lib/ma-intelligence/normalizeDomain";

const BUYER_TYPES: { value: BuyerType; label: string }[] = [
  { value: 'pe_firm', label: 'PE Firm' },
  { value: 'platform', label: 'Platform' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'other', label: 'Other' },
];

type BuyerTab = 'all' | 'pe_firm' | 'platform' | 'needs_agreements' | 'needs_enrichment';

const PAGE_SIZE = 50;

const ReMarketingBuyers = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const initialTab = (searchParams.get("tab") as BuyerTab) || 'all';
  const [activeTab, setActiveTab] = useState<BuyerTab>(initialTab);
  const universeFilter = searchParams.get("universe") ?? "all";
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const sortColumn = searchParams.get("sort") ?? "company_name";
  const sortDirection = (searchParams.get("dir") as "asc" | "desc") ?? "asc";
  // New buyer form state
  const [newBuyer, setNewBuyer] = useState({
    company_name: "",
    company_website: "",
    buyer_type: "" as BuyerType | "",
    universe_id: "",
    thesis_summary: "",
    notes: "",
  });

  // Fetch buyers with universe + firm agreement info (for NDA/marketplace)
  const { data: buyers, isLoading: buyersLoading } = useQuery({
    queryKey: ['remarketing', 'buyers', universeFilter],
    queryFn: async () => {
      let query = supabase
        .from('remarketing_buyers')
        .select(`
          *,
          universe:remarketing_buyer_universes(id, name),
          firm_agreement:firm_agreements!remarketing_buyers_marketplace_firm_id_fkey(
            id,
            nda_signed,
            nda_signed_at,
            fee_agreement_signed,
            fee_agreement_signed_at,
            primary_company_name
          )
        `)
        .eq('archived', false)
        .order('company_name');

      // Filter by universe
      if (universeFilter !== "all") {
        query = query.eq('universe_id', universeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Fetch buyer IDs that have transcripts - needed to determine "Strong" vs "Some Intel"
  const { data: buyerIdsWithTranscripts } = useQuery({
    queryKey: ['remarketing', 'all-buyer-transcripts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buyer_transcripts')
        .select('buyer_id');
      
      if (error) {
        console.error('Error fetching transcripts:', error);
        return new Set<string>();
      }
      
      return new Set((data || []).map((t: any) => t.buyer_id));
    },
  });

  // Fetch universes for filter/dropdown
  const { data: universes } = useQuery({
    queryKey: ['remarketing', 'universes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('id, name')
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Compute tab counts from loaded buyers
  const tabCounts = useMemo(() => {
    if (!buyers) return { all: 0, pe_firm: 0, platform: 0, needs_agreements: 0, needs_enrichment: 0 };
    let pe_firm = 0, platform = 0, needs_agreements = 0, needs_enrichment = 0;
    buyers.forEach((b: any) => {
      if (b.buyer_type === 'pe_firm') pe_firm++;
      if (b.buyer_type === 'platform' || !b.buyer_type) platform++;
      if (!b.has_fee_agreement) needs_agreements++;
      if (b.data_completeness !== 'high') needs_enrichment++;
    });
    return { all: buyers.length, pe_firm, platform, needs_agreements, needs_enrichment };
  }, [buyers]);

  // Create buyer mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      // Normalize website for dedup
      const normalizedWebsite = normalizeDomain(newBuyer.company_website) || newBuyer.company_website?.trim() || null;
      const universeId = newBuyer.universe_id || null;

      // Check for duplicate buyer by domain
      if (normalizedWebsite) {
        const query = supabase
          .from('remarketing_buyers')
          .select('id, company_name, company_website')
          .eq('archived', false)
          .not('company_website', 'is', null);

        if (universeId) {
          query.eq('universe_id', universeId);
        } else {
          query.is('universe_id', null);
        }

        const { data: existingBuyers } = await query;
        const duplicate = existingBuyers?.find(b =>
          normalizeDomain(b.company_website) === normalizedWebsite
        );
        if (duplicate) {
          throw new Error(`A buyer with this website already exists: "${duplicate.company_name}"`);
        }
      }

      const { error } = await supabase
        .from('remarketing_buyers')
        .insert({
          company_name: newBuyer.company_name,
          company_website: normalizedWebsite,
          buyer_type: newBuyer.buyer_type || null,
          universe_id: universeId,
          thesis_summary: newBuyer.thesis_summary || null,
          notes: newBuyer.notes || null,
        });

      if (error) {
        if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
          throw new Error("A buyer with this website already exists.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      toast.success(`${newBuyer.company_name} has been added.`);
      setNewBuyer({ company_name: "", company_website: "", buyer_type: "", universe_id: "", thesis_summary: "", notes: "" });
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Delete buyer mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('remarketing_buyers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      toast.success("Buyer deleted");
    }
  });

  // Filter buyers by tab + search
  const filteredBuyers = useMemo(() => {
    if (!buyers) return [];
    let result = buyers as any[];

    // Tab filter
    switch (activeTab) {
      case 'pe_firm':
        result = result.filter(b => b.buyer_type === 'pe_firm');
        break;
      case 'platform':
        result = result.filter(b => b.buyer_type === 'platform' || !b.buyer_type);
        break;
      case 'needs_agreements':
        result = result.filter(b => !b.has_fee_agreement);
        break;
      case 'needs_enrichment':
        result = result.filter(b => b.data_completeness !== 'high');
        break;
    }

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(b =>
        b.company_name?.toLowerCase().includes(searchLower) ||
        b.company_website?.toLowerCase().includes(searchLower) ||
        b.thesis_summary?.toLowerCase().includes(searchLower) ||
        b.pe_firm_name?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case 'company_name':
          valA = a.company_name?.toLowerCase() || '';
          valB = b.company_name?.toLowerCase() || '';
          break;
        case 'pe_firm_name':
          valA = a.pe_firm_name?.toLowerCase() || '';
          valB = b.pe_firm_name?.toLowerCase() || '';
          break;
        case 'universe':
          valA = (a as any).universe?.name?.toLowerCase() || '';
          valB = (b as any).universe?.name?.toLowerCase() || '';
          break;
        default:
          valA = a.company_name?.toLowerCase() || '';
          valB = b.company_name?.toLowerCase() || '';
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [buyers, search, sortColumn, sortDirection, activeTab]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredBuyers.length / PAGE_SIZE));
  const pagedBuyers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredBuyers.slice(start, start + PAGE_SIZE);
  }, [filteredBuyers, currentPage]);

  // Reset to page 1 when filters/search/tab change
  const handleTabChange = (v: string) => {
    setActiveTab(v as BuyerTab);
    setSelectedIds(new Set());
    setCurrentPage(1);
  };

  // Enrich single buyer
  const handleEnrichBuyer = async (e: React.MouseEvent, buyerId: string) => {
    e.stopPropagation();
    setEnrichingIds(prev => new Set(prev).add(buyerId));
    try {
      const { error } = await supabase.functions.invoke('enrich-buyer', {
        body: { buyerId, force: false },
      });
      if (error) throw error;
      toast.success('Enrichment started');
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
    } catch (err: any) {
      toast.error(err.message || 'Enrichment failed');
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(buyerId);
        return next;
      });
    }
  };

  const handleSort = (column: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("sort") === column) {
        next.set("dir", next.get("dir") === "asc" ? "desc" : "asc");
      } else {
        next.set("sort", column);
        next.set("dir", "asc");
      }
      return next;
    }, { replace: true });
  };

  const setUniverseFilter = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "all") next.delete("universe");
      else next.set("universe", value);
      return next;
    }, { replace: true });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> 
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  // Using IntelligenceBadge component instead of icons

  const getBuyerTypeLabel = (type: string | null) => {
    const found = BUYER_TYPES.find(t => t.value === type);
    return found?.label || type || '-';
  };

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBuyers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBuyers.map((b: any) => b.id)));
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = filteredBuyers.filter((b: any) => selectedIds.size === 0 || selectedIds.has(b.id));
    const headers = ['Company Name', 'Buyer Type', 'PE Firm', 'Website', 'Location', 'Thesis', 'Fee Agreement', 'NDA'];
    const csv = [
      headers.join(','),
      ...rows.map((b: any) => [
        `"${(b.company_name || '').replace(/"/g, '""')}"`,
        b.buyer_type || '',
        `"${(b.pe_firm_name || '').replace(/"/g, '""')}"`,
        b.company_website || '',
        [b.hq_city, b.hq_state].filter(Boolean).join(' '),
        `"${(b.thesis_summary || '').replace(/"/g, '""').substring(0, 200)}"`,
        b.has_fee_agreement ? 'Yes' : 'No',
        b.nda_signed ? 'Yes' : 'No',
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'buyers.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} buyers`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Buyers</h1>
          <p className="text-muted-foreground">
            {tabCounts.all} buyers · {tabCounts.needs_agreements} need agreements · {tabCounts.needs_enrichment} need enrichment
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BuyerCSVImport />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={enrichingIds.size > 0 || filteredBuyers.length === 0}
            onClick={async () => {
              const ids = selectedIds.size > 0 ? Array.from(selectedIds) : filteredBuyers.map((b: any) => b.id);
              if (ids.length === 0) return;
              setEnrichingIds(new Set(ids));
              try {
                const { queueBuyerEnrichment } = await import("@/lib/remarketing/queueEnrichment");
                await queueBuyerEnrichment(ids);
                queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
              } catch (err) {
                console.error('Bulk enrich failed:', err);
                toast.error('Failed to queue enrichment');
              } finally {
                setEnrichingIds(new Set());
              }
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {enrichingIds.size > 0 ? `Enriching…` : selectedIds.size > 0 ? `Enrich Selected (${selectedIds.size})` : 'Enrich All'}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Buyer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Buyer</DialogTitle>
                <DialogDescription>
                  Add a new buyer to your database. You can enrich their data later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    placeholder="e.g., Apex Capital Partners"
                    value={newBuyer.company_name}
                    onChange={(e) => setNewBuyer({ ...newBuyer, company_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_website">Website</Label>
                  <Input
                    id="company_website"
                    placeholder="https://example.com"
                    value={newBuyer.company_website}
                    onChange={(e) => setNewBuyer({ ...newBuyer, company_website: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="buyer_type">Buyer Type</Label>
                    <Select
                      value={newBuyer.buyer_type}
                      onValueChange={(value) => setNewBuyer({ ...newBuyer, buyer_type: value as BuyerType })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUYER_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="universe_id">Buyer Universe</Label>
                    <Select
                      value={newBuyer.universe_id}
                      onValueChange={(value) => setNewBuyer({ ...newBuyer, universe_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select universe" />
                      </SelectTrigger>
                      <SelectContent>
                        {universes?.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="thesis_summary">Investment Thesis</Label>
                  <Textarea
                    id="thesis_summary"
                    placeholder="Brief description of their investment focus..."
                    value={newBuyer.thesis_summary}
                    onChange={(e) => setNewBuyer({ ...newBuyer, thesis_summary: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes..."
                    value={newBuyer.notes}
                    onChange={(e) => setNewBuyer({ ...newBuyer, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createMutation.mutate()}
                  disabled={!newBuyer.company_name.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "Adding..." : "Add Buyer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All Buyers ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="pe_firm">PE Firms ({tabCounts.pe_firm})</TabsTrigger>
          <TabsTrigger value="platform">Platforms ({tabCounts.platform})</TabsTrigger>
          <TabsTrigger value="needs_agreements">Needs Agreements ({tabCounts.needs_agreements})</TabsTrigger>
          <TabsTrigger value="needs_enrichment">Needs Enrichment ({tabCounts.needs_enrichment})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline" disabled={enrichingIds.size > 0} onClick={async () => {
              const ids = Array.from(selectedIds);
              if (ids.length === 0) return;
              setEnrichingIds(new Set(ids));
              try {
                const { queueBuyerEnrichment } = await import("@/lib/remarketing/queueEnrichment");
                await queueBuyerEnrichment(ids);
                queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
              } catch (err) {
                console.error('Bulk enrich failed:', err);
                toast.error('Failed to queue enrichment');
              } finally {
                setEnrichingIds(new Set());
              }
            }}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> {enrichingIds.size > 0 ? 'Enriching…' : 'Enrich Selected'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search buyers by name, website, or thesis..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={universeFilter} onValueChange={setUniverseFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Universes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Universes</SelectItem>
                {universes?.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Buyers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={filteredBuyers.length > 0 && selectedIds.size === filteredBuyers.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[48px] text-muted-foreground text-xs font-normal">#</TableHead>
                <TableHead className="w-[260px] cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('company_name')}>
                  <span className="flex items-center">Platform / Buyer <SortIcon column="company_name" /></span>
                </TableHead>
                <TableHead className="w-[180px] cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('pe_firm_name')}>
                  <span className="flex items-center">PE Firm <SortIcon column="pe_firm_name" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('universe')}>
                  <span className="flex items-center">Universe <SortIcon column="universe" /></span>
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[70px] text-center">Mktpl.</TableHead>
                <TableHead className="w-[70px] text-center">Fee Agmt</TableHead>
                <TableHead className="w-[60px] text-center">NDA</TableHead>
                <TableHead className="w-[130px]">Intel</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buyersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredBuyers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No buyers found</p>
                    <p className="text-sm">Add buyers manually or import from CSV</p>
                  </TableCell>
                </TableRow>
              ) : (
                pagedBuyers.map((buyer: any, pageIdx: number) => {
                  const globalIdx = (currentPage - 1) * PAGE_SIZE + pageIdx + 1;
                  const location = [buyer.hq_city, buyer.hq_state].filter(Boolean).join(', ');

                  return (
                    <TableRow
                      key={buyer.id}
                      className="cursor-pointer hover:bg-muted/50 group"
                      onClick={() => navigate(`/admin/buyers/${buyer.id}`)}
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

                      <TableCell>
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {buyer.buyer_type === 'pe_firm' ? (
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
                              {buyer.data_completeness === 'high' && (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-xs px-1.5 py-0">
                                  Enriched
                                </Badge>
                              )}
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

                      {/* PE Firm Column */}
                      <TableCell>
                        {buyer.pe_firm_name ? (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                              <Building className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="text-sm">{buyer.pe_firm_name}</span>
                          </div>
                        ) : buyer.buyer_type === 'pe_firm' ? (
                          <Badge variant="outline" className="text-xs">
                            PE Firm
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
                          completeness={buyer.data_completeness as DataCompleteness | null}
                          hasTranscript={buyerIdsWithTranscripts?.has(buyer.id) || false}
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
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/buyers/${buyer.id}`);
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
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
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination Footer */}
          {!buyersLoading && filteredBuyers.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredBuyers.length)} of {filteredBuyers.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >«</Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >‹ Prev</Button>
                <span className="px-3 font-medium text-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >Next ›</Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >»</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Chat */}
      <ReMarketingChat
        context={{ type: "buyers", totalBuyers: filteredBuyers.length }}
      />
    </div>
  );
};

export default ReMarketingBuyers;

