
import { useListingsQuery } from './listings/use-listings-query';
import { useListingMutations } from './listings/use-listing-mutations';

/**
 * Hook for managing listings in admin dashboard
 * @returns Object containing listing query and mutation hooks
 */
export function useAdminListings() {
  const { data: listings, isLoading, error, refetch } = useListingsQuery();
  const { 
    createListing, 
    updateListing, 
    deleteListing,
    toggleListingStatus
  } = useListingMutations();

  return {
    useListings: () => ({ data: listings, isLoading, error, refetch }),
    useCreateListing: () => createListing,
    useUpdateListing: () => updateListing,
    useDeleteListing: () => deleteListing,
    useToggleListingStatus: () => toggleListingStatus,
  };
}
