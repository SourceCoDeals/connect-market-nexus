import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  MoreHorizontal, 
  Building2, 
  ThumbsUp, 
  ThumbsDown, 
  Users,
  ExternalLink,
  Target
} from "lucide-react";
import { format } from "date-fns";
import { ScoreTierBadge, getTierFromScore } from "@/components/remarketing";

const ReMarketingDeals = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [universeFilter, setUniverseFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch all listings (deals) with their score stats
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['remarketing', 'deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          description,
          location,
          revenue,
          ebitda,
          status,
          created_at,
          category
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Fetch universes for the filter
  const { data: universes } = useQuery({
    queryKey: ['remarketing', 'universes-list'],
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

  // Fetch score stats for all listings
  const { data: scoreStats } = useQuery({
    queryKey: ['remarketing', 'deal-score-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('listing_id, composite_score, status, universe_id');

      if (error) throw error;

      // Aggregate stats per listing
      const stats: Record<string, {
        totalMatches: number;
        approved: number;
        passed: number;
        avgScore: number;
        universeIds: Set<string>;
      }> = {};

      data?.forEach(score => {
        if (!stats[score.listing_id]) {
          stats[score.listing_id] = {
            totalMatches: 0,
            approved: 0,
            passed: 0,
            avgScore: 0,
            universeIds: new Set()
          };
        }
        stats[score.listing_id].totalMatches++;
        if (score.status === 'approved') stats[score.listing_id].approved++;
        if (score.status === 'passed') stats[score.listing_id].passed++;
        stats[score.listing_id].avgScore += score.composite_score || 0;
        if (score.universe_id) stats[score.listing_id].universeIds.add(score.universe_id);
      });

      // Calculate averages
      Object.keys(stats).forEach(key => {
        if (stats[key].totalMatches > 0) {
          stats[key].avgScore = stats[key].avgScore / stats[key].totalMatches;
        }
      });

      return stats;
    }
  });

  // Get universe count
  const universeCount = universes?.length || 0;

  // Filter listings
  const filteredListings = useMemo(() => {
    if (!listings) return [];
    
    return listings.filter(listing => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          listing.title?.toLowerCase().includes(searchLower) ||
          listing.description?.toLowerCase().includes(searchLower) ||
          listing.location?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Universe filter
      if (universeFilter !== "all") {
        const stats = scoreStats?.[listing.id];
        if (!stats || !stats.universeIds.has(universeFilter)) return false;
      }

      // Score filter
      if (scoreFilter !== "all") {
        const stats = scoreStats?.[listing.id];
        const tier = stats ? getTierFromScore(stats.avgScore) : 'D';
        if (scoreFilter !== tier) return false;
      }

      // Status filter
      if (statusFilter !== "all" && listing.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [listings, search, universeFilter, scoreFilter, statusFilter, scoreStats]);

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Deals</h1>
        <p className="text-muted-foreground">
          {listings?.length || 0} deals across {universeCount} buyer universes
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deals by name, domain, or geography..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={universeFilter} onValueChange={setUniverseFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Universes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Universes</SelectItem>
                {universes?.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Any Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Score</SelectItem>
                <SelectItem value="A">Tier A (85+)</SelectItem>
                <SelectItem value="B">Tier B (70-84)</SelectItem>
                <SelectItem value="C">Tier C (55-69)</SelectItem>
                <SelectItem value="D">Tier D (&lt;55)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Any Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Deals Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">EBITDA</TableHead>
                <TableHead className="text-center">Tier</TableHead>
                <TableHead className="text-center">Engagement</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listingsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-10 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredListings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No deals found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredListings.map((listing) => {
                  const stats = scoreStats?.[listing.id];
                  const tier = stats ? getTierFromScore(stats.avgScore) : null;
                  
                  return (
                    <TableRow 
                      key={listing.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/remarketing/matching/${listing.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{listing.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {listing.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {listing.category ? (
                          <Badge variant="secondary" className="text-xs">
                            {listing.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {listing.location ? (
                          <Badge variant="outline" className="text-xs">
                            {listing.location}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(listing.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(listing.ebitda)}
                      </TableCell>
                      <TableCell className="text-center">
                        {tier ? (
                          <ScoreTierBadge tier={tier} showLabel={false} size="sm" />
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-3 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span>{stats?.totalMatches || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 text-green-600">
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span>{stats?.approved || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 text-red-500">
                            <ThumbsDown className="h-3.5 w-3.5" />
                            <span>{stats?.passed || 0}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(listing.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={listing.status === 'active' ? 'default' : 'secondary'}
                          className="capitalize"
                        >
                          {listing.status}
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
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/remarketing/matching/${listing.id}`);
                              }}
                            >
                              <Target className="h-4 w-4 mr-2" />
                              Match Buyers
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/listing/${listing.id}`);
                              }}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Listing
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

export default ReMarketingDeals;
