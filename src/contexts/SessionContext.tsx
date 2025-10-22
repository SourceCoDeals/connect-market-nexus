import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUTMParams, UTMParams } from '@/hooks/use-utm-params';

interface SessionContextValue {
  sessionId: string;
  utmParams: UTMParams;
  referrer: string | null;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const utmParams = useUTMParams();
  const [sessionId] = useState(() => {
    let id = sessionStorage.getItem('session_id');
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem('session_id', id);
    }
    return id;
  });
  
  const [referrer] = useState(() => document.referrer || null);

  const value: SessionContextValue = {
    sessionId,
    utmParams,
    referrer,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionContextProvider');
  }
  return context;
};
