import { useState, useMemo } from "react";
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
  X
} from "lucide-react";
import { toast } from "sonner";
import { IntelligenceCoverageBar, ReMarketingChat } from "@/components/remarketing";
import { deleteUniverseWithRelated } from "@/lib/ma-intelligence/cascadeDelete";

type SortField = 'name' | 'buyers' | 'deals' | 'coverage';
type SortOrder = 'asc' | 'desc';

const ReMarketingUniverses = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  // New universe dialog
  const showNewDialog = searchParams.get('new') === 'true';
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

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
  // Intelligence coverage is a two-tier system:
  // - Website enrichment (data_completeness = 'high') contributes up to 50%
  // - Call transcripts contribute the remaining 50%
  // 100% intel requires ALL buyers to have transcripts
  const { data: buyerStats } = useQuery({
    queryKey: ['remarketing', 'universe-buyer-stats'],
    queryFn: async () => {
      // Get all buyers with data_completeness
      const { data: buyers, error: buyersError } = await supabase
        .from('remarketing_buyers')
        .select('id, universe_id, data_completeness')
        .eq('archived', false);

      if (buyersError) throw buyersError;

      // Get buyer IDs that have transcripts
      const { data: transcripts, error: transcriptsError } = await supabase
        .from('buyer_transcripts')
        .select('buyer_id');

      if (transcriptsError) throw transcriptsError;

      const buyersWithTranscripts = new Set(transcripts?.map(t => t.buyer_id) || []);

      // Aggregate by universe with both enriched and transcript counts
      const stats: Record<string, { total: number; enriched: number; withTranscripts: number }> = {};
      buyers?.forEach(buyer => {
        if (!buyer.universe_id) return;
        if (!stats[buyer.universe_id]) {
          stats[buyer.universe_id] = { total: 0, enriched: 0, withTranscripts: 0 };
        }
        stats[buyer.universe_id].total++;
        
        // Count enriched buyers (website data provides up to 50% intel)
        if (buyer.data_completeness === 'high' || buyer.data_completeness === 'medium') {
          stats[buyer.universe_id].enriched++;
        }
        
        // Count buyers with transcripts (provides remaining 50% intel)
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
        .select('universe_id, listing_id');

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
      navigate(`/admin/remarketing/universes/${data.id}`);
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
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter and sort universes
  const sortedUniverses = useMemo(() => {
    if (!universes) return [];
    
    let filtered = universes.filter(u => {
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
        case 'coverage':
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Buyer Universes</h1>
          <p className="text-muted-foreground">
            {universes?.length || 0} universes {archivedCount ? `· ${archivedCount} archived` : ''}
          </p>
        </div>
        <Button onClick={() => setSearchParams({ new: 'true' })} className="gap-2">
          <Plus className="h-4 w-4" />
          New Universe
        </Button>
      </div>

      {/* Filters */}
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
                      onClick={() => setSearchParams({ new: 'true' })}
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
                      onClick={() => navigate(`/admin/remarketing/universes/${universe.id}`)}
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
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Globe2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{universe.name}</p>
                            {universe.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                                {universe.description}
                              </p>
                            )}
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
                              navigate(`/admin/remarketing/universes/${universe.id}`);
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
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

      {/* New Universe Dialog */}
      <Dialog open={showNewDialog} onOpenChange={(open) => !open && setSearchParams({})}>
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
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Brief description of this buyer universe"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSearchParams({})}>
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
