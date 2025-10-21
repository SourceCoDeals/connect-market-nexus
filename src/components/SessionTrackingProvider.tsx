import { useInitialSessionTracking } from '@/hooks/use-initial-session-tracking';

interface SessionTrackingProviderProps {
  children: React.ReactNode;
}

/**
 * SessionTrackingProvider - Tracks initial user session data
 * 
 * This component automatically captures and stores first-time visitor data including:
 * - Browser, device, and platform information
 * - Landing page and referrer
 * - UTM parameters for marketing attribution
 * - Session ID for tracking user journeys
 * 
 * The data is sent to the track-initial-session edge function which:
 * 1. Parses the User-Agent string
 * 2. Extracts marketing channel information
 * 3. Stores everything in the user_initial_session table
 * 
 * This only runs ONCE per user (first visit after authentication)
 */
const SessionTrackingProvider = ({ children }: SessionTrackingProviderProps) => {
  useInitialSessionTracking();
  
  return <>{children}</>;
};

export default SessionTrackingProvider;
