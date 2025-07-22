
/**
 * Centralized Auth State Manager
 * 
 * Prevents race conditions and manages auth state synchronization.
 * This is used by enhanced auth hooks to provide stable state management.
 */

import { User } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { createUserObject, cleanupAuthState } from "@/lib/auth-helpers";
import { tabVisibilityManager } from "@/lib/tab-visibility-manager";

type AuthStateListener = (user: User | null, isLoading: boolean) => void;

class AuthStateManager {
  private user: User | null = null;
  private isLoading: boolean = true;
  private authChecked: boolean = false;
  private listeners: Set<AuthStateListener> = new Set();
  private initializationPromise: Promise<void> | null = null;
  private authSubscription: any = null;
  private isDestroyed: boolean = false;
  private tabVisibilitySubscription: (() => void) | null = null;

  // Debounced state update to prevent race conditions
  private updateStateDebounce: NodeJS.Timeout | null = null;
  private pendingUserUpdate: User | null = null;
  private pendingLoadingUpdate: boolean | null = null;

  // Tab switching stability - more permissive for login flows
  private lastAuthCheckTime: number = 0;
  private stableAuthGracePeriod: number = 2000; // Reduced to 2 seconds for better UX
  private isActiveAuthFlow: boolean = false; // Track active login/signup flows

  constructor() {
    this.initialize();
    this.setupTabVisibilityHandling();
  }

  /**
   * Mark that an active auth flow is in progress
   */
  setActiveAuthFlow(isActive: boolean) {
    this.isActiveAuthFlow = isActive;
    console.log('🔄 AuthStateManager: Active auth flow:', isActive);
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener(this.user, this.isLoading);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current auth state with stability check
   */
  getState() {
    // During active auth flows, use real-time state
    if (this.isActiveAuthFlow) {
      return {
        user: this.user,
        isLoading: this.isLoading,
        authChecked: this.authChecked,
        isAdmin: this.user?.is_admin === true,
        isBuyer: this.user?.role === "buyer"
      };
    }

    // For cached auth state during tab switches
    const cachedUser = this.getCachedAuthState();
    const timeSinceLastCheck = Date.now() - this.lastAuthCheckTime;
    const isStableAuthPeriod = timeSinceLastCheck < this.stableAuthGracePeriod;
    
    return {
      user: cachedUser || this.user,
      isLoading: this.isLoading,
      authChecked: true, // Always consider auth as checked during stable periods to prevent query disabling
      isAdmin: (cachedUser || this.user)?.is_admin === true,
      isBuyer: (cachedUser || this.user)?.role === "buyer"
    };
  }

  /**
   * Get cached auth state from localStorage for stability
   */
  private getCachedAuthState(): User | null {
    try {
      const cached = localStorage.getItem("user");
      if (cached) {
        const userData = JSON.parse(cached);
        // Only use cached data if it's recent (within 5 minutes)
        const cacheTime = userData._cacheTime || 0;
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (cacheTime > fiveMinutesAgo) {
          return userData;
        }
      }
    } catch (error) {
      console.error('❌ AuthStateManager: Error reading cached auth state:', error);
    }
    return null;
  }

  /**
   * Force refresh user data
   */
  async refreshUserData(userId?: string): Promise<User | null> {
    const targetUserId = userId || this.user?.id;
    if (!targetUserId) return null;

    // During active auth flows, always refresh
    // During tab visibility changes, be more selective
    if (!this.isActiveAuthFlow && !tabVisibilityManager.getVisibility() && tabVisibilityManager.isRecentlyVisible(5000)) {
      console.log('⏸️ AuthStateManager: Skipping refresh during recent tab switch');
      return this.user;
    }

    try {
      console.log('🔄 AuthStateManager: Refreshing user data for:', targetUserId);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error || !profileData) {
        console.error('❌ AuthStateManager: Error fetching profile:', error);
        return null;
      }

      const userData = createUserObject(profileData);
      this.updateState(userData, false);
      this.syncToLocalStorage(userData);
      this.lastAuthCheckTime = Date.now();
      
      console.log('✅ AuthStateManager: User data refreshed');
      return userData;
    } catch (error) {
      console.error('❌ AuthStateManager: Refresh error:', error);
      return null;
    }
  }

  /**
   * Clear all auth state
   */
  async clearAuthState(): Promise<void> {
    console.log('🧹 AuthStateManager: Clearing auth state');
    this.isActiveAuthFlow = false; // Reset auth flow state
    
    try {
      await cleanupAuthState();
      this.updateState(null, false);
      this.authChecked = true;
      this.lastAuthCheckTime = Date.now();
      
      console.log('✅ AuthStateManager: Auth state cleared');
    } catch (error) {
      console.error('❌ AuthStateManager: Clear error:', error);
    }
  }

  /**
   * Initialize auth state manager
   */
  private async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log('🚀 AuthStateManager: Initializing...');

      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ AuthStateManager: Session error:', error);
        await this.clearAuthState();
        return;
      }

      if (session?.user && !this.isDestroyed) {
        console.log('🔍 AuthStateManager: Loading user from session:', session.user.email);
        await this.loadUserData(session.user.id);
      } else {
        console.log('❌ AuthStateManager: No session found');
        this.updateState(null, false);
      }

      this.setupAuthListener();
      
      console.log('✅ AuthStateManager: Initialization complete');
    } catch (error) {
      console.error('❌ AuthStateManager: Initialization error:', error);
      await this.clearAuthState();
    } finally {
      this.authChecked = true;
      this.lastAuthCheckTime = Date.now();
      this.updateState(this.user, false);
    }
  }

  private setupTabVisibilityHandling(): void {
    this.tabVisibilitySubscription = tabVisibilityManager.subscribe((isVisible) => {
      if (isVisible && !this.isActiveAuthFlow) {
        // Only refresh auth if tab was hidden for a very long time and we have a user
        const timeSinceHidden = tabVisibilityManager.getTimeSinceLastVisibilityChange();
        
        if (this.user && timeSinceHidden > 300000) { // 5 minutes instead of 2
          console.log('👁️ AuthStateManager: Tab visible after very long time, checking auth state');
          setTimeout(() => {
            this.refreshUserData(this.user?.id);
          }, 2000); // Even longer delay
        } else {
          console.log('👁️ AuthStateManager: Tab visible, auth state stable (no refresh needed)');
        }
      }
    });
  }

  private setupAuthListener(): void {
    if (this.authSubscription || this.isDestroyed) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (this.isDestroyed) return;

        console.log('🔔 AuthStateManager: Auth event:', event);
        
        // During active auth flows, process all events immediately
        if (this.isActiveAuthFlow) {
          console.log('🔄 AuthStateManager: Processing auth event during active flow');
        } else {
          // Skip certain auth events during tab switches to prevent instability
          if (!tabVisibilityManager.getVisibility() && event === 'TOKEN_REFRESHED') {
            console.log('⏸️ AuthStateManager: Skipping TOKEN_REFRESHED while tab hidden');
            return;
          }
          
          // Add stability check for frequent auth events (but not during active flows)
          const timeSinceLastCheck = Date.now() - this.lastAuthCheckTime;
          if (timeSinceLastCheck < 500 && (event === 'TOKEN_REFRESHED')) {
            console.log('⏸️ AuthStateManager: Skipping rapid auth event:', event);
            return;
          }
        }
        
        switch (event) {
          case 'SIGNED_OUT':
            this.isActiveAuthFlow = false;
            this.updateState(null, false);
            localStorage.removeItem("user");
            this.lastAuthCheckTime = Date.now();
            break;
            
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            if (session?.user) {
              console.log(`🔐 AuthStateManager: ${event} for:`, session.user.email);
              await this.loadUserData(session.user.id);
              this.lastAuthCheckTime = Date.now();
              
              // Mark auth flow as complete after successful sign in
              if (event === 'SIGNED_IN') {
                this.isActiveAuthFlow = false;
              }
            }
            break;
        }
      }
    );

    this.authSubscription = subscription;
  }

  private async loadUserData(userId: string): Promise<void> {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !profileData || this.isDestroyed) {
        console.error('❌ AuthStateManager: Profile fetch error:', error);
        return;
      }

      const userData = createUserObject(profileData);
      this.updateState(userData, false);
      this.syncToLocalStorage(userData);
    } catch (error) {
      console.error('❌ AuthStateManager: Load user error:', error);
    }
  }

  private updateState(user: User | null, isLoading: boolean): void {
    // Debounce state updates to prevent race conditions
    this.pendingUserUpdate = user;
    this.pendingLoadingUpdate = isLoading;
    
    if (this.updateStateDebounce) {
      clearTimeout(this.updateStateDebounce);
    }
    
    this.updateStateDebounce = setTimeout(() => {
      if (this.isDestroyed) return;
      
      const hasChanged = 
        this.user !== this.pendingUserUpdate || 
        this.isLoading !== this.pendingLoadingUpdate;
      
      if (hasChanged) {
        this.user = this.pendingUserUpdate;
        this.isLoading = this.pendingLoadingUpdate!;
        
        // Notify all listeners
        this.listeners.forEach(listener => {
          try {
            listener(this.user, this.isLoading);
          } catch (error) {
            console.error('❌ AuthStateManager: Listener error:', error);
          }
        });
      }
      
      this.updateStateDebounce = null;
    }, 25); // Reduced debounce time for better UX during auth flows
  }

  private syncToLocalStorage(userData: User | null): void {
    try {
      if (userData) {
        // Add cache timestamp for freshness check
        const cachedData = {
          ...userData,
          _cacheTime: Date.now()
        };
        localStorage.setItem("user", JSON.stringify(cachedData));
      } else {
        localStorage.removeItem("user");
      }
    } catch (error) {
      console.error('❌ AuthStateManager: localStorage sync error:', error);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.isDestroyed = true;
    this.isActiveAuthFlow = false;
    this.listeners.clear();
    
    if (this.updateStateDebounce) {
      clearTimeout(this.updateStateDebounce);
      this.updateStateDebounce = null;
    }
    
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }

    if (this.tabVisibilitySubscription) {
      this.tabVisibilitySubscription();
      this.tabVisibilitySubscription = null;
    }
  }
}

// Create singleton instance
const authStateManager = new AuthStateManager();

export { authStateManager };
