
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Listing, FilterOptions } from "@/types";

export function useMarketplace() {
  const queryClient = useQueryClient();
  
  // Fetch all listings
  const useListings = (filters?: FilterOptions) => {
    return useQuery({
      queryKey: ["listings", filters],
      queryFn: async () => {
        try {
          let query = supabase.from("listings").select("*");
          
          // Apply filters
          if (filters) {
            if (filters.category) {
              const categories = filters.category.split(",");
              query = query.in("category", categories);
            }
            
            if (filters.location) {
              const locations = filters.location.split(",");
              query = query.in("location", locations);
            }
            
            if (filters.revenueMin !== undefined) {
              query = query.gte("revenue", filters.revenueMin);
            }
            
            if (filters.revenueMax !== undefined) {
              query = query.lte("revenue", filters.revenueMax);
            }
            
            if (filters.ebitdaMin !== undefined) {
              query = query.gte("ebitda", filters.ebitdaMin);
            }
            
            if (filters.ebitdaMax !== undefined) {
              query = query.lte("ebitda", filters.ebitdaMax);
            }
            
            if (filters.search) {
              query = query.or(
                `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%,location.ilike.%${filters.search}%`
              );
            }
          }
          
          // Order by newest first
          query = query.order("created_at", { ascending: false });
          
          const { data, error } = await query;
          
          if (error) throw error;
          return data as unknown as Listing[];
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Error loading listings",
            description: error.message,
          });
          return [];
        }
      },
    });
  };
  
  // Fetch a single listing by ID
  const useListing = (id?: string) => {
    return useQuery({
      queryKey: ["listing", id],
      queryFn: async () => {
        if (!id) return null;
        
        try {
          const { data, error } = await supabase
            .from("listings")
            .select("*")
            .eq("id", id)
            .single();
          
          if (error) throw error;
          return data as unknown as Listing;
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Error loading listing",
            description: error.message,
          });
          return null;
        }
      },
      enabled: !!id,
    });
  };
  
  // Request connection to a listing
  const useRequestConnection = () => {
    return useMutation({
      mutationFn: async (listingId: string) => {
        const { data, error } = await supabase
          .from("connection_requests")
          .insert([{ listing_id: listingId, user_id: (await supabase.auth.getUser()).data.user?.id }])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["user-connections"] });
        toast({
          title: "Connection requested",
          description: "The owner has been notified of your interest.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Request failed",
          description:
            error.message === "duplicate key value violates unique constraint"
              ? "You've already requested this connection."
              : error.message,
        });
      },
    });
  };
  
  // Check if user has already requested a connection
  const useConnectionStatus = (listingId?: string) => {
    return useQuery({
      queryKey: ["connection-status", listingId],
      queryFn: async () => {
        if (!listingId) return { exists: false, status: "" };
        
        try {
          const { data, error } = await supabase
            .from("connection_requests")
            .select("id, status")
            .eq("listing_id", listingId)
            .single();
          
          if (error) {
            if (error.code === "PGRST116") {
              // No connection request found
              return { exists: false, status: "" };
            }
            throw error;
          }
          
          return { exists: true, status: data.status };
        } catch (error: any) {
          console.error("Error checking connection status:", error);
          return { exists: false, status: "" };
        }
      },
      enabled: !!listingId,
    });
  };
  
  // Save/unsave a listing
  const useSaveListingMutation = () => {
    return useMutation({
      mutationFn: async ({
        listingId,
        action,
      }: {
        listingId: string;
        action: "save" | "unsave";
      }) => {
        if (action === "save") {
          const { data, error } = await supabase
            .from("saved_listings")
            .insert([{ 
              listing_id: listingId, 
              user_id: (await supabase.auth.getUser()).data.user?.id 
            }])
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } else {
          const { error } = await supabase
            .from("saved_listings")
            .delete()
            .eq("listing_id", listingId);
          
          if (error) throw error;
          return { listingId, action: "unsave" };
        }
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["saved-listings"] });
        toast({
          title:
            variables.action === "save" ? "Listing saved" : "Listing unsaved",
          description:
            variables.action === "save"
              ? "This listing has been added to your saved items."
              : "This listing has been removed from your saved items.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Action failed",
          description:
            error.message === "duplicate key value violates unique constraint"
              ? "This listing is already saved."
              : error.message,
        });
      },
    });
  };
  
  // Check if a listing is saved
  const useSavedStatus = (listingId?: string) => {
    return useQuery({
      queryKey: ["saved-status", listingId],
      queryFn: async () => {
        if (!listingId) return false;
        
        try {
          const { data, error } = await supabase
            .from("saved_listings")
            .select("id")
            .eq("listing_id", listingId)
            .single();
          
          if (error) {
            if (error.code === "PGRST116") {
              // Not saved
              return false;
            }
            throw error;
          }
          
          return true;
        } catch (error: any) {
          console.error("Error checking saved status:", error);
          return false;
        }
      },
      enabled: !!listingId,
    });
  };
  
  // Get all saved listings
  const useSavedListings = () => {
    return useQuery({
      queryKey: ["saved-listings"],
      queryFn: async () => {
        try {
          const { data, error } = await supabase
            .from("saved_listings")
            .select("*, listings(*)")
            .order("created_at", { ascending: false });
          
          if (error) throw error;
          
          return data.map((savedItem) => ({
            id: savedItem.id,
            savedAt: savedItem.created_at,
            listing: savedItem.listings as unknown as Listing,
          }));
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Error loading saved listings",
            description: error.message,
          });
          return [];
        }
      },
    });
  };
  
  // Get user's connection requests
  const useUserConnections = () => {
    return useQuery({
      queryKey: ["user-connections"],
      queryFn: async () => {
        try {
          const { data, error } = await supabase
            .from("connection_requests")
            .select("*, listings(*)")
            .order("created_at", { ascending: false });
          
          if (error) throw error;
          
          return data.map((request) => ({
            id: request.id,
            requestedAt: request.created_at,
            status: request.status,
            adminComment: request.admin_comment,
            listing: request.listings as unknown as Listing,
          }));
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Error loading connection requests",
            description: error.message,
          });
          return [];
        }
      },
    });
  };
  
  // Get unique listing categories and locations for filters
  const useListingMetadata = () => {
    return useQuery({
      queryKey: ["listing-metadata"],
      queryFn: async () => {
        try {
          const { data: categoryData, error: categoryError } = await supabase
            .from("listings")
            .select("category");
          
          if (categoryError) throw categoryError;
          
          const { data: locationData, error: locationError } = await supabase
            .from("listings")
            .select("location");
          
          if (locationError) throw locationError;
          
          // Extract unique categories and locations
          const categories = [
            ...new Set(categoryData.map((item) => item.category)),
          ].sort();
          const locations = [
            ...new Set(locationData.map((item) => item.location)),
          ].sort();
          
          return { categories, locations };
        } catch (error: any) {
          console.error("Error fetching listing metadata:", error);
          return { categories: [], locations: [] };
        }
      },
    });
  };

  return {
    useListings,
    useListing,
    useRequestConnection,
    useConnectionStatus,
    useSaveListingMutation,
    useSavedStatus,
    useSavedListings,
    useUserConnections,
    useListingMetadata,
  };
}
