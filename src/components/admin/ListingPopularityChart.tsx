
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Heart } from "lucide-react";

interface ListingWithSaveCount {
  id: string;
  title: string;
  category: string;
  location: string;
  save_count: number;
  recent_saves: number; // saves in last 7 days
}

export function ListingPopularityChart() {
  const { data: popularListings, isLoading } = useQuery({
    queryKey: ['admin-listing-popularity'],
    queryFn: async () => {
      // Get all listings with their save counts
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('id, title, category, location, status')
        .eq('status', 'active');
      
      if (listingsError) throw listingsError;
      
      // Get save counts for each listing
      const listingsWithCounts = await Promise.all(
        listings.map(async (listing) => {
          // Total saves
          const { count: totalSaves } = await supabase
            .from('saved_listings')
            .select('*', { count: 'exact', head: true })
            .eq('listing_id', listing.id);
          
          // Recent saves (last 7 days)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const { count: recentSaves } = await supabase
            .from('saved_listings')
            .select('*', { count: 'exact', head: true })
            .eq('listing_id', listing.id)
            .gte('created_at', sevenDaysAgo.toISOString());
          
          return {
            ...listing,
            save_count: totalSaves || 0,
            recent_saves: recentSaves || 0,
          };
        })
      );
      
      // Sort by save count and return top listings
      return listingsWithCounts
        .filter(listing => listing.save_count > 0)
        .sort((a, b) => b.save_count - a.save_count)
        .slice(0, 10); // Top 10 most saved listings
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Most Popular Listings
          </CardTitle>
          <CardDescription>Listings ranked by number of saves</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!popularListings || popularListings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Most Popular Listings
          </CardTitle>
          <CardDescription>Listings ranked by number of saves</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No saved listings data available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for chart
  const chartData = popularListings.map((listing) => ({
    name: listing.title.length > 20 ? listing.title.substring(0, 20) + '...' : listing.title,
    saves: listing.save_count,
    recent: listing.recent_saves,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Most Popular Listings
        </CardTitle>
        <CardDescription>Listings ranked by number of saves (with recent activity)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="saves" fill="hsl(var(--primary))" name="Total Saves" />
                <Bar dataKey="recent" fill="hsl(var(--secondary))" name="Recent Saves (7d)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Detailed list */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Top Saved Listings Details</h4>
            {popularListings.map((listing, index) => (
              <div key={listing.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                  <div>
                    <div className="text-sm font-medium">{listing.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {listing.category}
                      </Badge>
                      <span>{listing.location}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {listing.save_count} saves
                  </div>
                  {listing.recent_saves > 0 && (
                    <div className="text-xs text-green-600">
                      +{listing.recent_saves} this week
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
