
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { AdminListing, AdminConnectionRequest, AdminStats } from '@/types/admin';

export function useAdmin() {
  const queryClient = useQueryClient();
  
  // Fetch users with their profiles
  const useUsers = () => {
    return useQuery({
      queryKey: ['admin-users'],
      queryFn: async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data as User[];
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Error fetching users',
            description: error.message,
          });
          return [];
        }
      },
    });
  };

  // Update user approval status
  const useUpdateUserStatus = () => {
    return useMutation({
      mutationFn: async ({
        userId,
        status,
      }: {
        userId: string;
        status: 'approved' | 'rejected';
      }) => {
        const { error } = await supabase
          .from('profiles')
          .update({ approval_status: status })
          .eq('id', userId);

        if (error) throw error;
        return { userId, status };
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        toast({
          title: 'User status updated',
          description: `User has been ${data.status}`,
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error.message,
        });
      },
    });
  };

  // Fetch all listings
  const useListings = () => {
    return useQuery({
      queryKey: ['admin-listings'],
      queryFn: async () => {
        try {
          const { data, error } = await supabase
            .from('listings')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data as AdminListing[];
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Error fetching listings',
            description: error.message,
          });
          return [];
        }
      },
    });
  };

  // Create a listing
  const useCreateListing = () => {
    return useMutation({
      mutationFn: async (listing: Omit<AdminListing, 'id' | 'created_at' | 'updated_at'>) => {
        const { data, error } = await supabase
          .from('listings')
          .insert(listing)
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        toast({
          title: 'Listing created',
          description: 'The listing has been successfully created',
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Failed to create listing',
          description: error.message,
        });
      },
    });
  };

  // Update a listing
  const useUpdateListing = () => {
    return useMutation({
      mutationFn: async ({
        id,
        listing,
      }: {
        id: string;
        listing: Partial<AdminListing>;
      }) => {
        const { data, error } = await supabase
          .from('listings')
          .update({ ...listing, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        toast({
          title: 'Listing updated',
          description: 'The listing has been successfully updated',
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Failed to update listing',
          description: error.message,
        });
      },
    });
  };

  // Delete a listing
  const useDeleteListing = () => {
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase
          .from('listings')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return id;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        toast({
          title: 'Listing deleted',
          description: 'The listing has been successfully deleted',
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Failed to delete listing',
          description: error.message,
        });
      },
    });
  };

  // Fetch connection requests
  const useConnectionRequests = () => {
    return useQuery({
      queryKey: ['admin-connection-requests'],
      queryFn: async () => {
        try {
          const { data, error } = await supabase
            .from('connection_requests')
            .select(`
              *,
              profiles:user_id (id, first_name, last_name, email, company),
              listings:listing_id (*)
            `)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          return data.map((request: any) => ({
            ...request,
            user: request.profiles,
            listing: request.listings
          })) as AdminConnectionRequest[];
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Error fetching connection requests',
            description: error.message,
          });
          return [];
        }
      },
    });
  };

  // Update connection request status
  const useUpdateConnectionRequest = () => {
    return useMutation({
      mutationFn: async ({
        id,
        status,
        comment,
      }: {
        id: string;
        status: 'approved' | 'rejected';
        comment?: string;
      }) => {
        const updateData: { status: string; admin_comment?: string; updated_at: string } = {
          status,
          updated_at: new Date().toISOString(),
        };
        
        if (comment) {
          updateData.admin_comment = comment;
        }
        
        const { data, error } = await supabase
          .from('connection_requests')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
        toast({
          title: 'Connection request updated',
          description: 'The connection request has been updated',
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Failed to update connection request',
          description: error.message,
        });
      },
    });
  };

  // Get admin dashboard stats
  const useAdminStats = () => {
    return useQuery({
      queryKey: ['admin-stats'],
      queryFn: async () => {
        try {
          // Get total users count
          const { count: totalUsers, error: usersError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          
          if (usersError) throw usersError;
          
          // Get pending users count
          const { count: pendingUsers, error: pendingError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'pending');
          
          if (pendingError) throw pendingError;
          
          // Get total listings count
          const { count: totalListings, error: listingsError } = await supabase
            .from('listings')
            .select('*', { count: 'exact', head: true });
          
          if (listingsError) throw listingsError;
          
          // Get pending connection requests count
          const { count: pendingConnections, error: connectionsError } = await supabase
            .from('connection_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
          
          if (connectionsError) throw connectionsError;
          
          return {
            totalUsers: totalUsers || 0,
            pendingUsers: pendingUsers || 0,
            totalListings: totalListings || 0,
            pendingConnections: pendingConnections || 0,
          };
        } catch (error: any) {
          console.error("Error getting admin stats:", error);
          toast({
            variant: 'destructive',
            title: 'Error loading stats',
            description: error.message,
          });
          
          return {
            totalUsers: 0,
            pendingUsers: 0,
            totalListings: 0,
            pendingConnections: 0,
          };
        }
      },
    });
  };

  // Get recent activities
  const useRecentActivities = () => {
    return useQuery({
      queryKey: ['admin-recent-activities'],
      queryFn: async () => {
        try {
          const activities: any[] = [];
          
          // Recent user signups
          const { data: signups, error: signupsError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (signupsError) throw signupsError;
          
          activities.push(...(signups || []).map((signup) => ({
            id: `signup-${signup.id}`,
            type: 'signup',
            description: `New user registered: ${signup.first_name} ${signup.last_name}`,
            timestamp: signup.created_at,
            user_id: signup.id,
          })));
          
          // Recent connection requests
          const { data: connections, error: connectionsError } = await supabase
            .from('connection_requests')
            .select(`
              id, created_at, user_id,
              profiles:user_id (first_name, last_name),
              listings:listing_id (title)
            `)
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (connectionsError) throw connectionsError;
          
          activities.push(...(connections || []).map((connection: any) => ({
            id: `connection-${connection.id}`,
            type: 'connection_request',
            description: `New connection request for ${connection.listings?.title} from ${connection.profiles?.first_name} ${connection.profiles?.last_name}`,
            timestamp: connection.created_at,
            user_id: connection.user_id,
          })));
          
          // Recent listing creations
          const { data: listings, error: listingsError } = await supabase
            .from('listings')
            .select('id, title, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (listingsError) throw listingsError;
          
          activities.push(...(listings || []).map((listing) => ({
            id: `listing-${listing.id}`,
            type: 'listing_creation',
            description: `New listing created: ${listing.title}`,
            timestamp: listing.created_at,
          })));
          
          // Sort by timestamp, newest first
          activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          return activities.slice(0, 10); // Return 10 most recent activities
        } catch (error: any) {
          console.error("Error loading recent activities:", error);
          toast({
            variant: 'destructive',
            title: 'Error loading activities',
            description: error.message,
          });
          return [];
        }
      },
    });
  };

  return {
    useUsers,
    useUpdateUserStatus,
    useListings,
    useCreateListing,
    useUpdateListing,
    useDeleteListing,
    useConnectionRequests,
    useUpdateConnectionRequest,
    useAdminStats,
    useRecentActivities,
  };
}
