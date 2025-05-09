
import { useConnectionRequestsQuery } from './requests/use-connection-requests-query';
import { useConnectionRequestsMutation } from './requests/use-connection-requests-mutation';

/**
 * Hook for managing connection requests in admin dashboard
 */
export function useAdminRequests() {
  const useConnectionRequests = useConnectionRequestsQuery;
  const useUpdateConnectionRequest = useConnectionRequestsMutation;

  return {
    useConnectionRequests,
    useUpdateConnectionRequest,
  };
}
