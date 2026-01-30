import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionContext } from '@/contexts/SessionContext';

interface PageEngagementData {
  pageStartTime: number;
  maxScrollDepth: number;
  focusTime: number;
  lastFocusStart: number | null;
  isFocused: boolean;
  clickCount: number;
}

/**
 * Hook to track page engagement metrics:
 * - Time on page
 * - Scroll depth (max reached)
 * - Focus time (active reading time)
 * - Click count
 */
export function usePageEngagement(userId?: string | null) {
  const { sessionId } = useSessionContext();
  const engagementRef = useRef<PageEngagementData>({
    pageStartTime: Date.now(),
    maxScrollDepth: 0,
    focusTime: 0,
    lastFocusStart: document.hasFocus() ? Date.now() : null,
    isFocused: document.hasFocus(),
    clickCount: 0,
  });
  const currentPathRef = useRef<string>(window.location.pathname);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate current scroll depth (0-100)
  const getScrollDepth = useCallback((): number => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    return scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 100;
  }, []);

  // Flush engagement data to database
  const flushEngagementData = useCallback(async (isExit: boolean = false) => {
    const engagement = engagementRef.current;
    const timeOnPage = Math.floor((Date.now() - engagement.pageStartTime) / 1000);
    
    // Add any remaining focus time
    let totalFocusTime = engagement.focusTime;
    if (engagement.isFocused && engagement.lastFocusStart) {
      totalFocusTime += Date.now() - engagement.lastFocusStart;
    }

    // Only flush if we have meaningful data (more than 1 second)
    if (timeOnPage < 1) return;

    try {
      await supabase.from('page_views').insert({
        session_id: sessionId,
        user_id: userId || null,
        page_path: currentPathRef.current,
        page_title: document.title,
        referrer: document.referrer || null,
        time_on_page: timeOnPage,
        scroll_depth: engagement.maxScrollDepth,
        exit_page: isExit,
      });

      console.log(`📊 Page engagement flushed: ${currentPathRef.current}, time: ${timeOnPage}s, scroll: ${engagement.maxScrollDepth}%`);
    } catch (error) {
      console.error('Failed to flush page engagement:', error);
    }
  }, [sessionId, userId]);

  // Reset engagement tracking for new page
  const resetEngagement = useCallback(() => {
    engagementRef.current = {
      pageStartTime: Date.now(),
      maxScrollDepth: getScrollDepth(),
      focusTime: 0,
      lastFocusStart: document.hasFocus() ? Date.now() : null,
      isFocused: document.hasFocus(),
      clickCount: 0,
    };
    currentPathRef.current = window.location.pathname;
  }, [getScrollDepth]);

  useEffect(() => {
    // Scroll handler - track max scroll depth
    const handleScroll = () => {
      const currentDepth = getScrollDepth();
      if (currentDepth > engagementRef.current.maxScrollDepth) {
        engagementRef.current.maxScrollDepth = currentDepth;
      }
    };

    // Focus/blur handlers - track active reading time
    const handleFocus = () => {
      engagementRef.current.isFocused = true;
      engagementRef.current.lastFocusStart = Date.now();
    };

    const handleBlur = () => {
      if (engagementRef.current.isFocused && engagementRef.current.lastFocusStart) {
        engagementRef.current.focusTime += Date.now() - engagementRef.current.lastFocusStart;
      }
      engagementRef.current.isFocused = false;
      engagementRef.current.lastFocusStart = null;
    };

    // Click handler - track clicks on page
    const handleClick = () => {
      engagementRef.current.clickCount++;
    };

    // Visibility change handler
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlur();
      } else {
        handleFocus();
      }
    };

    // Before unload - flush final data
    const handleBeforeUnload = () => {
      flushEngagementData(true);
    };

    // Add event listeners
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('click', handleClick);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Initialize with current scroll position
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('click', handleClick);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Clear any pending timeout
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, [getScrollDepth, flushEngagementData]);

  // Handle page navigation (route changes)
  const handlePageChange = useCallback(async () => {
    // Flush data for previous page
    await flushEngagementData(false);
    // Reset for new page
    resetEngagement();
  }, [flushEngagementData, resetEngagement]);

  return {
    handlePageChange,
    getCurrentEngagement: () => ({
      timeOnPage: Math.floor((Date.now() - engagementRef.current.pageStartTime) / 1000),
      maxScrollDepth: engagementRef.current.maxScrollDepth,
      clickCount: engagementRef.current.clickCount,
    }),
  };
}
