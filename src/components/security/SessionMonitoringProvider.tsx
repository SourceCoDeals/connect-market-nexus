
import React, { createContext, useContext } from 'react';
import { useSessionMonitoring } from '@/hooks/security/use-session-monitoring';

interface SessionMonitoringContextType {
  isValidating: boolean;
  sessionValid: boolean;
  anomalies: string[];
  riskScore: number;
  concurrentSessions: number;
  maxAllowedSessions: number;
  invalidateOldSessions: () => Promise<void>;
}

const SessionMonitoringContext = createContext<SessionMonitoringContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useSessionMonitoringContext = () => {
  const context = useContext(SessionMonitoringContext);
  if (context === undefined) {
    throw new Error('useSessionMonitoringContext must be used within a SessionMonitoringProvider');
  }
  return context;
};

interface SessionMonitoringProviderProps {
  children: React.ReactNode;
}

export const SessionMonitoringProvider: React.FC<SessionMonitoringProviderProps> = ({ children }) => {
  const sessionMonitoring = useSessionMonitoring();

  return (
    <SessionMonitoringContext.Provider value={sessionMonitoring}>
      {children}
    </SessionMonitoringContext.Provider>
  );
};
