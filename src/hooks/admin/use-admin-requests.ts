
import { useConnectionRequestsQuery } from './requests/use-connection-requests-query';
import { useConnectionRequestsMutation } from './requests/use-connection-requests-mutation';

/**
 * Hook for managing connection requests in admin dashboard
 * @returns Object containing connection request query and mutation hooks
 */
export function useAdminRequests() {
  const connectionRequests = useConnectionRequestsQuery();
  const connectionRequestsMutation = useConnectionRequestsMutation();

  return {
    connectionRequests,
    connectionRequestsMutation
  };
}
