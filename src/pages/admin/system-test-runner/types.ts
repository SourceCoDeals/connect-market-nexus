/**
 * Shared types, constants, and helpers for the SystemTestRunner.
 */

import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

// ── Types ──

export type TestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'warn';

export interface TestResult {
  id: string;
  name: string;
  category: string;
  status: TestStatus;
  error?: string;
  durationMs?: number;
}

export interface TestDef {
  id: string;
  name: string;
  category: string;
  fn: (ctx: TestContext) => Promise<void>;
}

export interface TestContext {
  /** IDs of resources created during tests, for cleanup */
  createdContactIds: string[];
  createdAccessIds: string[];
  createdReleaseLogIds: string[];
  createdTrackedLinkIds: string[];
  testListingId: string | null;
  testBuyerId: string | null;
  testDealId: string | null;
}

export const STORAGE_KEY = 'sourceco-system-test-results';

// ── Rate-limit aware helpers ──

/** Milliseconds to pause between consecutive tests to avoid Supabase rate limits. */
export const INTER_TEST_DELAY_MS = 120;

/** Returns true if the error message looks like a Supabase rate-limit (429 / ThrottlerException). */
export function isRateLimitError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('too many requests') ||
    lower.includes('throttlerexception') ||
    lower.includes('rate limit') ||
    lower.includes('429')
  );
}

/** Sleep helper. */
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Retry wrapper for test functions.
 * If the test throws a rate-limit error it waits with exponential back-off and retries.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 2000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!isRateLimitError(msg) || attempt === maxRetries) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(msg);
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(
        `[TestRunner] Rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})…`,
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

// ── Helpers ──

// Dynamic table name type for test helper functions
type SupabaseTableName = Parameters<typeof supabase.from>[0];

export async function assertQuery(query: string, description: string) {
  // execute_readonly_query RPC is not in generated Supabase types
  type RpcName = Parameters<typeof supabase.rpc>[0];
  const { error } = await supabase.rpc(
    'execute_readonly_query' as RpcName,
    { query_text: query } as Record<string, unknown>,
  );
  // Fallback: just run a direct query if RPC doesn't exist
  if (error?.message?.includes('function') && error?.message?.includes('does not exist')) {
    // Can't use raw SQL from client, so we'll use the table API
    throw new Error(`RPC not available for raw query check: ${description}`);
  }
  if (error) throw new Error(`${description}: ${error.message}`);
}

export async function columnExists(table: string, column: string) {
  const { error } = await supabase
    .from(table as SupabaseTableName)
    .select(column)
    .limit(1);
  if (error) throw new Error(`Column '${column}' check on '${table}' failed: ${error.message}`);
}

export async function tableReadable(table: string) {
  const { error } = await supabase
    .from(table as SupabaseTableName)
    .select('id')
    .limit(1);
  if (error) throw new Error(`Table '${table}' not readable: ${error.message}`);
}

export async function invokeEdgeFunction(name: string, body?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, {
    body: body || {},
  });
  if (error) {
    // Network-level failures vs structured errors
    const msg = typeof error === 'object' ? JSON.stringify(error) : String(error);
    if (
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('net::ERR')
    ) {
      throw new Error(`Edge function '${name}' network failure: ${msg}`);
    }
    // Structured errors (auth, config) are acceptable for reachability
  }
  return data;
}

export { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
