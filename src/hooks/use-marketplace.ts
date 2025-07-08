
import { useListings, useListing, useListingMetadata } from './marketplace/use-listings';
import { useRequestConnection, useConnectionStatus, useUserConnectionRequests } from './marketplace/use-connections';
import { useSaveListingMutation, useSavedStatus } from './marketplace/use-saved-listings';
import { useSavedListings } from './marketplace/use-saved-listings-query';

export function useMarketplace() {
  return {
    useListings,
    useListing,
    useListingMetadata,
    useRequestConnection,
    useConnectionStatus,
    useSaveListingMutation,
    useSavedStatus,
    useSavedListings,
    useUserConnectionRequests,
  };
}
