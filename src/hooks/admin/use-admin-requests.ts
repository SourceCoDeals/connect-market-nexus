
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

  // Create proper hook functions to be used by AdminRequests.tsx
  const useConnectionRequests = () => connectionRequests;
  const useUpdateConnectionRequest = () => connectionRequestsMutation;

  return {
    connectionRequests,
    connectionRequestsMutation,
    
    // Export the hook functions
    useConnectionRequests,
    useUpdateConnectionRequest
  };
}
