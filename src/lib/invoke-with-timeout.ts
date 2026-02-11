import { supabase } from '@/integrations/supabase/client';

const DEFAULT_TIMEOUT_MS = 60_000; // 60 seconds

interface InvokeOptions {
  body?: Record<string, unknown>;
  timeoutMs?: number;
}

interface InvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

/**
 * Wraps supabase.functions.invoke() with a configurable timeout.
 *
 * Without this, a hung edge function would leave the client waiting
 * indefinitely. The default timeout is 60s — override per call as needed.
 */
export async function invokeWithTimeout<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  const { body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      // @ts-expect-error — supabase-js types don't expose signal yet, but fetch honours it
      signal: controller.signal,
    });

    if (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }

    return { data: data as T, error: null };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        data: null,
        error: new Error(`Edge function "${functionName}" timed out after ${timeoutMs}ms`),
      };
    }
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  } finally {
    clearTimeout(timer);
  }
}
