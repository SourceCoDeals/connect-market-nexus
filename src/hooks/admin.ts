
// Consolidated admin hooks file
import { useAdminUsers } from './admin/use-admin-users';
import { useAdminListings } from './admin/use-admin-listings';
import { useAdminRequests } from './admin/use-admin-requests';
import { useAdminStats } from './admin/use-admin-stats';
import { useAdminEmail } from './admin/use-admin-email';

/**
 * A hook that provides access to all admin-related functionality
 */
export function useAdmin() {
  // Users management
  const {
    useUsers,
    useUpdateUserStatus,
    useUpdateAdminStatus,
  } = useAdminUsers();
  
  // Listings management
  const {
    useListings,
    useCreateListing,
    useUpdateListing,
    useDeleteListing,
  } = useAdminListings();
  
  // Connection requests management
  const {
    useConnectionRequests,
    useUpdateConnectionRequest,
  } = useAdminRequests();
  
  // Admin dashboard stats and activities
  const {
    useStats,
    useRecentActivities,
  } = useAdminStats();
  
  // Email notifications
  const {
    sendUserApprovalEmail,
    sendUserRejectionEmail,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail,
  } = useAdminEmail();
  
  return {
    // User management
    useUsers,
    useUpdateUserStatus,
    useUpdateAdminStatus,
    
    // Listings management
    useListings,
    useCreateListing,
    useUpdateListing,
    useDeleteListing,
    
    // Connection requests management
    useConnectionRequests,
    useUpdateConnectionRequest,
    
    // Admin dashboard stats
    useStats,
    useRecentActivities,
    
    // Email notifications
    sendUserApprovalEmail,
    sendUserRejectionEmail,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail,
  };
}

// Re-export all individual hooks for direct access
export * from './admin/use-admin-users';
export * from './admin/use-admin-listings';
export * from './admin/use-admin-requests';
export * from './admin/use-admin-stats';
export * from './admin/use-admin-email';
