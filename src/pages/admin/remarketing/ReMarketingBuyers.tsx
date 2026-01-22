import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Link } from "react-router-dom";
import { 
  Building2, 
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Upload,
  ExternalLink
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { BuyerType } from "@/types/remarketing";
import { BuyerCSVImport } from "@/components/remarketing/BuyerCSVImport";

const BUYER_TYPES: { value: BuyerType; label: string }[] = [
  { value: 'pe_firm', label: 'PE Firm' },
  { value: 'platform', label: 'Platform' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'other', label: 'Other' },
];

const ReMarketingBuyers = () => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [universeFilter, setUniverseFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBuyer, setNewBuyer] = useState({
    company_name: '',
    company_website: '',
    buyer_type: 'pe_firm' as BuyerType,
    universe_id: '',
    notes: '',
  });
  
  const queryClient = useQueryClient();

  // Fetch all buyers
  const { data: buyers, isLoading } = useQuery({
    queryKey: ['remarketing', 'buyers', typeFilter, universeFilter],
    queryFn: async () => {
      let query = supabase
        .from('remarketing_buyers')
        .select(`
          *,
          universe:remarketing_buyer_universes(id, name)
        `)
        .eq('archived', false)
        .order('company_name');
      
      if (typeFilter !== 'all') {
        query = query.eq('buyer_type', typeFilter);
      }
      if (universeFilter !== 'all') {
        query = query.eq('universe_id', universeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch universes for filter
  const { data: universes } = useQuery({
    queryKey: ['remarketing', 'universes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('id, name')
        .eq('archived', false)
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const addBuyerMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('remarketing_buyers')
        .insert([{
          ...newBuyer,
          universe_id: newBuyer.universe_id || null,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
      toast.success('Buyer added');
      setIsAddDialogOpen(false);
      setNewBuyer({
        company_name: '',
        company_website: '',
        buyer_type: 'pe_firm',
        universe_id: '',
        notes: '',
      });
    },
    onError: () => {
      toast.error('Failed to add buyer');
    }
  });

  const deleteBuyerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('remarketing_buyers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
      toast.success('Buyer deleted');
    },
    onError: () => {
      toast.error('Failed to delete buyer');
    }
  });

  const filteredBuyers = buyers?.filter(buyer =>
    buyer.company_name.toLowerCase().includes(search.toLowerCase()) ||
    buyer.company_website?.toLowerCase().includes(search.toLowerCase())
  );

  const getDataCompletenessColor = (level: string | null) => {
    switch (level) {
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">External Buyers</h1>
          <p className="text-muted-foreground">
            Manage PE firms, platforms, and strategic buyers
          </p>
        </div>
        <div className="flex gap-2">
          <BuyerCSVImport 
            universeId={universeFilter !== 'all' ? universeFilter : undefined}
            onComplete={() => queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] })}
          />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Buyer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Buyer</DialogTitle>
                <DialogDescription>
                  Add a new external buyer to your database
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    placeholder="e.g., Blackstone"
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
                <div className="space-y-2">
                  <Label>Buyer Type</Label>
                  <Select
                    value={newBuyer.buyer_type}
                    onValueChange={(value) => setNewBuyer({ ...newBuyer, buyer_type: value as BuyerType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUYER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Universe</Label>
                  <Select
                    value={newBuyer.universe_id}
                    onValueChange={(value) => setNewBuyer({ ...newBuyer, universe_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select universe (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {universes?.map((universe) => (
                        <SelectItem key={universe.id} value={universe.id}>
                          {universe.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional notes..."
                    value={newBuyer.notes}
                    onChange={(e) => setNewBuyer({ ...newBuyer, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => addBuyerMutation.mutate()}
                  disabled={!newBuyer.company_name || addBuyerMutation.isPending}
                >
                  {addBuyerMutation.isPending ? 'Adding...' : 'Add Buyer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search buyers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {BUYER_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={universeFilter} onValueChange={setUniverseFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Universe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Universes</SelectItem>
            {universes?.map((universe) => (
              <SelectItem key={universe.id} value={universe.id}>
                {universe.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Buyers Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredBuyers?.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-1">No buyers found</h3>
              <p className="text-muted-foreground mb-4">
                {search ? 'Try a different search term' : 'Add your first buyer to get started'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Universe</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBuyers?.map((buyer: any) => (
                  <TableRow key={buyer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{buyer.company_name}</p>
                        {buyer.company_website && (
                          <a 
                            href={buyer.company_website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
                          >
                            {new URL(buyer.company_website).hostname}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {buyer.buyer_type?.replace('_', ' ') || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {buyer.universe?.name || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getDataCompletenessColor(buyer.data_completeness)}>
                        {buyer.data_completeness || 'low'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/remarketing/buyers/${buyer.id}`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm('Delete this buyer?')) {
                                deleteBuyerMutation.mutate(buyer.id);
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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
    </div>
  );
};

export default ReMarketingBuyers;
