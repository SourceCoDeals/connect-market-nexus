
import { useConnectionRequestsQuery } from './requests/use-connection-requests-query';
import { useConnectionRequestsMutation as useRequestsMutation } from './requests/use-connection-requests-mutation';

/**
 * Hook for managing connection requests in admin dashboard
 */
export function useAdminRequests() {
  const useConnectionRequests = useConnectionRequestsQuery;
  
  // Create the connection request mutation hook
  const useConnectionRequestsMutation = () => {
    const mutation = useRequestsMutation();
    
    const approveRequest = (requestId: string, comment?: string) => {
      return mutation.mutate({
        requestId,
        status: 'approved',
        adminComment: comment
      });
    };
    
    const rejectRequest = (requestId: string, comment?: string) => {
      return mutation.mutate({
        requestId,
        status: 'rejected',
        adminComment: comment
      });
    };
    
    return {
      ...mutation,
      approveRequest,
      rejectRequest
    };
  };

  return {
    useConnectionRequests,
    useConnectionRequestsMutation,
  };
}
