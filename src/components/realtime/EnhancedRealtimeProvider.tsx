/**
 * Enhanced Realtime Provider (Phases 4 & 5)
 * 
 * Combines enhanced real-time management with navigation protection.
 */

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useEnhancedRealtimeConnections } from '@/hooks/realtime/use-enhanced-realtime-connections';
import { useEnhancedRealtimeAdmin } from '@/hooks/realtime/use-enhanced-realtime-admin';
import { useRealtimeListings } from '@/hooks/use-realtime-listings'; // Keep existing for listings
import { useNavigationProtection } from '@/hooks/navigation/use-navigation-protection';

interface EnhancedRealtimeContextType {
  // Connection statuses
  listingsConnected: boolean;
  connectionsConnected: boolean;
  adminConnected: boolean;
  
  // Navigation protection
  isNavigating: boolean;
  overallLoading: boolean;
  safeNavigate: (to: string, options?: any) => Promise<void>;
  
  // Enhanced features
  getAllConnectionStatuses: () => Record<string, boolean>;
  addNavigationGuard: (guard: (to: string, from: string) => boolean | Promise<boolean>) => () => void;
  setLoadingState: (context: string, loading: boolean) => void;
}

const EnhancedRealtimeContext = createContext<EnhancedRealtimeContextType>({
  listingsConnected: false,
  connectionsConnected: false,
  adminConnected: false,
  isNavigating: false,
  overallLoading: false,
  safeNavigate: async () => {},
  getAllConnectionStatuses: () => ({}),
  addNavigationGuard: () => () => {},
  setLoadingState: () => {},
});

export const useEnhancedRealtime = () => useContext(EnhancedRealtimeContext);

interface EnhancedRealtimeProviderProps {
  children: ReactNode;
}

export function EnhancedRealtimeProvider({ children }: EnhancedRealtimeProviderProps) {
  // Use enhanced hooks for connections and admin
  const { isConnected: listingsConnected } = useRealtimeListings(); // Keep existing
  const { 
    isConnected: connectionsConnected, 
    getAllStatuses: getConnectionStatuses 
  } = useEnhancedRealtimeConnections();
  const { 
    isConnected: adminConnected, 
    getAllStatuses: getAdminStatuses 
  } = useEnhancedRealtimeAdmin();

  // Use navigation protection
  const {
    isNavigating,
    overallLoading,
    safeNavigate,
    addNavigationGuard,
    setLoadingState
  } = useNavigationProtection();

  // Combined status tracking
  const getAllConnectionStatuses = () => {
    return {
      listings: listingsConnected,
      ...getConnectionStatuses(),
      ...getAdminStatuses(),
    };
  };

  const value: EnhancedRealtimeContextType = {
    // Basic connection statuses
    listingsConnected,
    connectionsConnected,
    adminConnected,
    
    // Navigation protection
    isNavigating,
    overallLoading,
    safeNavigate,
    
    // Enhanced features
    getAllConnectionStatuses,
    addNavigationGuard,
    setLoadingState,
  };

  return (
    <EnhancedRealtimeContext.Provider value={value}>
      {children}
    </EnhancedRealtimeContext.Provider>
  );
}