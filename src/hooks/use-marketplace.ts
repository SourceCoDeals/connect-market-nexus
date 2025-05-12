
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { FilterOptions, Listing, ListingStatus, ConnectionRequest } from '@/types';

export function useMarketplace() {
  const queryClient = useQueryClient();

  // Fetch listings with filters and pagination
  const useListings = (filters: FilterOptions = {}) => {
    return useQuery({
      queryKey: ['marketplace-listings', filters],
      queryFn: async () => {
        try {
          // Start building the query
          let query = supabase
            .from('listings')
            .select('*', { count: 'exact' });
          
          // Always filter to only show active listings in the marketplace
          query = query.eq('status', 'active');
          
          // Apply filters if provided
          if (filters.category) {
            query = query.eq('category', filters.category);
          }
          
          if (filters.location) {
            query = query.eq('location', filters.location);
          }
          
          if (filters.revenueMin !== undefined) {
            query = query.gte('revenue', filters.revenueMin);
          }
          
          if (filters.revenueMax !== undefined) {
            query = query.lte('revenue', filters.revenueMax);
          }
          
          if (filters.ebitdaMin !== undefined) {
            query = query.gte('ebitda', filters.ebitdaMin);
          }
          
          if (filters.ebitdaMax !== undefined) {
            query = query.lte('ebitda', filters.ebitdaMax);
          }
          
          if (filters.search) {
            query = query.ilike('title', `%${filters.search}%`);
          }
          
          // Apply pagination
          const page = filters.page || 1;
          const perPage = filters.perPage || 20;
          const start = (page - 1) * perPage;
          const end = start + perPage - 1;
          
          query = query
            .order('created_at', { ascending: false })
            .range(start, end);
          
          // Execute the query
          const { data, error, count } = await query;
          
          if (error) throw error;
          
          // Transform data to include computed properties
          const listings = data?.map((item: any) => {
            const listing: Listing = {
              ...item,
              // Add computed properties
              ownerNotes: item.owner_notes || '',
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              // Ensure status is properly typed as ListingStatus
              status: item.status as ListingStatus,
              multiples: item.revenue > 0 ? {
                revenue: (item.ebitda / item.revenue).toFixed(2),
                value: '0'
              } : undefined,
              revenueFormatted: new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(item.revenue),
              ebitdaFormatted: new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(item.ebitda),
            };
            return listing;
          });
          
          return {
            listings: listings || [],
            totalCount: count || 0
          };
        } catch (error: any) {
          console.error('Error fetching listings:', error);
          throw error;
        }
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };
  
  // Get a single listing by ID
  const useListing = (id: string | undefined) => {
    return useQuery({
      queryKey: ['listing', id],
      queryFn: async () => {
        if (!id) return null;
        
        try {
          const { data, error } = await supabase
            .from('listings')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          
          if (error) throw error;
          if (!data) return null;
          
          // Transform to Listing type with computed properties
          const listing: Listing = {
            ...data,
            // Add computed properties
            ownerNotes: data.owner_notes || '',
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            // Ensure status is properly typed as ListingStatus
            status: data.status as ListingStatus,
            multiples: data.revenue > 0 ? {
              revenue: (data.ebitda / data.revenue).toFixed(2),
              value: '0'
            } : undefined,
            revenueFormatted: new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(data.revenue),
            ebitdaFormatted: new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(data.ebitda),
          };
          
          return listing;
        } catch (error: any) {
          console.error('Error fetching listing:', error);
          throw error;
        }
      },
      enabled: !!id,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };

  // Get listing metadata for filters (categories, locations)
  const useListingMetadata = () => {
    return useQuery({
      queryKey: ['listing-metadata'],
      queryFn: async () => {
        try {
          // Only query active listings for metadata
          const { data, error } = await supabase
            .from('listings')
            .select('category, location')
            .eq('status', 'active');
          
          if (error) throw error;
          
          // Extract unique categories and locations
          const categories = [...new Set(data.map(item => item.category))].filter(Boolean).sort();
          const locations = [...new Set(data.map(item => item.location))].filter(Boolean).sort();
          
          return { categories, locations };
        } catch (error: any) {
          console.error('Error fetching listing metadata:', error);
          return { categories: [], locations: [] };
        }
      },
      staleTime: 1000 * 60 * 15, // 15 minutes
    });
  };

  // Request connection to a listing
  const useRequestConnection = () => {
    return useMutation({
      mutationFn: async (listingId: string) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('You must be logged in to request a connection');
          
          const { data: existing, error: checkError } = await supabase
            .from('connection_requests')
            .select()
            .eq('listing_id', listingId)
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (checkError) throw checkError;
          
          // If a request already exists, don't create a new one
          if (existing) {
            return existing;
          }
          
          const userId = session.user.id;
          
          // Create connection request
          const { data, error } = await supabase
            .from('connection_requests')
            .insert({
              user_id: userId,
              listing_id: listingId,
              status: 'pending'
            })
            .select()
            .single();
          
          if (error) throw error;
          
          // Log activity
          await supabase.from('user_activity').insert({
            user_id: userId,
            activity_type: 'connection_request',
            metadata: { listing_id: listingId }
          });

          // Send notification email to user
          try {
            // Get user data
            const { data: userData, error: userError } = await supabase
              .from('profiles')
              .select('first_name, email')
              .eq('id', userId)
              .single();
            
            if (userError) throw userError;

            // Get listing data
            const { data: listingData, error: listingError } = await supabase
              .from('listings')
              .select('title')
              .eq('id', listingId)
              .single();

            if (listingError) throw listingError;

            // Send notification email
            await supabase.functions.invoke('send-connection-notification', {
              body: JSON.stringify({
                type: 'request_received',
                userEmail: userData.email,
                firstName: userData.first_name,
                listingName: listingData.title
              })
            });

            // Also send admin notification
            await supabase.functions.invoke('send-connection-notification', {
              body: JSON.stringify({
                type: 'new_request',
                listing: {
                  title: listingData.title,
                  category: listingData.category || 'Uncategorized',
                  location: listingData.location || 'Unknown'
                },
                buyer: {
                  name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
                  email: userData.email,
                  company: userData.company || ''
                },
                timestamp: new Date().toISOString()
              })
            });
          } catch (notificationError) {
            // Log the error but don't fail the whole request
            console.error('Failed to send notification:', notificationError);
          }
          
          return data;
        } catch (error: any) {
          console.error('Error requesting connection:', error);
          throw error;
        }
      },
      onSuccess: () => {
        toast({
          title: 'Connection Requested',
          description: 'Your connection request has been submitted for review.',
        });
        
        // Invalidate connection status query to update UI
        queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to request connection',
        });
      },
    });
  };

  // Get connection status for a listing
  const useConnectionStatus = (listingId: string | undefined) => {
    return useQuery({
      queryKey: ['connection-status', listingId],
      queryFn: async () => {
        if (!listingId) return { exists: false, status: '' };
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return { exists: false, status: '' };
          
          const { data, error } = await supabase
            .from('connection_requests')
            .select('status')
            .eq('listing_id', listingId)
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (error) throw error;
          
          return {
            exists: !!data,
            status: data?.status || ''
          };
        } catch (error: any) {
          console.error('Error checking connection status:', error);
          return { exists: false, status: '' };
        }
      },
      enabled: !!listingId,
      staleTime: 1000 * 60, // 1 minute
    });
  };

  // Save/unsave a listing
  const useSaveListingMutation = () => {
    return useMutation({
      mutationFn: async ({ 
        listingId, 
        action 
      }: { 
        listingId: string, 
        action: 'save' | 'unsave' 
      }) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('You must be logged in to save listings');
          
          const userId = session.user.id;
          
          if (action === 'save') {
            const { data, error } = await supabase
              .from('saved_listings')
              .insert({
                user_id: userId,
                listing_id: listingId
              })
              .select()
              .single();
            
            if (error) throw error;
            return data;
          } else {
            const { error } = await supabase
              .from('saved_listings')
              .delete()
              .eq('user_id', userId)
              .eq('listing_id', listingId);
            
            if (error) throw error;
            return { success: true };
          }
        } catch (error: any) {
          console.error(`Error ${action === 'save' ? 'saving' : 'unsaving'} listing:`, error);
          throw error;
        }
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['saved-status'] });
        toast({
          title: variables.action === 'save' ? 'Listing Saved' : 'Listing Removed',
          description: variables.action === 'save' 
            ? 'The listing has been saved to your favorites.'
            : 'The listing has been removed from your favorites.',
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to update saved listing',
        });
      },
    });
  };

  // Check if listing is saved
  const useSavedStatus = (listingId: string | undefined) => {
    return useQuery({
      queryKey: ['saved-status', listingId],
      queryFn: async () => {
        if (!listingId) return false;
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return false;
          
          const { data, error } = await supabase
            .from('saved_listings')
            .select()
            .eq('listing_id', listingId)
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (error) throw error;
          
          return !!data;
        } catch (error: any) {
          console.error('Error checking saved status:', error);
          return false;
        }
      },
      enabled: !!listingId,
      staleTime: 1000 * 60, // 1 minute
    });
  };

  // Add missing hook: Get user connection requests
  const useUserConnectionRequests = () => {
    return useQuery({
      queryKey: ['user-connection-requests'],
      queryFn: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return [];
          
          const { data, error } = await supabase
            .from('connection_requests')
            .select(`
              *,
              listing:listing_id (
                id, title, category, location, description
              )
            `)
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          
          return data as ConnectionRequest[];
        } catch (error: any) {
          console.error('Error fetching user connection requests:', error);
          return [];
        }
      },
      staleTime: 1000 * 60, // 1 minute
    });
  };

  return {
    useListings,
    useListing,
    useListingMetadata,
    useRequestConnection,
    useConnectionStatus,
    useSaveListingMutation,
    useSavedStatus,
    useUserConnectionRequests,
  };
}
