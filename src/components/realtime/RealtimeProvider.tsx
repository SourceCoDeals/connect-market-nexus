
import { createContext, useContext, ReactNode } from 'react';
import { useRealtimeListings } from '@/hooks/use-realtime-listings';
import { useRealtimeConnections } from '@/hooks/use-realtime-connections';
import { useRealtimeAdmin } from '@/hooks/use-realtime-admin';

interface RealtimeContextType {
  listingsConnected: boolean;
  connectionsConnected: boolean;
  adminConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType>({
  listingsConnected: false,
  connectionsConnected: false,
  adminConnected: false,
});

export const useRealtime = () => useContext(RealtimeContext);

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const { isConnected: listingsConnected } = useRealtimeListings();
  const { isConnected: connectionsConnected } = useRealtimeConnections();
  const { isConnected: adminConnected } = useRealtimeAdmin();

  return (
    <RealtimeContext.Provider 
      value={{ 
        listingsConnected, 
        connectionsConnected, 
        adminConnected 
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}
