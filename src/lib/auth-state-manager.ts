// PHASE 3: Enhanced Auth State Management
// This provides race condition protection and session synchronization

import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { createUserObject, cleanupAuthState } from '@/lib/auth-helpers';

// State synchronization locks to prevent race conditions
const authOperationLocks = {
  sessionCheck: false,
  userDataRefresh: false,
  authStateChange: false,
};

// Debounce timer for auth operations
let authOperationDebounceTimer: NodeJS.Timeout | null = null;

// Session validation cache to prevent excessive checks
let lastSessionValidation: { timestamp: number; isValid: boolean; sessionId?: string } = {
  timestamp: 0,
  isValid: false,
};

const SESSION_VALIDATION_CACHE_TTL = 5000; // 5 seconds

/**
 * PHASE 3: Safe session validation with caching
 * Prevents excessive session checks and validates localStorage consistency
 */
export const validateSession = async (): Promise<{
  isValid: boolean;
  session: any | null;
  needsRefresh: boolean;
}> => {
  const now = Date.now();
  
  // Return cached result if still valid
  if (now - lastSessionValidation.timestamp < SESSION_VALIDATION_CACHE_TTL) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return {
        isValid: lastSessionValidation.isValid,
        session,
        needsRefresh: false
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return { isValid: false, session: null, needsRefresh: true };
    }
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session validation error:', error);
      lastSessionValidation = { timestamp: now, isValid: false };
      return { isValid: false, session: null, needsRefresh: true };
    }

    const isValid = !!session?.user;
    const sessionId = session?.access_token?.slice(0, 10) || '';
    
    // Check if session has changed
    const needsRefresh = lastSessionValidation.sessionId !== sessionId;
    
    lastSessionValidation = { 
      timestamp: now, 
      isValid, 
      sessionId 
    };
    
    return { isValid, session, needsRefresh };
  } catch (error) {
    console.error('Session validation failed:', error);
    lastSessionValidation = { timestamp: now, isValid: false };
    return { isValid: false, session: null, needsRefresh: true };
  }
};

/**
 * PHASE 3: Race-condition safe user data refresh
 * Uses locks to prevent simultaneous refresh operations
 */
export const safeRefreshUserData = async (userId: string, forceRefresh = false): Promise<User | null> => {
  // Prevent concurrent refresh operations
  if (authOperationLocks.userDataRefresh && !forceRefresh) {
    console.log('🔒 User data refresh already in progress, skipping...');
    return null;
  }

  authOperationLocks.userDataRefresh = true;

  try {
    console.log('🔄 Safe user data refresh for:', userId);
    
    // Validate session before proceeding
    const { isValid, session } = await validateSession();
    if (!isValid || session?.user?.id !== userId) {
      console.warn('❌ Session invalid during user data refresh');
      await cleanupAuthState();
      return null;
    }

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Error fetching profile data:', error);
      
      // If profile not found, might be a new user - don't clear auth completely
      if (error.code !== 'PGRST116') {
        await cleanupAuthState();
      }
      return null;
    }

    console.log('✅ Profile data refreshed:', {
      email: profileData.email,
      email_verified: profileData.email_verified,
      approval_status: profileData.approval_status,
      is_admin: profileData.is_admin
    });

    const userData = createUserObject(profileData);
    
    // Only update localStorage if session is still valid
    const { isValid: stillValid } = await validateSession();
    if (stillValid) {
      localStorage.setItem("user", JSON.stringify(userData));
      console.log('💾 User data cached in localStorage');
    } else {
      console.warn('⚠️ Session became invalid, not caching to localStorage');
    }
    
    return userData;
  } catch (error) {
    console.error('❌ Error in safeRefreshUserData:', error);
    return null;
  } finally {
    authOperationLocks.userDataRefresh = false;
  }
};

/**
 * PHASE 3: Debounced auth state synchronization
 * Prevents rapid-fire auth state changes from causing conflicts
 */
export const debouncedAuthSync = (callback: () => Promise<void>, delay = 300): void => {
  if (authOperationDebounceTimer) {
    clearTimeout(authOperationDebounceTimer);
  }

  authOperationDebounceTimer = setTimeout(async () => {
    try {
      await callback();
    } catch (error) {
      console.error('❌ Debounced auth sync error:', error);
    }
    authOperationDebounceTimer = null;
  }, delay);
};

/**
 * PHASE 3: Safe auth state cleanup
 * Ensures all auth-related state is properly cleared
 */
export const safeAuthCleanup = async (): Promise<void> => {
  console.log('🧹 Starting safe auth cleanup...');
  
  // Clear all operation locks
  Object.keys(authOperationLocks).forEach(key => {
    authOperationLocks[key as keyof typeof authOperationLocks] = false;
  });
  
  // Clear timers
  if (authOperationDebounceTimer) {
    clearTimeout(authOperationDebounceTimer);
    authOperationDebounceTimer = null;
  }
  
  // Clear validation cache
  lastSessionValidation = { timestamp: 0, isValid: false };
  
  // Cleanup auth state
  await cleanupAuthState();
  
  console.log('✅ Safe auth cleanup completed');
};

/**
 * PHASE 3: Auth state consistency checker
 * Validates that localStorage and session state are in sync
 */
export const checkAuthConsistency = async (): Promise<{
  isConsistent: boolean;
  action: 'none' | 'clear_localStorage' | 'refresh_user' | 'clear_all';
}> => {
  try {
    const { isValid, session } = await validateSession();
    const cachedUserStr = localStorage.getItem("user");
    
    // No session, no cached user - consistent
    if (!isValid && !cachedUserStr) {
      return { isConsistent: true, action: 'none' };
    }
    
    // Session exists but no cached user - needs refresh
    if (isValid && !cachedUserStr) {
      return { isConsistent: false, action: 'refresh_user' };
    }
    
    // No session but cached user exists - needs cleanup
    if (!isValid && cachedUserStr) {
      return { isConsistent: false, action: 'clear_localStorage' };
    }
    
    // Both exist - check if they match
    if (isValid && cachedUserStr) {
      try {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser.id !== session?.user?.id) {
          return { isConsistent: false, action: 'clear_all' };
        }
        return { isConsistent: true, action: 'none' };
      } catch {
        return { isConsistent: false, action: 'clear_localStorage' };
      }
    }
    
    return { isConsistent: true, action: 'none' };
  } catch (error) {
    console.error('Auth consistency check failed:', error);
    return { isConsistent: false, action: 'clear_all' };
  }
};