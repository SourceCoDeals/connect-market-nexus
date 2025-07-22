
/**
 * Navigation Protection Hook (Phase 5)
 * 
 * Simplified navigation protection using only nuclear auth approach.
 */

import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { navigationStateManager } from '@/lib/navigation-state-manager';

export function useNavigationProtection() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isNavigating, setIsNavigating] = useState(false);
  const [overallLoading, setOverallLoading] = useState(false);

  useEffect(() => {
    // Initialize navigation manager
    navigationStateManager.initialize(queryClient);

    // Subscribe to loading state changes
    const unsubscribeLoading = navigationStateManager.subscribeToLoadingState(
      (loading) => {
        setOverallLoading(loading);
        setIsNavigating(navigationStateManager.getState().isNavigating);
      }
    );

    return unsubscribeLoading;
  }, [queryClient]);

  // Update current route when location changes
  useEffect(() => {
    const updateRoute = async () => {
      const success = await navigationStateManager.setCurrentRoute(location.pathname);
      if (!success) {
        console.log('⚠️ Navigation was blocked or delayed');
      }
    };

    updateRoute();
  }, [location.pathname]);

  // Safe navigation function
  const safeNavigate = useCallback(async (to: string, options?: any) => {
    console.log(`🧭 Safe navigation requested: ${location.pathname} → ${to}`);
    
    setIsNavigating(true);
    
    try {
      // Wait for queries to settle
      const settled = await navigationStateManager.waitForQueriesSettled(3000);
      
      if (settled) {
        console.log(`✅ Safe navigation proceeding: ${to}`);
        navigate(to, options);
      } else {
        console.log(`⏰ Safe navigation timeout: ${to}`);
        // Navigate anyway after timeout
        navigate(to, options);
      }
    } catch (error) {
      console.error('❌ Safe navigation error:', error);
      // Fallback to normal navigation
      navigate(to, options);
    } finally {
      setIsNavigating(false);
    }
  }, [location.pathname, navigate]);

  // Navigation guard management
  const addNavigationGuard = useCallback((guard: (to: string, from: string) => boolean | Promise<boolean>) => {
    return navigationStateManager.addNavigationGuard(guard);
  }, []);

  // Loading state management
  const setLoadingState = useCallback((context: string, loading: boolean) => {
    navigationStateManager.setLoadingState(context, loading);
  }, []);

  const getLoadingState = useCallback((context: string) => {
    return navigationStateManager.getLoadingState(context);
  }, []);

  const clearLoadingState = useCallback((context: string) => {
    navigationStateManager.clearLoadingState(context);
  }, []);

  // Wait for all queries to settle
  const waitForQueries = useCallback(async (timeout?: number) => {
    return await navigationStateManager.waitForQueriesSettled(timeout);
  }, []);

  return {
    // Navigation state
    isNavigating,
    overallLoading,
    currentRoute: location.pathname,
    
    // Safe navigation
    safeNavigate,
    
    // Navigation guards
    addNavigationGuard,
    
    // Loading state management
    setLoadingState,
    getLoadingState,
    clearLoadingState,
    
    // Query management
    waitForQueries,
    
    // State access
    getNavigationState: () => navigationStateManager.getState()
  };
}
