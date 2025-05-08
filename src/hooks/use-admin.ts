
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { User, ApprovalStatus } from '@/types';
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
          
          // Transform profiles data to match User interface
          const users = (data || []).map(profile => ({
            ...profile,
            role: profile.is_admin ? 'admin' : 'buyer',
            firstName: profile.first_name,
            lastName: profile.last_name,
            phoneNumber: profile.phone_number,
            isAdmin: profile.is_admin,
            buyerType: profile.buyer_type,
            emailVerified: profile.email_verified,
            isApproved: profile.approval_status === 'approved',
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
          })) as User[];
          
          return users;
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
    const queryClient = useQueryClient();
    
    return useMutation({
      mutationFn: async ({
        userId,
        status,
      }: {
        userId: string;
        status: ApprovalStatus;
      }) => {
        const { data, error } = await supabase
          .from("profiles")
          .update({ approval_status: status })
          .eq("id", userId)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        toast({
          title: "Status updated",
          description: "User status has been updated successfully.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: error.message || "Failed to update user status",
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
          // First try to get connection requests with user and listing data
          const { data: requestsData, error: requestsError } = await supabase
            .from('connection_requests')
            .select('*')
            .order('created_at', { ascending: false });

          if (requestsError) {
            console.error("Error fetching connection requests:", requestsError);
            throw requestsError;
          }

          // If we successfully got the requests, now get the users and listings separately
          const requests = requestsData as AdminConnectionRequest[];
          
          // Get unique user IDs from requests
          const userIds = [...new Set(requests.map(r => r.user_id))];
          
          // Fetch user data
          const { data: usersData, error: usersError } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);
            
          if (usersError) {
            console.error("Error fetching users for requests:", usersError);
          }
          
          // Get unique listing IDs from requests
          const listingIds = [...new Set(requests.map(r => r.listing_id))];
          
          // Fetch listing data
          const { data: listingsData, error: listingsError } = await supabase
            .from('listings')
            .select('*')
            .in('id', listingIds);
            
          if (listingsError) {
            console.error("Error fetching listings for requests:", listingsError);
          }

          // Create a map for quick user lookup with transformed User data
          const usersMap = (usersData || []).reduce((acc, profile) => {
            acc[profile.id] = {
              ...profile,
              role: profile.is_admin ? 'admin' : 'buyer',
              firstName: profile.first_name,
              lastName: profile.last_name,
              phoneNumber: profile.phone_number,
              isAdmin: profile.is_admin,
              buyerType: profile.buyer_type,
              emailVerified: profile.email_verified,
              isApproved: profile.approval_status === 'approved',
              createdAt: profile.created_at,
              updatedAt: profile.updated_at,
            } as User;
            return acc;
          }, {} as Record<string, User>);
          
          // Create a map for quick listing lookup
          const listingsMap = (listingsData || []).reduce((acc, listing) => {
            acc[listing.id] = listing;
            return acc;
          }, {} as Record<string, AdminListing>);
          
          // Combine the data
          return requests.map(request => ({
            ...request,
            user: usersMap[request.user_id] || null,
            listing: listingsMap[request.listing_id] || null
          }));
          
        } catch (error: any) {
          console.error("Detailed error in connection requests:", error);
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
