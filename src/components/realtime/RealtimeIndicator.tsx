
import { useRealtime } from './RealtimeProvider';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

export function RealtimeIndicator() {
  const { listingsConnected, connectionsConnected, adminConnected } = useRealtime();
  
  const isConnected = listingsConnected || connectionsConnected || adminConnected;
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Badge 
        variant={isConnected ? "default" : "secondary"}
        className={`flex items-center gap-2 ${
          isConnected 
            ? "bg-green-100 text-green-800 border-green-200" 
            : "bg-gray-100 text-gray-600 border-gray-200"
        }`}
      >
        {isConnected ? (
          <>
            <Wifi className="h-3 w-3" />
            Live
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Offline
          </>
        )}
      </Badge>
    </div>
  );
}
