/**
 * Daily Briefing Auto-Launch Hook (Feature 4)
 *
 * Checks if the user has already seen their daily briefing today.
 * On first visit of the day, dispatches an event to auto-open the AI Command
 * Center with a contextual briefing prompt (Monday-aware).
 *
 * Storage: localStorage key `sourceco_briefing_last_seen`
 * Format: ISO date string (YYYY-MM-DD)
 *
 * Behavior:
 * - First visit of the day → auto-opens AI panel with daily briefing prompt
 * - Monday → enhanced "start of week" briefing prompt
 * - Subsequent visits same day → no-op
 * - Opt-out via `briefingAutoLaunchEnabled` localStorage flag
 */

import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'sourceco_briefing_last_seen';
const OPT_OUT_KEY = 'sourceco_briefing_auto_launch_enabled';

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function getDayOfWeek(): number {
  return new Date().getDay(); // 0=Sunday, 1=Monday, ...
}

function getBriefingPrompt(): string {
  const day = getDayOfWeek();

  if (day === 1) {
    // Monday — start of week briefing
    return "Give me my Monday briefing. What happened over the weekend, what's overdue, what should I prioritize this week? Include any critical signals or AI tasks pending review.";
  }

  if (day === 5) {
    // Friday — end of week summary
    return "Give me my daily briefing with a focus on wrapping up the week. What's overdue, what needs to get done today before the weekend?";
  }

  // Standard daily briefing
  return "Give me my daily briefing. What's overdue, what's due today, any critical signals or tasks I should focus on?";
}

export function useDailyBriefingAutoLaunch(enabled = true) {
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!enabled || hasTriggered.current) return undefined;

    // Check opt-out setting
    const optOutValue = localStorage.getItem(OPT_OUT_KEY);
    if (optOutValue === 'false') return undefined;

    const today = getTodayDateString();
    const lastSeen = localStorage.getItem(STORAGE_KEY);

    if (lastSeen === today) {
      // Already seen today
      return undefined;
    }

    // Mark as seen immediately to prevent duplicate triggers
    hasTriggered.current = true;
    localStorage.setItem(STORAGE_KEY, today);

    // Delay auto-launch slightly to let the page render
    const timer = setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('ai-command-center:open', {
          detail: {
            query: getBriefingPrompt(),
            source: 'daily_briefing_auto_launch',
          },
        }),
      );
    }, 1500);

    return () => clearTimeout(timer);
  }, [enabled]);
}

/**
 * Utility to check/set the auto-launch preference.
 */
export function isDailyBriefingAutoLaunchEnabled(): boolean {
  return localStorage.getItem(OPT_OUT_KEY) !== 'false';
}

export function setDailyBriefingAutoLaunchEnabled(enabled: boolean): void {
  localStorage.setItem(OPT_OUT_KEY, enabled ? 'true' : 'false');
}
