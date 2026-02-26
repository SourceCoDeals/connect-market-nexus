import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Globe2, 
  Users, 
  Building2,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  ArrowUpDown,
  X,
  Handshake,
  Network,
  GripVertical,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IntelligenceCoverageBar, ReMarketingChat } from "@/components/remarketing";
import { deleteUniverseWithRelated } from "@/lib/ma-intelligence/cascadeDelete";

type SortField = 'name' | 'buyers' | 'deals' | 'coverage';
type SortOrder = 'asc' | 'desc';

/** Extract a short industry description from the guide's markdown content */
function extractGuideDescription(guideContent: string | null | undefined): string | null {
  if (!guideContent) return null;
  
  // Patterns that indicate boilerplate/meta text rather than actual industry descriptions
  const boilerplatePatterns = [
    /^\*?\*?analyst\s*note/i,
    /^here\s+is\s+(the|a)\s+(comprehensive|definitive|foundational|complete)/i,
    /^this\s+document\s+provides/i,
    /^this\s+(guide|report|analysis)\s+(is|provides|covers|presents)/i,
    /^\[uploaded\s+guide/i,
    /^(note|disclaimer|warning)\s*:/i,
  ];
  
  const lines = guideContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim()
      .replace(/^\*\*+/, '').replace(/\*\*+$/, '') // strip bold markers
      .trim();
    // Skip headers, empty lines, table rows, short lines, and markdown artifacts
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('-') || trimmed.length < 40) continue;
    // Skip boilerplate/meta lines
    if (boilerplatePatterns.some(p => p.test(trimmed))) continue;
    // Found a real paragraph - truncate to ~200 chars
    return trimmed.length > 200 ? trimmed.slice(0, 197) + '...' : trimmed;
  }
  return null;
}

/** Sortable row for the "To Be Created" drag-and-drop list */
function SortableFlaggedRow({
  deal,
  index,
  onCreateClick,
  onNavigate,
}: {
  deal: { id: string; title: string | null; internal_company_name: string | null; industry: string | null; address_state: string | null; universe_build_flagged_at: string | null };
  index: number;
  onCreateClick: (e: React.MouseEvent) => void;
  onNavigate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="cursor-pointer hover:bg-muted/50"
      onClick={onNavigate}
    >
      <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
        <button
          className="flex items-center justify-center h-8 w-8 cursor-grab active:cursor-grabbing rounded hover:bg-muted"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="w-[40px] text-center text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Network className="h-4 w-4 text-blue-600" />
          </div>
          <p className="font-medium text-foreground truncate">{deal.internal_company_name || deal.title}</p>
        </div>
      </TableCell>
      <TableCell>
        {deal.industry ? (
          <Badge variant="secondary" className="text-xs">{deal.industry}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-sm">{deal.address_state || '—'}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {deal.universe_build_flagged_at
            ? new Date(deal.universe_build_flagged_at).toLocaleDateString()
            : '—'}
        </span>
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={(e) => { e.stopPropagation(); onCreateClick(e); }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create
        </Button>
      </TableCell>
    </TableRow>
  );
}

const ReMarketingUniverses = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<'existing' | 'to_be_created'>('existing');
  const search = searchParams.get("q") ?? "";
  const [showArchived, setShowArchived] = useState(false);
  const sortField = (searchParams.get("sort") as SortField) ?? "name";
  const sortOrder = (searchParams.get("dir") as SortOrder) ?? "asc";
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  // New universe dialog
  const showNewDialog = searchParams.get('new') === 'true';
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  const handleGenerateDescription = useCallback(async () => {
    if (!newName.trim()) {
      toast.error('Enter a universe name first');
      return;
    }
    setIsGeneratingDescription(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/clarify-industry`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            industry_name: newName.trim(),
            generate_description: true,
          }),
        },
      );
      if (response.ok) {
        const result = await response.json();
        if (result.description) {
          setNewDescription(result.description);
          toast.success('Description generated');
        } else {
          // Fallback: generate a simple description from the name
          setNewDescription(
            `Buyer universe targeting companies in the ${newName.trim()} industry. Includes PE firms, strategic acquirers, and family offices actively seeking acquisitions in this space.`,
          );
          toast.success('Description generated');
        }
      } else {
        // Fallback description
        setNewDescription(
          `Buyer universe targeting companies in the ${newName.trim()} industry. Includes PE firms, strategic acquirers, and family offices actively seeking acquisitions in this space.`,
        );
        toast.success('Description generated');
      }
    } catch {
      // Fallback description on error
      setNewDescription(
        `Buyer universe targeting companies in the ${newName.trim()} industry. Includes PE firms, strategic acquirers, and family offices actively seeking acquisitions in this space.`,
      );
      toast.success('Description generated');
    } finally {
      setIsGeneratingDescription(false);
    }
  }, [newName]);

  // Fetch universes with buyer counts
  const { data: universes, isLoading } = useQuery({
    queryKey: ['remarketing', 'universes-with-stats', showArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('*')
        .eq('archived', showArchived)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Fetch buyer counts per universe
  // Intelligence coverage is based on transcripts
  const { data: buyerStats } = useQuery({
    queryKey: ['remarketing', 'universe-buyer-stats'],
    queryFn: async () => {
      // Get all buyers (capped to prevent unbounded fetch)
      const { data: buyers, error: buyersError } = await supabase
        .from('remarketing_buyers')
        .select('id, universe_id')
        .eq('archived', false)
        .limit(10000);

      if (buyersError) throw buyersError;

      // Get buyer IDs that have transcripts
      const { data: transcripts, error: transcriptsError } = await supabase
        .from('buyer_transcripts')
        .select('buyer_id')
        .limit(10000);

      if (transcriptsError) throw transcriptsError;

      const buyersWithTranscripts = new Set(transcripts?.map(t => t.buyer_id) || []);

      // Aggregate by universe with transcript counts
      const stats: Record<string, { total: number; enriched: number; withTranscripts: number }> = {};
      buyers?.forEach(buyer => {
        if (!buyer.universe_id) return;
        if (!stats[buyer.universe_id]) {
          stats[buyer.universe_id] = { total: 0, enriched: 0, withTranscripts: 0 };
        }
        stats[buyer.universe_id].total++;

        // Count buyers with transcripts
        if (buyersWithTranscripts.has(buyer.id)) {
          stats[buyer.universe_id].withTranscripts++;
        }
      });
      return stats;
    }
  });

  // Fetch deal counts per universe (from scores)
  const { data: dealStats } = useQuery({
    queryKey: ['remarketing', 'universe-deal-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('universe_id, listing_id')
        .limit(50000);

      if (error) throw error;

      // Count unique deals per universe
      const stats: Record<string, Set<string>> = {};
      data?.forEach(score => {
        if (!score.universe_id) return;
        if (!stats[score.universe_id]) {
          stats[score.universe_id] = new Set();
        }
        stats[score.universe_id].add(score.listing_id);
      });

      // Convert to counts
      const counts: Record<string, number> = {};
      Object.keys(stats).forEach(key => {
        counts[key] = stats[key].size;
      });
      return counts;
    }
  });

  // Count archived universes
  const { data: archivedCount } = useQuery({
    queryKey: ['remarketing', 'archived-universe-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('id', { count: 'exact', head: true })
        .eq('archived', true);

      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch deals flagged for universe build ("To Be Created")
  const { data: flaggedDeals } = useQuery({
    queryKey: ['remarketing', 'universe-build-flagged-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, internal_company_name, industry, address_state, universe_build_flagged_at, created_at')
        .eq('universe_build_flagged', true)
        .order('universe_build_flagged_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Local ordering state for drag-and-drop
  const [localFlaggedOrder, setLocalFlaggedOrder] = useState<typeof flaggedDeals>([]);
  const orderedFlagged = useMemo(() => {
    if (localFlaggedOrder && localFlaggedOrder.length > 0) return localFlaggedOrder;
    return flaggedDeals || [];
  }, [flaggedDeals, localFlaggedOrder]);

  // Keep local order in sync when data changes (but not during drag)
  useEffect(() => {
    if (flaggedDeals) setLocalFlaggedOrder(flaggedDeals);
  }, [flaggedDeals]);

  const flaggedSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleFlaggedDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const current = [...orderedFlagged];
      const oldIdx = current.findIndex((d) => d.id === active.id);
      const newIdx = current.findIndex((d) => d.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(current, oldIdx, newIdx);
      setLocalFlaggedOrder(reordered);

      // Persist new priority order
      try {
        await Promise.all(
          reordered.map((deal, idx) =>
            supabase
              .from('listings')
              .update({ universe_build_priority: idx + 1 } as never)
              .eq('id', deal.id),
          ),
        );
        queryClient.invalidateQueries({ queryKey: ['remarketing', 'universe-build-flagged-deals'] });
      } catch {
        toast.error('Failed to save new order');
      }
    },
    [orderedFlagged, queryClient],
  );
  // Create universe mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .insert({
          name: newName,
          description: newDescription || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      toast.success(`"${newName}" has been created.`);
      setNewName("");
      setNewDescription("");
      setSearchParams({});
      navigate(`/admin/buyers/universes/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Archive/restore mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('remarketing_buyer_universes')
        .update({ archived })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { archived }) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      toast.success(archived ? "Universe archived" : "Universe restored");
    }
  });

  // Delete mutation (single)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteUniverseWithRelated(id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      toast.success("Universe deleted");
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map(id => deleteUniverseWithRelated(id)));
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to delete ${errors.length} universe(s)`);
      }
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} universe(s) deleted`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Sort handler
  const handleSort = (field: SortField) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("sort") === field) {
        next.set("dir", next.get("dir") === "asc" ? "desc" : "asc");
      } else {
        next.set("sort", field);
        next.set("dir", "asc");
      }
      return next;
    }, { replace: true });
  };

  const setSearch = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("q", value);
      else next.delete("q");
      return next;
    }, { replace: true });
  };

  // Filter and sort universes
  const sortedUniverses = useMemo(() => {
    if (!universes) return [];
    
    const filtered = universes.filter(u => {
      if (!search) return true;
      return u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.description?.toLowerCase().includes(search.toLowerCase());
    });

    return filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'buyers':
          aVal = buyerStats?.[a.id]?.total || 0;
          bVal = buyerStats?.[b.id]?.total || 0;
          break;
        case 'deals':
          aVal = dealStats?.[a.id] || 0;
          bVal = dealStats?.[b.id] || 0;
          break;
        case 'coverage': {
          const aStats = buyerStats?.[a.id];
          const bStats = buyerStats?.[b.id];
          // Calculate coverage using two-tier system: website (50%) + transcripts (50%)
          const aWebsite = aStats && aStats.total > 0 ? (aStats.enriched / aStats.total) * 50 : 0;
          const aTranscript = aStats && aStats.total > 0 ? (aStats.withTranscripts / aStats.total) * 50 : 0;
          const bWebsite = bStats && bStats.total > 0 ? (bStats.enriched / bStats.total) * 50 : 0;
          const bTranscript = bStats && bStats.total > 0 ? (bStats.withTranscripts / bStats.total) * 50 : 0;
          aVal = aWebsite + aTranscript;
          bVal = bWebsite + bTranscript;
          break;
        }
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [universes, search, sortField, sortOrder, buyerStats, dealStats]);

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </div>
    </TableHead>
  );

  // Selection helpers
  const allSelected = sortedUniverses.length > 0 && sortedUniverses.every(u => selectedIds.has(u.id));
  const someSelected = sortedUniverses.some(u => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedUniverses.map(u => u.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  return (
    <div className="p-6 space-y-6 h-fit">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Buyer Universes</h1>
          <p className="text-muted-foreground">
            {universes?.length || 0} existing · {flaggedDeals?.length || 0} to be created {archivedCount ? `· ${archivedCount} archived` : ''}
          </p>
        </div>
        <Button onClick={() => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('new', 'true'); return n; })} className="gap-2">
          <Plus className="h-4 w-4" />
          New Universe
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'existing' | 'to_be_created')}>
        <TabsList>
          <TabsTrigger value="existing">
            <Globe2 className="h-4 w-4 mr-1.5" />
            Existing ({universes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="to_be_created">
            <Network className="h-4 w-4 mr-1.5" />
            To Be Created ({flaggedDeals?.length || 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'existing' ? (
        <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search universes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
                Show archived ({archivedCount})
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedIds.size} universe{selectedIds.size > 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-7 px-2 text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Universes Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                    className={someSelected && !allSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                  />
                </TableHead>
                <SortableHeader field="name">Industry / Universe</SortableHeader>
                <SortableHeader field="buyers">Buyers</SortableHeader>
                <SortableHeader field="deals">Deals</SortableHeader>
                <SortableHeader field="coverage">Intelligence Coverage</SortableHeader>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : sortedUniverses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Globe2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No universes found</p>
                    <p className="text-sm">Create your first buyer universe to get started</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('new', 'true'); return n; })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Universe
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                sortedUniverses.map((universe) => {
                  const stats = buyerStats?.[universe.id] || { total: 0, enriched: 0, withTranscripts: 0 };
                  const deals = dealStats?.[universe.id] || 0;
                  // Two-tier intel: website (up to 50%) + transcripts (up to 50%)
                  const websiteIntel = stats.total > 0 ? Math.round((stats.enriched / stats.total) * 50) : 0;
                  const transcriptIntel = stats.total > 0 ? Math.round((stats.withTranscripts / stats.total) * 50) : 0;
                  const coverage = websiteIntel + transcriptIntel;
                  const isSelected = selectedIds.has(universe.id);

                  return (
                    <TableRow 
                      key={universe.id}
                      className={`cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => navigate(`/admin/buyers/universes/${universe.id}`)}
                    >
                      <TableCell onClick={(e) => toggleSelect(universe.id, e)}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {}}
                          aria-label={`Select ${universe.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Globe2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 max-w-[400px]">
                            <p className="font-medium text-foreground">{universe.name}</p>
                            {(() => {
                              const desc = universe.description || extractGuideDescription(universe.ma_guide_content);
                              return desc ? (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {desc}
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground/50 italic">
                                  No description
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span className="font-medium text-foreground">{stats.total}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span className="font-medium text-foreground">{deals}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-40">
                          <IntelligenceCoverageBar 
                            current={stats.withTranscripts} 
                            total={stats.total}
                            enrichedCount={stats.enriched}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={coverage >= 50 ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {coverage}% intel
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/buyers/universes/${universe.id}`);
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async (e) => {
                              e.stopPropagation();
                              const newVal = !universe.fee_agreement_required;
                              await supabase.from("remarketing_buyer_universes").update({ fee_agreement_required: newVal } as never).eq("id", universe.id);
                              queryClient.invalidateQueries({ queryKey: ['remarketing'] });
                              toast.success(newVal ? "Fee agreement required" : "Fee agreement not required");
                            }}>
                              <Handshake className={`h-4 w-4 mr-2 ${universe.fee_agreement_required ? "text-green-600" : ""}`} />
                              {universe.fee_agreement_required ? "✓ Fee Agreement Required" : "Flag: Fee Agreement Required"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              archiveMutation.mutate({ id: universe.id, archived: !universe.archived });
                            }}>
                              {universe.archived ? (
                                <>
                                  <ArchiveRestore className="h-4 w-4 mr-2" />
                                  Restore
                                </>
                              ) : (
                                <>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archive
                                </>
                              )}
                            </DropdownMenuItem>
                            {universe.archived && (
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Are you sure you want to permanently delete this universe?')) {
                                    deleteMutation.mutate(universe.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
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
        </CardContent>
      </Card>
        </>
      ) : (
        /* To Be Created Tab – drag-and-drop ranking */
        <Card>
          <CardContent className="p-0">
            <DndContext sensors={flaggedSensors} collisionDetection={closestCenter} onDragEnd={handleFlaggedDragEnd}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]" />
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Deal Name</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Flagged At</TableHead>
                    <TableHead className="w-[120px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedFlagged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No deals flagged for universe build</p>
                        <p className="text-sm">Flag deals in Active Deals to queue them for universe creation</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <SortableContext items={orderedFlagged.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                      {orderedFlagged.map((deal, idx) => (
                        <SortableFlaggedRow
                          key={deal.id}
                          deal={deal}
                          index={idx}
                          onNavigate={() => navigate(`/admin/deals/${deal.id}`)}
                          onCreateClick={() => {
                            setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('new', 'true'); return n; });
                          }}
                        />
                      ))}
                    </SortableContext>
                  )}
                </TableBody>
              </Table>
            </DndContext>
          </CardContent>
        </Card>
      )}

      {/* New Universe Dialog */}
      <Dialog open={showNewDialog} onOpenChange={(open) => !open && setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('new'); return n; })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Buyer Universe</DialogTitle>
            <DialogDescription>
              A buyer universe is a collection of buyers that share similar characteristics and investment criteria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Universe Name</Label>
              <Input
                id="name"
                placeholder="e.g., HVAC & Plumbing PE"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description (optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-primary"
                  onClick={handleGenerateDescription}
                  disabled={!newName.trim() || isGeneratingDescription}
                >
                  {isGeneratingDescription ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {isGeneratingDescription ? 'Generating...' : 'AI Generate'}
                </Button>
              </div>
              <Input
                id="description"
                placeholder="Brief description of this buyer universe"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('new'); return n; })}>
              Cancel
            </Button>
            <Button 
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Universe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Universe{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected universe{selectedIds.size > 1 ? 's' : ''} and all associated buyers, scores, and data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => {
                bulkDeleteMutation.mutate(Array.from(selectedIds));
                setShowBulkDeleteDialog(false);
              }}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Chat */}
      <ReMarketingChat
        context={{ type: "deals", totalDeals: universes?.length }}
      />
    </div>
  );
};

export default ReMarketingUniverses;
