
import { useCreateListing } from './use-create-listing';
import { useRobustListingCreation } from './use-robust-listing-creation';
import { useUpdateListing } from './use-update-listing';
import { useDeleteListing } from './use-delete-listing';
import { useToggleListingStatus } from './use-toggle-listing-status';

/**
 * Hook for all listing mutations in admin dashboard
 * Uses the robust listing creation system
 */
export function useListingMutations() {
  return {
    useCreateListing: useRobustListingCreation, // Use robust version
    useCreateListingLegacy: useCreateListing, // Keep legacy for fallback
    useUpdateListing,
    useDeleteListing,
    useToggleListingStatus
  };
}
