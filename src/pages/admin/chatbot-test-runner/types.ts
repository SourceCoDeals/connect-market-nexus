/**
 * Shared type definitions for chatbot test scenarios.
 */

export type ScenarioSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ScenarioStatus = 'pending' | 'running' | 'pass' | 'fail' | 'skip';

export interface AutoValidation {
  expectedRouteCategories?: string[];
  expectedTools?: string[];
  mustContainAny?: string[];
  mustNotContain?: string[];
  minResponseLength?: number;
  requiresToolCalls?: boolean;
}

export interface AutoCheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface TestScenario {
  id: string;
  category: string;
  name: string;
  description: string;
  userMessage: string;
  expectedBehavior: string[];
  edgeCases?: string[];
  severity: ScenarioSeverity;
  skipAutoRun?: boolean;
  autoValidation?: AutoValidation;
}

export interface ScenarioResult {
  id: string;
  status: ScenarioStatus;
  notes: string;
  testedAt: string | null;
  aiResponse?: string;
  toolsCalled?: string[];
  routeCategory?: string;
  durationMs?: number;
  autoChecks?: AutoCheckResult[];
  error?: string;
}

export const SCENARIO_STORAGE_KEY = 'sourceco-chatbot-scenario-results';
