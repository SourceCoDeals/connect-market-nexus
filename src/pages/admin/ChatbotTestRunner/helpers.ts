import { type ChatbotTestStatus } from '../chatbot-test-runner/chatbotInfraTests';
import { type ScenarioStatus } from '../chatbot-test-runner/chatbotTestScenarios';

export function loadStoredResults<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore parse errors */
  }
  return fallback;
}

export function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage errors */
  }
}

export const severityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
};

export type AnyTestStatus = ChatbotTestStatus | ScenarioStatus;
