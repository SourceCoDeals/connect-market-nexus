import { useInitialSessionTracking } from '@/hooks/use-initial-session-tracking';
import { SessionContextProvider } from '@/contexts/SessionContext';

interface SessionTrackingProviderProps {
  children: React.ReactNode;
}

/**
 * SessionTrackingProvider - Tracks user session data and provides session context
 * 
 * This component provides:
 * 1. Session context with UTM parameters and referrer data
 * 2. Initial session tracking (first-time visitor data)
 * 
 * Session data includes:
 * - Browser, device, and platform information
 * - Landing page and referrer
 * - UTM parameters for marketing attribution
 * - Session ID for tracking user journeys
 * 
 * The initial session data is sent to the track-initial-session edge function which:
 * 1. Parses the User-Agent string
 * 2. Extracts marketing channel information
 * 3. Stores everything in the user_initial_session table (ONCE per user)
 */
const SessionTrackingProvider = ({ children }: SessionTrackingProviderProps) => {
  useInitialSessionTracking();
  
  return (
    <SessionContextProvider>
      {children}
    </SessionContextProvider>
  );
};

export default SessionTrackingProvider;
