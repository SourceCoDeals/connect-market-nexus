/**
 * Enhanced Auth State Hook
 * 
 * Uses the AuthStateManager for stable, race-condition-free auth state.
 * This is a safer replacement for useFreshAuthState.
 */

import { useState, useEffect } from 'react';
import { User } from '@/types';
import { authStateManager } from '@/lib/auth-state-manager';

export function useEnhancedAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Get initial state
    const initialState = authStateManager.getState();
    setUser(initialState.user);
    setIsLoading(initialState.isLoading);
    setAuthChecked(initialState.authChecked);

    // Subscribe to state changes
    const unsubscribe = authStateManager.subscribe((newUser, newIsLoading) => {
      setUser(newUser);
      setIsLoading(newIsLoading);
      setAuthChecked(true); // Auth is always checked after first update
    });

    return unsubscribe;
  }, []);

  // Wrapper functions for manager methods
  const refreshUserData = async (userId?: string) => {
    return await authStateManager.refreshUserData(userId);
  };

  const clearAuthState = async () => {
    await authStateManager.clearAuthState();
  };

  return {
    user,
    isLoading,
    authChecked,
    isAdmin: user?.is_admin === true,
    isBuyer: user?.role === "buyer",
    refreshUserData,
    clearAuthState
  };
}