import { useState, useCallback } from "react";

export type DialerEntityType = "buyer_contacts" | "buyers" | "listings" | "leads";

interface PushToDialerState {
  open: boolean;
  entityType: DialerEntityType;
  entityIds: string[];
}

/**
 * Universal hook to manage Push to Dialer modal state.
 * Works with any entity type — the edge function resolves contacts server-side.
 */
export function usePushToDialer() {
  const [state, setState] = useState<PushToDialerState>({
    open: false,
    entityType: "buyers",
    entityIds: [],
  });

  const openDialer = useCallback(
    (entityType: DialerEntityType, entityIds: string[]) => {
      setState({ open: true, entityType, entityIds });
    },
    [],
  );

  const closeDialer = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    dialerOpen: state.open,
    dialerEntityType: state.entityType,
    dialerEntityIds: state.entityIds,
    dialerEntityCount: state.entityIds.length,
    openDialer,
    closeDialer,
  };
}
