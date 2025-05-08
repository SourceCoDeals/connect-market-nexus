
import { useAdminUsers } from './use-admin-users';
import { useAdminListings } from './use-admin-listings';
import { useAdminRequests } from './use-admin-requests';
import { useAdminStats } from './use-admin-stats';
import { useAdminEmail } from './use-admin-email';

/**
 * Combined hook for all admin functionality
 */
export function useAdmin() {
  const { useUsers, useUpdateUserStatus, useUpdateAdminStatus } = useAdminUsers();
  const { useListings, useCreateListing, useUpdateListing, useDeleteListing } = useAdminListings();
  const { useConnectionRequests, useUpdateConnectionRequest } = useAdminRequests();
  const { useStats, useRecentActivities } = useAdminStats();
  const { 
    sendUserApprovalEmail,
    sendUserRejectionEmail,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail
  } = useAdminEmail();

  return {
    // User management
    useUsers,
    useUpdateUserStatus,
    useUpdateAdminStatus,

    // Listing management
    useListings,
    useCreateListing,
    useUpdateListing,
    useDeleteListing,

    // Connection requests
    useConnectionRequests,
    useUpdateConnectionRequest,

    // Stats and activities
    useAdminStats: useStats,
    useRecentActivities,
    
    // Email notifications
    sendUserApprovalEmail,
    sendUserRejectionEmail,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail,
  };
}
