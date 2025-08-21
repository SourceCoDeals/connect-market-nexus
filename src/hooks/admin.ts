
// Consolidated admin hooks file
import { useAdminUsers } from './admin/use-admin-users';
import { useAdminListings } from './admin/use-admin-listings';
import { useAdminRequests } from './admin/use-admin-requests';
import { useAdminStats } from './admin/use-admin-stats';
import { useAdminEmail } from './admin/use-admin-email';
import { useAdminCategories } from './admin/use-admin-categories';

/**
 * A hook that provides access to all admin-related functionality
 * Returns actual mutation objects and query hooks for direct use
 */
export function useAdmin() {
  // Users management - get the actual hooks and call them to get mutation objects
  const adminUsers = useAdminUsers();
  const users = adminUsers.useUsers();
  const updateUserStatus = adminUsers.useUpdateUserStatus();
  const updateAdminStatus = adminUsers.useUpdateAdminStatus();
  const promoteToAdmin = adminUsers.usePromoteToAdmin();
  const demoteAdmin = adminUsers.useDemoteAdmin();
  const deleteUser = adminUsers.useDeleteUser();
  
  // Get hook functions for other modules (not called)
  const adminListings = useAdminListings();
  const adminCategories = useAdminCategories();
  const adminRequests = useAdminRequests();
  const adminStats = useAdminStats();
  const adminEmail = useAdminEmail();
  
  return {
    // User management - return actual query/mutation objects
    users,
    updateUserStatus,
    updateAdminStatus,
    promoteToAdmin,
    demoteAdmin,
    deleteUser,
    
    // Listings management - return hook functions
    useListings: adminListings.useListings,
    useCreateListing: adminListings.useCreateListing,
    useUpdateListing: adminListings.useUpdateListing,
    useDeleteListing: adminListings.useDeleteListing,
    useToggleListingStatus: adminListings.useToggleListingStatus,
    
    // Categories management - return hook functions
    useCategories: adminCategories.useCategories,
    useCreateCategory: adminCategories.useCreateCategory,
    useUpdateCategory: adminCategories.useUpdateCategory,
    useDeleteCategory: adminCategories.useDeleteCategory,
    
    // Connection requests management - return hook functions
    useConnectionRequests: adminRequests.useConnectionRequests,
    useConnectionRequestsMutation: adminRequests.useConnectionRequestsMutation,
    
    // Admin dashboard stats - return hook functions
    useStats: adminStats.useStats,
    useRecentActivities: adminStats.useRecentActivities,
    
    // Email notifications
    sendUserApprovalEmail: adminEmail.sendUserApprovalEmail,
    sendUserRejectionEmail: adminEmail.sendUserRejectionEmail,
    sendConnectionApprovalEmail: adminEmail.sendConnectionApprovalEmail,
    sendConnectionRejectionEmail: adminEmail.sendConnectionRejectionEmail,
    sendCustomApprovalEmail: adminEmail.sendCustomApprovalEmail,
  };
}

// Re-export all individual hooks for direct access
export * from './admin/use-admin-users';
export * from './admin/use-admin-listings';
export * from './admin/use-admin-requests';
export * from './admin/use-admin-stats';
export * from './admin/use-admin-email';
export * from './admin/use-admin-categories';
export * from './admin/use-connection-request-status';
