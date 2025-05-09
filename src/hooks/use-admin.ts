
import { useAdminEmail } from './admin/use-admin-email';
import { useAdminListings } from './admin/use-admin-listings';
import { useAdminRequests } from './admin/use-admin-requests';
import { useAdminStats } from './admin/use-admin-stats';
import { useAdminUsers } from './admin/use-admin-users';

/**
 * Hook for accessing admin functionality
 * @returns Object containing all admin hooks
 */
export function useAdmin() {
  const adminEmail = useAdminEmail();
  const adminListings = useAdminListings();
  const adminRequests = useAdminRequests();
  const adminStats = useAdminStats();
  const adminUsers = useAdminUsers();
  
  // Extract the hooks from adminRequests to expose them correctly
  const { useConnectionRequests, useUpdateConnectionRequest } = adminRequests;
  
  return {
    ...adminEmail,
    ...adminListings,
    ...adminStats,
    ...adminUsers,
    // Directly expose the connection request hooks
    useConnectionRequests,
    useUpdateConnectionRequest,
  };
}
