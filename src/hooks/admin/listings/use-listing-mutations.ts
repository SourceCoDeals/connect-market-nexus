
import { useCreateListing } from './use-create-listing';
import { useUpdateListing } from './use-update-listing';
import { useDeleteListing } from './use-delete-listing';
import { useToggleListingStatus } from './use-toggle-listing-status';

export function useListingMutations() {
  return {
    useCreateListing,
    useUpdateListing,
    useDeleteListing,
    useToggleListingStatus,
  };
}
