
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface UserSavedListingsProps {
  userId: string;
}

export function UserSavedListings({ userId }: UserSavedListingsProps) {
  const { data: savedListings, isLoading } = useQuery({
    queryKey: ['admin-user-saved-listings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_listings')
        .select(`
          created_at,
          listing_id,
          listings!saved_listings_listing_id_fkey(
            title,
            category,
            location,
            revenue,
            ebitda
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!savedListings || savedListings.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No saved listings yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        Saved Listings ({savedListings.length})
      </div>
      <div className="space-y-1">
        {savedListings.slice(0, 3).map((saved) => (
          <div key={saved.listing_id} className="text-sm border rounded p-2">
            <div className="font-medium">{saved.listings?.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {saved.listings?.category}
              </Badge>
              <span>{saved.listings?.location}</span>
              <span>•</span>
              <span>Saved {formatDistanceToNow(new Date(saved.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        ))}
        {savedListings.length > 3 && (
          <div className="text-xs text-muted-foreground">
            +{savedListings.length - 3} more saved listings
          </div>
        )}
      </div>
    </div>
  );
}
