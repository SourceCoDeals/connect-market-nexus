/**
 * AI Command Center Provider
 * Wraps the app to provide the AI Command Center panel and UI action dispatch.
 * Pages register their context and UI action handlers through this provider.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AICommandCenterPanel } from './AICommandCenterPanel';
import type { PageContext, UIActionPayload } from '@/hooks/useAICommandCenter';
import { useDailyBriefingAutoLaunch } from '@/hooks/useDailyBriefingAutoLaunch';

// ---------- Context ----------

interface AICommandCenterContextValue {
  /** Set the current page context for intent routing */
  setPageContext: (ctx: PageContext) => void;
  /** Register a handler for UI actions (row selection, filters, navigation) */
  registerUIActionHandler: (handler: (action: UIActionPayload) => void) => void;
  /** Unregister the UI action handler */
  unregisterUIActionHandler: () => void;
}

const AICommandCenterContext = createContext<AICommandCenterContextValue | null>(null);

// ---------- Provider ----------

export function AICommandCenterProvider({ children }: { children: React.ReactNode }) {
  const [pageContext, setPageContext] = useState<PageContext>({});
  const uiActionHandlerRef = useRef<((action: UIActionPayload) => void) | null>(null);

  // Feature 4: Auto-launch daily briefing on first visit of the day
  useDailyBriefingAutoLaunch();

  const registerUIActionHandler = useCallback((handler: (action: UIActionPayload) => void) => {
    uiActionHandlerRef.current = handler;
  }, []);

  const unregisterUIActionHandler = useCallback(() => {
    uiActionHandlerRef.current = null;
  }, []);

  const handleUIAction = useCallback((action: UIActionPayload) => {
    // Forward to the registered page handler
    uiActionHandlerRef.current?.(action);
  }, []);

  return (
    <AICommandCenterContext.Provider
      value={{ setPageContext, registerUIActionHandler, unregisterUIActionHandler }}
    >
      {children}
      <AICommandCenterPanel pageContext={pageContext} onUIAction={handleUIAction} />
    </AICommandCenterContext.Provider>
  );
}

// ---------- Hook to use from pages ----------

export function useAICommandCenterContext() {
  const ctx = useContext(AICommandCenterContext);
  if (!ctx) {
    throw new Error('useAICommandCenterContext must be used within AICommandCenterProvider');
  }
  return ctx;
}
