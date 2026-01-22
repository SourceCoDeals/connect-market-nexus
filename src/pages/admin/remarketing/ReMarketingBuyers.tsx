import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Users, 
  Building,
  Pencil,
  Trash2,
  MapPin,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { BuyerCSVImport, IntelligenceBadge } from "@/components/remarketing";
import type { BuyerType, DataCompleteness } from "@/types/remarketing";

const BUYER_TYPES: { value: BuyerType; label: string }[] = [
  { value: 'pe_firm', label: 'PE Firm' },
  { value: 'platform', label: 'Platform' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'other', label: 'Other' },
];

type BuyerTab = 'all' | 'pe_firm' | 'platform';

const ReMarketingBuyers = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<BuyerTab>('all');
  const [universeFilter, setUniverseFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // New buyer form state
  const [newBuyer, setNewBuyer] = useState({
    company_name: "",
    company_website: "",
    buyer_type: "" as BuyerType | "",
    universe_id: "",
    thesis_summary: "",
    notes: "",
  });

  // Fetch buyers with universe info
  const { data: buyers, isLoading: buyersLoading } = useQuery({
    queryKey: ['remarketing', 'buyers', activeTab, universeFilter],
    queryFn: async () => {
      let query = supabase
        .from('remarketing_buyers')
        .select(`
          *,
          universe:remarketing_buyer_universes(id, name)
        `)
        .eq('archived', false)
        .order('company_name');

      // Filter by tab (buyer type)
      if (activeTab === 'pe_firm') {
        query = query.eq('buyer_type', 'pe_firm');
      } else if (activeTab === 'platform') {
        query = query.eq('buyer_type', 'platform');
      }

      // Filter by universe
      if (universeFilter !== "all") {
        query = query.eq('universe_id', universeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
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

  // Count by type
  const { data: typeCounts } = useQuery({
    queryKey: ['remarketing', 'buyer-type-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyers')
        .select('buyer_type')
        .eq('archived', false);

      if (error) throw error;

      const counts = { pe_firm: 0, platform: 0, other: 0 };
      data?.forEach(b => {
        if (b.buyer_type === 'pe_firm') counts.pe_firm++;
        else if (b.buyer_type === 'platform') counts.platform++;
        else counts.other++;
      });
      return counts;
    }
  });

  // Create buyer mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('remarketing_buyers')
        .insert({
          company_name: newBuyer.company_name,
          company_website: newBuyer.company_website || null,
          buyer_type: newBuyer.buyer_type || null,
          universe_id: newBuyer.universe_id || null,
          thesis_summary: newBuyer.thesis_summary || null,
          notes: newBuyer.notes || null,
        });

      if (error) throw error;
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

  // Filter buyers by search
  const filteredBuyers = useMemo(() => {
    if (!buyers) return [];
    if (!search) return buyers;
    
    const searchLower = search.toLowerCase();
    return buyers.filter(b => 
      b.company_name?.toLowerCase().includes(searchLower) ||
      b.company_website?.toLowerCase().includes(searchLower) ||
      b.thesis_summary?.toLowerCase().includes(searchLower)
    );
  }, [buyers, search]);

  // Using IntelligenceBadge component instead of icons

  const getBuyerTypeLabel = (type: string | null) => {
    const found = BUYER_TYPES.find(t => t.value === type);
    return found?.label || type || '-';
  };

  const totalBuyers = (typeCounts?.pe_firm || 0) + (typeCounts?.platform || 0) + (typeCounts?.other || 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Buyers</h1>
          <p className="text-muted-foreground">
            {typeCounts?.pe_firm || 0} PE firms · {typeCounts?.platform || 0} platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BuyerCSVImport />
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

      {/* Tabs for buyer types */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BuyerTab)}>
        <TabsList>
          <TabsTrigger value="all">
            All ({totalBuyers})
          </TabsTrigger>
          <TabsTrigger value="pe_firm">
            PE Firms ({typeCounts?.pe_firm || 0})
          </TabsTrigger>
          <TabsTrigger value="platform">
            Platforms ({typeCounts?.platform || 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
                <TableHead className="w-[280px]">Platform / Buyer</TableHead>
                <TableHead className="w-[180px]">PE Firm</TableHead>
                <TableHead>Universe</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[130px]">Intel</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buyersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredBuyers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No buyers found</p>
                    <p className="text-sm">Add buyers manually or import from CSV</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBuyers.map((buyer) => {
                  const location = [buyer.hq_city, buyer.hq_state].filter(Boolean).join(', ');
                  
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
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/remarketing/buyers/${buyer.id}`);
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              toast.info('Enrichment coming soon');
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ReMarketingBuyers;
