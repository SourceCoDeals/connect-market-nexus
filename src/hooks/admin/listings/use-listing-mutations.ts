
import { useCreateListing } from './use-create-listing';
import { useUpdateListing } from './use-update-listing';
import { useDeleteListing } from './use-delete-listing';
import { useToggleListingStatus } from './use-toggle-listing-status';

/**
 * Hook for managing listing mutations in the admin dashboard
 * @returns Object containing all listing mutation hooks
 */
export function useListingMutations() {
  const createListing = useCreateListing();
  const updateListing = useUpdateListing();
  const deleteListing = useDeleteListing();
  const toggleListingStatus = useToggleListingStatus();

  return {
    createListing,
    updateListing,
    deleteListing,
    toggleListingStatus
  };
}
