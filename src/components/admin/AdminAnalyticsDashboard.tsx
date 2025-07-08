
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingPopularityChart } from "./ListingPopularityChart";
import { formatDistanceToNow } from "date-fns";
import { Users, Heart, TrendingUp, Activity } from "lucide-react";

interface SaveActivity {
  id: string;
  created_at: string;
  user_name: string;
  listing_title: string;
  listing_category: string;
}

export function AdminAnalyticsDashboard() {
  const { data: recentActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ['admin-recent-save-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_listings')
        .select(`
          id,
          created_at,
          profiles!saved_listings_user_id_fkey(
            first_name,
            last_name
          ),
          listings!saved_listings_listing_id_fkey(
            title,
            category
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      return data?.map(item => ({
        id: item.id,
        created_at: item.created_at,
        user_name: `${item.profiles?.first_name} ${item.profiles?.last_name}`,
        listing_title: item.listings?.title || 'Unknown Listing',
        listing_category: item.listings?.category || 'Unknown',
      })) || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const { data: saveStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin-save-stats'],
    queryFn: async () => {
      // Total saves
      const { count: totalSaves } = await supabase
        .from('saved_listings')
        .select('*', { count: 'exact', head: true });
      
      // Unique users who have saved listings
      const { data: uniqueUsers } = await supabase
        .from('saved_listings')
        .select('user_id')
        .neq('user_id', null);
      
      const uniqueUserCount = new Set(uniqueUsers?.map(u => u.user_id)).size;
      
      // Saves in last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { count: recentSaves } = await supabase
        .from('saved_listings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());
      
      // Saves in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count: weeklySaves } = await supabase
        .from('saved_listings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());
      
      return {
        totalSaves: totalSaves || 0,
        uniqueUsers: uniqueUserCount,
        recentSaves: recentSaves || 0,
        weeklySaves: weeklySaves || 0,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <Heart className="h-4 w-4 mr-1" /> Total Saves
            </CardDescription>
            <CardTitle>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                saveStats?.totalSaves || 0
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              All-time listing saves
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <Users className="h-4 w-4 mr-1" /> Active Savers
            </CardDescription>
            <CardTitle>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                saveStats?.uniqueUsers || 0
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Users who saved listings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" /> This Week
            </CardDescription>
            <CardTitle>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                saveStats?.weeklySaves || 0
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Saves in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <Activity className="h-4 w-4 mr-1" /> Last 24h
            </CardDescription>
            <CardTitle>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                saveStats?.recentSaves || 0
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Recent save activity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Listing Popularity Chart */}
        <div className="xl:col-span-1">
          <ListingPopularityChart />
        </div>

        {/* Recent Save Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Save Activity
            </CardTitle>
            <CardDescription>Latest user interactions with listings</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-3">
                {Array(5).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !recentActivity || recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No recent save activity
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="text-sm font-medium">
                        {activity.user_name} saved a listing
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{activity.listing_title}</span>
                        <Badge variant="outline" className="text-xs">
                          {activity.listing_category}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
