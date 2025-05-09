
import { useConnectionRequestsQuery } from './requests/use-connection-requests-query';
import { useConnectionRequestsMutation } from './requests/use-connection-requests-mutation';
import { AdminConnectionRequest } from '@/types/admin';
import { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

/**
 * Hook for managing connection requests in admin dashboard
 * @returns Object containing connection request query and mutation hooks
 */
export function useAdminRequests() {
  const connectionRequests = useConnectionRequestsQuery();
  const connectionRequestsMutation = useConnectionRequestsMutation();

  return {
    connectionRequests,
    connectionRequestsMutation,
    
    // Add these functions to fix the hook usage in admin.ts
    useConnectionRequests: () => connectionRequests,
    useUpdateConnectionRequest: () => connectionRequestsMutation
  };
}
