
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { User } from "lucide-react";

interface ListingSavedByUsersProps {
  listingId: string;
}

export function ListingSavedByUsers({ listingId }: ListingSavedByUsersProps) {
  const { data: savedByUsers, isLoading } = useQuery({
    queryKey: ['admin-listing-saved-by', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_listings')
        .select(`
          created_at,
          user_id,
          profiles!inner(
            first_name,
            last_name,
            email,
            company,
            buyer_type
          )
        `)
        .eq('listing_id', listingId)
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

  if (!savedByUsers || savedByUsers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <User className="h-4 w-4" />
        No users have saved this listing yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium flex items-center gap-2">
        <User className="h-4 w-4" />
        Saved by {savedByUsers.length} user{savedByUsers.length !== 1 ? 's' : ''}
      </div>
      <div className="space-y-1">
        {savedByUsers.slice(0, 5).map((saved) => (
          <div key={saved.user_id} className="text-sm border rounded p-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {saved.profiles.first_name} {saved.profiles.last_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {saved.profiles.email}
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-xs">
                  {saved.profiles.buyer_type || 'Unknown'}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(saved.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
            {saved.profiles.company && (
              <div className="text-xs text-muted-foreground mt-1">
                {saved.profiles.company}
              </div>
            )}
          </div>
        ))}
        {savedByUsers.length > 5 && (
          <div className="text-xs text-muted-foreground">
            +{savedByUsers.length - 5} more users saved this listing
          </div>
        )}
      </div>
    </div>
  );
}
