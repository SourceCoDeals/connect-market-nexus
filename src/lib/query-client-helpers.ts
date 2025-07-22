
import { QueryClient } from '@tanstack/react-query';

// Ultra-simple query invalidation helpers
export const invalidateListings = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['listings'] });
};

export const invalidateSavedListings = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['saved-listings'] });
};

export const invalidateConnectionRequests = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
  queryClient.invalidateQueries({ queryKey: ['user-connection-requests'] });
  queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
};

export const invalidateUserProfile = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['user-profile'] });
};

export const invalidateAdminData = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
  queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
};
