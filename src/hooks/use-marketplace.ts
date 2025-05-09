import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Listing, FilterOptions } from "@/types";
import { toast } from "@/hooks/use-toast";

export function useMarketplace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Get all active listings with filter options
  const useListings = (filters: FilterOptions = {}) => {
    const isAdmin = user?.is_admin === true;
    
    return useQuery({
      queryKey: ["marketplace-listings", filters, isAdmin],
      queryFn: async () => {
        let query = supabase
          .from("listings")
          .select("*")
          .order("created_at", { ascending: false });
        
        // Apply status filter for non-admin users (only show active listings)
        if (!isAdmin) {
          query = query.eq("status", "active");
        }
        
        // Apply additional filters if provided
        if (filters.category) {
          query = query.eq("category", filters.category);
        }
        
        if (filters.location) {
          query = query.eq("location", filters.location);
        }
        
        if (filters.revenueMin) {
          query = query.gte("revenue", filters.revenueMin);
        }
        
        if (filters.revenueMax) {
          query = query.lte("revenue", filters.revenueMax);
        }
        
        if (filters.ebitdaMin) {
          query = query.gte("ebitda", filters.ebitdaMin);
        }
        
        if (filters.ebitdaMax) {
          query = query.lte("ebitda", filters.ebitdaMax);
        }
        
        if (filters.search) {
          query = query.ilike("title", `%${filters.search}%`);
        }
        
        if (filters.status) {
          query = query.eq("status", filters.status);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error("Error fetching listings:", error);
          throw error;
        }
        
        return data as Listing[];
      },
      enabled: !!user
    });
  };
  
  // Get listing metadata (categories, locations, etc.)
  const useListingMetadata = () => {
    return useQuery({
      queryKey: ["listing-metadata"],
      queryFn: async () => {
        const { data, error } = await supabase.from("listings").select("category, location");
        
        if (error) {
          console.error("Error fetching listing metadata:", error);
          throw error;
        }
        
        // Extract unique categories and locations
        const categories = [...new Set(data.map(item => item.category))].filter(Boolean).sort();
        const locations = [...new Set(data.map(item => item.location))].filter(Boolean).sort();
        
        return { categories, locations };
      },
      enabled: !!user
    });
  };
  
  // Get a single listing by ID
  const useListing = (listingId?: string) => {
    const isAdmin = user?.is_admin === true;
    
    return useQuery({
      queryKey: ["listing", listingId, isAdmin],
      queryFn: async () => {
        if (!listingId) return null;
        
        let query = supabase
          .from("listings")
          .select("*")
          .eq("id", listingId);
          
        // For non-admin users, only allow viewing active listings
        if (!isAdmin) {
          query = query.eq("status", "active");
        }
        
        const { data, error } = await query.maybeSingle();
        
        if (error) {
          console.error("Error fetching listing:", error);
          throw error;
        }
        
        return data as Listing | null;
      },
      enabled: !!listingId && !!user
    });
  };
  
  // Request connection to a listing
  const useRequestConnection = () => {
    return useMutation({
      mutationFn: async (listingId: string) => {
        if (!user) throw new Error("User not authenticated");
        
        const { data, error } = await supabase
          .from("connection_requests")
          .insert({
            user_id: user.id,
            listing_id: listingId,
            status: "pending"
          })
          .select();
        
        if (error) {
          console.error("Error requesting connection:", error);
          throw error;
        }
        
        return data[0];
      },
      onSuccess: () => {
        // Invalidate connection status queries
        queryClient.invalidateQueries({ queryKey: ["connection-status"] });
        queryClient.invalidateQueries({ queryKey: ["user-connection-requests"] });
        
        toast({
          title: "Connection requested",
          description: "Your connection request has been submitted and is pending approval.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Request failed",
          description: error.message || "Failed to submit connection request",
        });
      }
    });
  };
  
  // Check if user has requested connection to a listing
  const useConnectionStatus = (listingId: string) => {
    return useQuery({
      queryKey: ["connection-status", listingId],
      queryFn: async () => {
        if (!user) return { exists: false, status: null };
        
        const { data, error } = await supabase
          .from("connection_requests")
          .select("status")
          .eq("user_id", user.id)
          .eq("listing_id", listingId)
          .maybeSingle();
        
        if (error) {
          console.error("Error checking connection status:", error);
          throw error;
        }
        
        return { 
          exists: !!data, 
          status: data?.status || null
        };
      },
      enabled: !!listingId && !!user
    });
  };
  
  // Save/unsave a listing
  const useSaveListingMutation = () => {
    return useMutation({
      mutationFn: async ({ 
        listingId, 
        action 
      }: { 
        listingId: string; 
        action: "save" | "unsave" 
      }) => {
        if (!user) throw new Error("User not authenticated");
        
        if (action === "save") {
          const { data, error } = await supabase
            .from("saved_listings")
            .insert({
              user_id: user.id,
              listing_id: listingId
            })
            .select();
          
          if (error) {
            console.error("Error saving listing:", error);
            throw error;
          }
          
          return data[0];
        } else {
          const { error } = await supabase
            .from("saved_listings")
            .delete()
            .eq("user_id", user.id)
            .eq("listing_id", listingId);
          
          if (error) {
            console.error("Error unsaving listing:", error);
            throw error;
          }
          
          return { user_id: user.id, listing_id: listingId };
        }
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["saved-status", variables.listingId] });
        queryClient.invalidateQueries({ queryKey: ["saved-listings"] });
        
        toast({
          title: variables.action === "save" ? "Listing saved" : "Listing unsaved",
          description: variables.action === "save" 
            ? "This listing has been added to your saved listings" 
            : "This listing has been removed from your saved listings",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: error.message || "Failed to update saved status",
        });
      }
    });
  };
  
  // Check if user has saved a listing
  const useSavedStatus = (listingId: string) => {
    return useQuery({
      queryKey: ["saved-status", listingId],
      queryFn: async () => {
        if (!user) return false;
        
        const { data, error } = await supabase
          .from("saved_listings")
          .select("*")
          .eq("user_id", user.id)
          .eq("listing_id", listingId)
          .maybeSingle();
        
        if (error) {
          console.error("Error checking saved status:", error);
          throw error;
        }
        
        return !!data;
      },
      enabled: !!listingId && !!user
    });
  };
  
  // Get all connection requests for the current user
  const useUserConnectionRequests = () => {
    return useQuery({
      queryKey: ["user-connection-requests"],
      queryFn: async () => {
        if (!user) return [];
        
        // Get connection requests
        const { data: requests, error } = await supabase
          .from("connection_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (error) {
          console.error("Error fetching user connection requests:", error);
          throw error;
        }
        
        // For each request, get the listing details
        const requestsWithListings = await Promise.all(requests.map(async (request) => {
          const { data: listing, error: listingError } = await supabase
            .from("listings")
            .select("*")
            .eq("id", request.listing_id)
            .maybeSingle();
          
          if (listingError) {
            console.error("Error fetching listing:", listingError);
            return { ...request, listing: null };
          }
          
          return { ...request, listing };
        }));
        
        return requestsWithListings;
      },
      enabled: !!user
    });
  };
  
  return {
    useListings,
    useListingMetadata,
    useListing,
    useRequestConnection,
    useConnectionStatus,
    useSaveListingMutation,
    useSavedStatus,
    useUserConnectionRequests
  };
}
