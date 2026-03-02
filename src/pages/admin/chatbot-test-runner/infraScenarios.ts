/**
 * Auto-validation engine for chatbot test scenarios.
 *
 * Provides the `runAutoChecks` function that validates AI responses
 * against expected behavior defined in test scenarios.
 */

import type { TestScenario, AutoCheckResult } from './types';

// ═══════════════════════════════════════════
// Auto-validation engine
// ═══════════════════════════════════════════

export function runAutoChecks(
  scenario: TestScenario,
  response: {
    text: string;
    toolCalls: Array<{ name: string; id: string; success: boolean }>;
    routeInfo: { category: string; tier: string; tools: string[] } | null;
    error: string | null;
  },
): AutoCheckResult[] {
  const checks: AutoCheckResult[] = [];
  const v = scenario.autoValidation;

  checks.push({
    name: 'Response received',
    passed: !!response.text && response.text.length > 0,
    detail: response.text ? `${response.text.length} chars` : 'Empty response',
  });

  if (response.error) {
    checks.push({ name: 'No errors', passed: false, detail: response.error });
  }

  if (!v) return checks;

  if (v.minResponseLength) {
    checks.push({
      name: `Response >= ${v.minResponseLength} chars`,
      passed: response.text.length >= v.minResponseLength,
      detail: `${response.text.length} chars`,
    });
  }

  if (v.expectedRouteCategories && v.expectedRouteCategories.length > 0) {
    const actual = response.routeInfo?.category || 'none';
    checks.push({
      name: 'Route category',
      passed: v.expectedRouteCategories.includes(actual),
      detail: `Expected: ${v.expectedRouteCategories.join(' / ')}, Got: ${actual}`,
    });
  }

  if (v.expectedTools && v.expectedTools.length > 0) {
    const called = response.toolCalls.map((t) => t.name);
    const found = v.expectedTools.some((t) => called.includes(t));
    checks.push({
      name: 'Expected tools used',
      passed: found,
      detail: `Expected any of: ${v.expectedTools.join(', ')}. Called: ${called.join(', ') || 'none'}`,
    });
  }

  if (v.requiresToolCalls) {
    checks.push({
      name: 'Used tools',
      passed: response.toolCalls.length > 0,
      detail:
        response.toolCalls.length > 0
          ? `${response.toolCalls.length} tool(s) called`
          : 'No tools called',
    });
  }

  if (v.mustContainAny && v.mustContainAny.length > 0) {
    const lower = response.text.toLowerCase();
    const found = v.mustContainAny.filter((k) => lower.includes(k.toLowerCase()));
    checks.push({
      name: 'Contains expected keywords',
      passed: found.length > 0,
      detail:
        found.length > 0 ? `Found: ${found.join(', ')}` : `None of: ${v.mustContainAny.join(', ')}`,
    });
  }

  if (v.mustNotContain && v.mustNotContain.length > 0) {
    const lower = response.text.toLowerCase();
    const found = v.mustNotContain.filter((k) => lower.includes(k.toLowerCase()));
    checks.push({
      name: 'No hallucinated content',
      passed: found.length === 0,
      detail: found.length > 0 ? `Found forbidden: ${found.join(', ')}` : 'Clean',
    });
  }

  return checks;
}
