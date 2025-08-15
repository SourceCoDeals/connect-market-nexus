
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp, Heart, ExternalLink } from "lucide-react";
import { QUERY_KEYS } from "@/lib/query-keys";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserSavedListingsProps {
  userId: string;
}

export function UserSavedListings({ userId }: UserSavedListingsProps) {
  const [showAllSaved, setShowAllSaved] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  
  const { data: savedListings, isLoading: savedLoading } = useQuery({
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

  const { data: connectionRequests, isLoading: requestsLoading } = useQuery({
    queryKey: QUERY_KEYS.admin.userConnectionRequests(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connection_requests')
        .select(`
          id,
          created_at,
          status,
          user_message,
          listing_id,
          listings!connection_requests_listing_id_fkey(
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

  const isLoading = savedLoading || requestsLoading;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  const displayedSavedListings = showAllSaved ? savedListings : savedListings?.slice(0, 3);
  const displayedConnectionRequests = showAllRequests ? connectionRequests : connectionRequests?.slice(0, 3);

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Tabs defaultValue="saved" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="saved" className="flex items-center gap-2">
          <Heart className="h-3 w-3" />
          Saved ({savedListings?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="requests" className="flex items-center gap-2">
          <ExternalLink className="h-3 w-3" />
          Inquired ({connectionRequests?.length || 0})
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="saved" className="space-y-2 mt-4">
        {!savedListings || savedListings.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No saved listings yet
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Saved Listings ({savedListings.length})
              </div>
              {savedListings.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllSaved(!showAllSaved)}
                  className="text-xs"
                >
                  {showAllSaved ? (
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
              {displayedSavedListings?.map((saved) => (
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
          </>
        )}
      </TabsContent>
      
      <TabsContent value="requests" className="space-y-2 mt-4">
        {!connectionRequests || connectionRequests.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No connection requests yet
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Connection Requests ({connectionRequests.length})
              </div>
              {connectionRequests.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllRequests(!showAllRequests)}
                  className="text-xs"
                >
                  {showAllRequests ? (
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
              {displayedConnectionRequests?.map((request) => (
                <div key={request.id} className="text-sm border rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium">{request.listings?.title}</div>
                    <Badge variant="outline" className={`text-xs ${getStatusBadge(request.status)}`}>
                      {request.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {request.listings?.category}
                    </Badge>
                    <span>{request.listings?.location}</span>
                    <span>•</span>
                    <span>Revenue: ${request.listings?.revenue?.toLocaleString()}</span>
                    <span>•</span>
                    <span>EBITDA: ${request.listings?.ebitda?.toLocaleString()}</span>
                    <span>•</span>
                    <span>Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
                  </div>
                  {request.user_message && (
                    <div className="text-xs text-muted-foreground mt-1 p-1 bg-muted/30 rounded">
                      <strong>Message:</strong> {request.user_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
