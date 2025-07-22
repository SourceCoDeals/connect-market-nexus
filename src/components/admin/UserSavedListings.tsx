
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { QUERY_KEYS } from "@/lib/query-keys";

interface UserSavedListingsProps {
  userId: string;
}

export function UserSavedListings({ userId }: UserSavedListingsProps) {
  const [showAll, setShowAll] = useState(false);
  
  const { data: savedListings, isLoading } = useQuery({
    queryKey: QUERY_KEYS.admin.userSavedListings(userId),
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

  const displayedListings = showAll ? savedListings : savedListings.slice(0, 3);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Saved Listings ({savedListings.length})
        </div>
        {savedListings.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-xs"
          >
            {showAll ? (
              <>
                Show Less <ChevronUp className="ml-1 h-3 w-3" />
              </>
            ) : (
              <>
                Show All <ChevronDown className="ml-1 h-3 w-3" />
              </>
            )}
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {displayedListings.map((saved) => (
          <div key={saved.listing_id} className="text-sm border rounded p-2">
            <div className="font-medium">{saved.listings?.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {saved.listings?.category}
              </Badge>
              <span>{saved.listings?.location}</span>
              <span>•</span>
              <span>Revenue: ${saved.listings?.revenue?.toLocaleString()}</span>
              <span>•</span>
              <span>EBITDA: ${saved.listings?.ebitda?.toLocaleString()}</span>
              <span>•</span>
              <span>Saved {formatDistanceToNow(new Date(saved.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
