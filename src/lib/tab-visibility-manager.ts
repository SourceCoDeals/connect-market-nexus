
/**
 * Tab Visibility Manager (Phase 6)
 * 
 * Manages tab visibility state and prevents infinite loading loops when switching tabs.
 * Coordinates with auth state and real-time managers for optimal performance.
 */

type VisibilityListener = (isVisible: boolean) => void;

class TabVisibilityManager {
  private isVisible: boolean = !document.hidden;
  private listeners: Set<VisibilityListener> = new Set();
  private lastVisibilityChange: number = Date.now();
  private pausedOperations: Set<string> = new Set();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Get current visibility state
   */
  getVisibility(): boolean {
    return this.isVisible;
  }

  /**
   * Subscribe to visibility changes
   */
  subscribe(listener: VisibilityListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener(this.isVisible);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Pause operations when tab is not visible
   */
  pauseOperation(operationId: string) {
    this.pausedOperations.add(operationId);
  }

  /**
   * Resume operations when tab becomes visible
   */
  resumeOperation(operationId: string) {
    this.pausedOperations.delete(operationId);
  }

  /**
   * Check if operation should be paused
   */
  shouldPauseOperation(operationId: string): boolean {
    return !this.isVisible || this.pausedOperations.has(operationId);
  }

  /**
   * Get time since last visibility change
   */
  getTimeSinceLastVisibilityChange(): number {
    return Date.now() - this.lastVisibilityChange;
  }

  /**
   * Check if tab was recently made visible (within threshold)
   */
  isRecentlyVisible(thresholdMs: number = 1000): boolean {
    return this.isVisible && this.getTimeSinceLastVisibilityChange() < thresholdMs;
  }

  private setupEventListeners() {
    const handleVisibilityChange = () => {
      const newVisibility = !document.hidden;
      
      if (newVisibility !== this.isVisible) {
        console.log(`👁️ Tab visibility changed: ${this.isVisible ? 'visible' : 'hidden'} → ${newVisibility ? 'visible' : 'hidden'}`);
        
        this.isVisible = newVisibility;
        this.lastVisibilityChange = Date.now();
        
        // Notify all listeners
        this.listeners.forEach(listener => {
          try {
            listener(this.isVisible);
          } catch (error) {
            console.error('❌ Tab visibility listener error:', error);
          }
        });

        // Clear paused operations when becoming visible
        if (this.isVisible) {
          this.pausedOperations.clear();
        }
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for focus/blur events as backup
    window.addEventListener('focus', () => {
      if (document.hidden === false && !this.isVisible) {
        handleVisibilityChange();
      }
    });

    window.addEventListener('blur', () => {
      if (!this.isVisible) return; // Already handled
      setTimeout(handleVisibilityChange, 100); // Small delay to check document.hidden
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.listeners.clear();
    this.pausedOperations.clear();
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.setupEventListeners);
    window.removeEventListener('focus', this.setupEventListeners);
    window.removeEventListener('blur', this.setupEventListeners);
  }
}

// Create singleton instance
export const tabVisibilityManager = new TabVisibilityManager();
