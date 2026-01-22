import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { 
  Target, 
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Archive,
  Trash2,
  ArrowRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const ReMarketingUniverses = () => {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const queryClient = useQueryClient();

  const { data: universes, isLoading } = useQuery({
    queryKey: ['remarketing', 'universes', showArchived],
    queryFn: async () => {
      let query = supabase
        .from('remarketing_buyer_universes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!showArchived) {
        query = query.eq('archived', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // Get buyer counts per universe
  const { data: buyerCounts } = useQuery({
    queryKey: ['remarketing', 'buyers', 'counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyers')
        .select('universe_id')
        .eq('archived', false);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(buyer => {
        if (buyer.universe_id) {
          counts[buyer.universe_id] = (counts[buyer.universe_id] || 0) + 1;
        }
      });
      return counts;
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('remarketing_buyer_universes')
        .update({ archived })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'universes'] });
      toast.success('Universe updated');
    },
    onError: () => {
      toast.error('Failed to update universe');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('remarketing_buyer_universes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'universes'] });
      toast.success('Universe deleted');
    },
    onError: () => {
      toast.error('Failed to delete universe');
    }
  });

  const filteredUniverses = universes?.filter(universe =>
    universe.name.toLowerCase().includes(search.toLowerCase()) ||
    universe.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buyer Universes</h1>
          <p className="text-muted-foreground">
            Manage your buyer groups organized by industry or criteria
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/remarketing/universes/new">
            <Plus className="mr-2 h-4 w-4" />
            New Universe
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search universes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive className="mr-2 h-4 w-4" />
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </Button>
      </div>

      {/* Universe Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredUniverses?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No universes found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {search ? 'Try a different search term' : 'Create your first buyer universe to get started'}
            </p>
            {!search && (
              <Button asChild>
                <Link to="/admin/remarketing/universes/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Universe
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUniverses?.map((universe) => (
            <Card 
              key={universe.id} 
              className={`group hover:shadow-md transition-shadow ${universe.archived ? 'opacity-60' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{universe.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/admin/remarketing/universes/${universe.id}`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => archiveMutation.mutate({ 
                          id: universe.id, 
                          archived: !universe.archived 
                        })}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {universe.archived ? 'Unarchive' : 'Archive'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('Delete this universe? This cannot be undone.')) {
                            deleteMutation.mutate(universe.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="line-clamp-2">
                  {universe.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{buyerCounts?.[universe.id] || 0} buyers</span>
                    {universe.archived && (
                      <Badge variant="secondary">Archived</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/admin/remarketing/universes/${universe.id}`}>
                      View <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReMarketingUniverses;
