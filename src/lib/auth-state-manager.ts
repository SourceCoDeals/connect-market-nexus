
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

  constructor() {
    this.initialize();
    this.setupTabVisibilityHandling();
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
   * Get current auth state
   */
  getState() {
    return {
      user: this.user,
      isLoading: this.isLoading,
      authChecked: this.authChecked,
      isAdmin: this.user?.is_admin === true,
      isBuyer: this.user?.role === "buyer"
    };
  }

  /**
   * Force refresh user data
   */
  async refreshUserData(userId?: string): Promise<User | null> {
    const targetUserId = userId || this.user?.id;
    if (!targetUserId) return null;

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
    
    try {
      await cleanupAuthState();
      this.updateState(null, false);
      this.authChecked = true;
      
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

      // First check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ AuthStateManager: Session error:', error);
        await this.clearAuthState();
        return;
      }

      // Load user data if session exists
      if (session?.user && !this.isDestroyed) {
        console.log('🔍 AuthStateManager: Loading user from session:', session.user.email);
        await this.loadUserData(session.user.id);
      } else {
        console.log('❌ AuthStateManager: No session found');
        this.updateState(null, false);
      }

      // Set up auth state listener
      this.setupAuthListener();
      
      console.log('✅ AuthStateManager: Initialization complete');
    } catch (error) {
      console.error('❌ AuthStateManager: Initialization error:', error);
      await this.clearAuthState();
    } finally {
      this.authChecked = true;
      this.updateState(this.user, false); // Ensure loading is false
    }
  }

  private setupTabVisibilityHandling(): void {
    this.tabVisibilitySubscription = tabVisibilityManager.subscribe((isVisible) => {
      if (isVisible && tabVisibilityManager.isRecentlyVisible(2000)) {
        console.log('👁️ AuthStateManager: Tab became visible, checking auth state');
        
        // Only refresh if we have a user and tab was hidden for a while
        if (this.user && tabVisibilityManager.getTimeSinceLastVisibilityChange() > 30000) {
          console.log('🔄 AuthStateManager: Refreshing auth state after long tab hide');
          this.refreshUserData(this.user.id);
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
        
        // Skip auth events when tab is not visible to prevent race conditions
        if (!tabVisibilityManager.getVisibility() && event === 'TOKEN_REFRESHED') {
          console.log('⏸️ AuthStateManager: Skipping auth event while tab hidden');
          return;
        }
        
        switch (event) {
          case 'SIGNED_OUT':
            this.updateState(null, false);
            localStorage.removeItem("user");
            break;
            
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            if (session?.user) {
              console.log(`🔐 AuthStateManager: ${event} for:`, session.user.email);
              await this.loadUserData(session.user.id);
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
    }, 0);
  }

  private syncToLocalStorage(userData: User | null): void {
    try {
      if (userData) {
        localStorage.setItem("user", JSON.stringify(userData));
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
