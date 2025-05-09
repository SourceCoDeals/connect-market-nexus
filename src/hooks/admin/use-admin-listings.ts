
import { useListingsQuery } from './listings/use-listings-query';
import { useListingMutations } from './listings/use-listing-mutations';

/**
 * Hook for managing listings in admin dashboard
 */
export function useAdminListings() {
  const useListings = useListingsQuery;
  const { 
    useCreateListing, 
    useUpdateListing, 
    useDeleteListing,
    useToggleListingStatus
  } = useListingMutations();

  return {
    useListings,
    useCreateListing,
    useUpdateListing,
    useDeleteListing,
    useToggleListingStatus,
  };
}
