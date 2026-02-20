import { useListings, useListing, useListingMetadata } from './marketplace/use-listings';
import { useRequestConnection, useConnectionStatus, useUserConnectionRequests, useAllConnectionStatuses } from './marketplace/use-connections';
import { useSaveListingMutation, useSavedStatus, useAllSavedListingIds } from './marketplace/use-saved-listings';
import { useSavedListings } from './marketplace/use-saved-listings-query';
import { useUpdateConnectionMessage } from './marketplace/use-update-connection-message';
import { useRealtimeListings } from './use-realtime-listings';
import { useRealtimeConnections } from './use-realtime-connections';
import { useRealtimeAdmin } from './use-realtime-admin';

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
    useUpdateConnectionMessage,
    useRealtimeListings,
    useRealtimeConnections,
    useRealtimeAdmin,
    useAllSavedListingIds,
    useAllConnectionStatuses,
  };
}
