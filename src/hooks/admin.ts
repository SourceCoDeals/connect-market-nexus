
// Consolidated admin hooks file
import { useAdminUsers } from './admin/use-admin-users';
import { useAdminListings } from './admin/use-admin-listings';
import { useAdminRequests } from './admin/use-admin-requests';
import { useAdminStats } from './admin/use-admin-stats';
import { useAdminEmail } from './admin/use-admin-email';
import { useAdminCategories } from './admin/use-admin-categories';

/**
 * A hook that provides access to all admin-related functionality
 * Returns actual mutation objects and query hooks, not constructors
 */
export function useAdmin() {
  // Users management - get the actual hooks/mutations
  const adminUsers = useAdminUsers();
  const users = adminUsers.useUsers();
  const updateUserStatus = adminUsers.useUpdateUserStatus();
  const updateAdminStatus = adminUsers.useUpdateAdminStatus();
  const promoteToAdmin = adminUsers.usePromoteToAdmin();
  const demoteAdmin = adminUsers.useDemoteAdmin();
  const deleteUser = adminUsers.useDeleteUser();
  
  // Listings management
  const adminListings = useAdminListings();
  const listings = adminListings.useListings();
  const createListing = adminListings.useCreateListing();
  const updateListing = adminListings.useUpdateListing();
  const deleteListing = adminListings.useDeleteListing();
  const toggleListingStatus = adminListings.useToggleListingStatus();
  
  // Categories management
  const adminCategories = useAdminCategories();
  const categories = adminCategories.useCategories();
  const createCategory = adminCategories.useCreateCategory();
  const updateCategory = adminCategories.useUpdateCategory();
  const deleteCategory = adminCategories.useDeleteCategory();
  
  // Connection requests management
  const adminRequests = useAdminRequests();
  const connectionRequests = adminRequests.useConnectionRequests();
  const connectionRequestsMutation = adminRequests.useConnectionRequestsMutation();
  
  // Admin dashboard stats and activities
  const adminStats = useAdminStats();
  const stats = adminStats.useStats();
  const recentActivities = adminStats.useRecentActivities();
  
  // Email notifications
  const adminEmail = useAdminEmail();
  
  return {
    // User management - return actual query/mutation objects
    users,
    updateUserStatus,
    updateAdminStatus,
    promoteToAdmin,
    demoteAdmin,
    deleteUser,
    
    // Listings management
    listings,
    createListing,
    updateListing,
    deleteListing,
    toggleListingStatus,
    
    // Categories management
    categories,
    createCategory,
    updateCategory,
    deleteCategory,
    
    // Connection requests management
    connectionRequests,
    connectionRequestsMutation,
    
    // Admin dashboard stats
    stats,
    recentActivities,
    
    // Email notifications
    sendUserApprovalEmail: adminEmail.sendUserApprovalEmail,
    sendUserRejectionEmail: adminEmail.sendUserRejectionEmail,
    sendConnectionApprovalEmail: adminEmail.sendConnectionApprovalEmail,
    sendConnectionRejectionEmail: adminEmail.sendConnectionRejectionEmail,
    
    // Legacy support - return hook constructors for backward compatibility
    useUsers: adminUsers.useUsers,
    useUpdateUserStatus: adminUsers.useUpdateUserStatus,
    useUpdateAdminStatus: adminUsers.useUpdateAdminStatus,
    usePromoteToAdmin: adminUsers.usePromoteToAdmin,
    useDemoteAdmin: adminUsers.useDemoteAdmin,
    useDeleteUser: adminUsers.useDeleteUser,
    
    // Listings hooks
    useListings: adminListings.useListings,
    useCreateListing: adminListings.useCreateListing,
    useUpdateListing: adminListings.useUpdateListing,
    useDeleteListing: adminListings.useDeleteListing,
    useToggleListingStatus: adminListings.useToggleListingStatus,
    
    // Categories hooks
    useCategories: adminCategories.useCategories,
    useCreateCategory: adminCategories.useCreateCategory,
    useUpdateCategory: adminCategories.useUpdateCategory,
    useDeleteCategory: adminCategories.useDeleteCategory,
    
    // Connection requests hooks
    useConnectionRequests: adminRequests.useConnectionRequests,
    useConnectionRequestsMutation: adminRequests.useConnectionRequestsMutation,
    
    // Stats hooks
    useStats: adminStats.useStats,
    useRecentActivities: adminStats.useRecentActivities,
  };
}

// Re-export all individual hooks for direct access
export * from './admin/use-admin-users';
export * from './admin/use-admin-listings';
export * from './admin/use-admin-requests';
export * from './admin/use-admin-stats';
export * from './admin/use-admin-email';
export * from './admin/use-admin-categories';
