import { useInitialSessionTracking } from '@/hooks/use-initial-session-tracking';
import { SessionContextProvider } from '@/contexts/SessionContext';
import { HeartbeatProvider } from '@/components/HeartbeatProvider';
import { PageEngagementTracker } from '@/components/PageEngagementTracker';

interface SessionTrackingProviderProps {
  children: React.ReactNode;
}

/**
 * SessionTrackingProvider - Comprehensive session and engagement tracking
 * 
 * This component provides:
 * 1. Session context with UTM parameters and referrer data
 * 2. Initial session tracking (first-time visitor data with IP geolocation)
 * 3. Session heartbeat for accurate duration tracking
 * 4. Page engagement tracking (scroll depth, time on page)
 * 
 * Session data includes:
 * - Browser, device, and platform information
 * - Landing page and referrer
 * - UTM parameters for marketing attribution
 * - Session ID for tracking user journeys
 * - Geographic data (country, city, region, timezone)
 * - Session duration and activity status
 */
const SessionTracker = ({ children }: { children: React.ReactNode }) => {
  useInitialSessionTracking();
  return <>{children}</>;
};

const SessionTrackingProvider = ({ children }: SessionTrackingProviderProps) => {
  return (
    <SessionContextProvider>
      <SessionTracker>
        <HeartbeatProvider>
          <PageEngagementTracker>
            {children}
          </PageEngagementTracker>
        </HeartbeatProvider>
      </SessionTracker>
    </SessionContextProvider>
  );
};

export default SessionTrackingProvider;
