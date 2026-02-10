/**
 * AI Provider Configuration
 * 
 * Centralized module for direct API calls to AI providers.
 * Migrated from Lovable AI Gateway to direct provider APIs.
 */

// API Endpoints
export const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Build Gemini API URL for native endpoint (non-OpenAI compatible)
 */
export function getGeminiNativeUrl(model: string, apiKey: string): string {
  return `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
}

// Default models for different use cases
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const DEFAULT_GEMINI_PRO_MODEL = "gemini-2.0-pro-exp";

// Claude/Anthropic models
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";
export const DEFAULT_CLAUDE_FAST_MODEL = "claude-3-5-haiku-20241022";

/**
 * Convert OpenAI-style tool schema to Anthropic format
 */
export function toAnthropicTool(openAITool: { type: string; function: { name: string; description: string; parameters: object } }) {
  return {
    name: openAITool.function.name,
    description: openAITool.function.description,
    input_schema: openAITool.function.parameters
  };
}

/**
 * Parse Anthropic tool_use response to get structured data
 */
export function parseAnthropicToolResponse(result: { content: Array<{ type: string; input?: unknown }> }): unknown | null {
  const toolUse = result.content?.find((c: { type: string }) => c.type === 'tool_use');
  return toolUse?.input || null;
}

/**
 * Build Gemini API request headers
 * Gemini OpenAI-compatible endpoint expects Authorization: Bearer <API_KEY>
 */
export function getGeminiHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Build Anthropic API request headers
 */
export function getAnthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    "anthropic-version": "2025-03-05",
    "Content-Type": "application/json",
  };
}

/**
 * Standard error response interface
 */
export interface AIErrorResponse {
  error: string;
  code?: string;
  recoverable?: boolean;
}

/**
 * Parse AI API error responses and return standardized error info
 */
export function parseAIError(status: number, responseText?: string): AIErrorResponse {
  switch (status) {
    case 401:
      return {
        error: "Invalid API key",
        code: "invalid_api_key",
        recoverable: false,
      };
    case 402:
      return {
        error: "Payment required - please add credits",
        code: "payment_required",
        recoverable: false,
      };
    case 429:
      return {
        error: "Rate limit exceeded - please try again later",
        code: "rate_limited",
        recoverable: true,
      };
    case 500:
    case 502:
    case 503:
      return {
        error: "AI service temporarily unavailable",
        code: "service_unavailable",
        recoverable: true,
      };
    case 529:
      // Anthropic-specific overload error
      return {
        error: "AI service overloaded - please try again later",
        code: "service_overloaded",
        recoverable: true,
      };
    default:
      return {
        error: responseText || `AI API error: ${status}`,
        code: "unknown_error",
        recoverable: false,
      };
  }
}

/**
 * Convert OpenAI-style tool to Claude tool format
 */
function convertOpenAIToolToClaudeTool(openAITool: any): any {
  return {
    name: openAITool.function.name,
    description: openAITool.function.description || "",
    input_schema: openAITool.function.parameters || {
      type: "object",
      properties: {},
    },
  };
}

// ============================================================================
// RETRY-AWARE AI CALL HELPERS
// ============================================================================

/**
 * Parse Retry-After header value into milliseconds.
 */
function parseRetryAfter(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  // Try parsing as HTTP date
  const date = new Date(header);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return null;
}

/**
 * Fetch with automatic retry on rate limits (429) and server errors (5xx).
 * This is the core reliability mechanism — it WAITS and RETRIES instead of failing.
 *
 * Designed for internal tool: we'd rather wait 30s than lose the operation.
 */
async function fetchWithAutoRetry(
  url: string,
  options: RequestInit & { signal?: AbortSignal },
  config: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    callerName?: string;
  } = {}
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 2000, maxDelayMs = 60000, callerName = 'AI' } = config;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success or non-retryable client error (400, 401, 402, 404)
      if (response.ok || (response.status >= 400 && response.status < 429)) {
        return response;
      }

      // Rate limited (429) — WAIT and retry
      if (response.status === 429) {
        if (attempt === maxRetries) return response; // Last attempt, return the 429

        const retryAfterMs = parseRetryAfter(response) || baseDelayMs * Math.pow(2, attempt);
        const waitMs = Math.min(retryAfterMs, maxDelayMs);
        const jitter = Math.random() * 1000; // Add 0-1s jitter
        console.warn(`[${callerName}] Rate limited (429), waiting ${Math.round(waitMs + jitter)}ms before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, waitMs + jitter));
        continue;
      }

      // Server error (500, 502, 503, 529) — retry with backoff
      if (response.status >= 500) {
        if (attempt === maxRetries) return response;

        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.random() * delay * 0.3;
        console.warn(`[${callerName}] Server error (${response.status}), retrying in ${Math.round(delay + jitter)}ms...`);
        await new Promise(r => setTimeout(r, delay + jitter));
        continue;
      }

      // Other status — return as-is
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Timeout errors are not retryable (the caller set the timeout budget)
      if (lastError.name === 'TimeoutError' || lastError.name === 'AbortError') {
        throw lastError;
      }

      // Network errors — retry
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        console.warn(`[${callerName}] Network error, retrying in ${delay}ms: ${lastError.message}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error(`${callerName}: all retry attempts exhausted`);
}

/**
 * Call Claude API with tool use (function calling).
 * Now with automatic retry on 429/5xx — waits and retries instead of failing.
 *
 * Converts OpenAI-style tool format to Claude format for compatibility.
 */
export async function callClaudeWithTool(
  systemPrompt: string,
  userPrompt: string,
  tool: any,
  apiKey: string,
  model: string = DEFAULT_CLAUDE_MODEL,
  timeoutMs: number = 30000,
  maxTokens: number = 8192
): Promise<{ data: any | null; error?: { code: string; message: string }; usage?: { input_tokens: number; output_tokens: number } }> {
  try {
    const claudeTool = convertOpenAIToolToClaudeTool(tool);
    const startTime = Date.now();

    const response = await fetchWithAutoRetry(
      ANTHROPIC_API_URL,
      {
        method: "POST",
        headers: getAnthropicHeaders(apiKey),
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          tools: [claudeTool],
          tool_choice: { type: "tool", name: claudeTool.name },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
      { maxRetries: 3, baseDelayMs: 3000, callerName: `Claude/${model}` }
    );

    const durationMs = Date.now() - startTime;

    // Handle billing errors (not retryable)
    if (response.status === 402) {
      return {
        data: null,
        error: { code: "payment_required", message: "AI credits depleted" },
      };
    }

    // If we still got 429 after retries, return rate_limited
    if (response.status === 429) {
      return {
        data: null,
        error: { code: "rate_limited", message: "Rate limit exceeded after retries" },
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Claude API call failed: ${response.status}`, errorText.substring(0, 500));
      return {
        data: null,
        error: {
          code: `http_${response.status}`,
          message: `Claude API returned ${response.status}: ${errorText.substring(0, 200)}`
        }
      };
    }

    const responseData = await response.json();

    // Extract usage for cost tracking
    const usage = responseData.usage ? {
      input_tokens: responseData.usage.input_tokens || 0,
      output_tokens: responseData.usage.output_tokens || 0,
    } : undefined;

    if (usage) {
      console.log(`[Claude/${model}] ${usage.input_tokens}in/${usage.output_tokens}out tokens, ${durationMs}ms`);
    }

    // Extract tool use from Claude response
    const toolUse = responseData.content?.find((block: any) => block.type === "tool_use");
    if (!toolUse) {
      console.warn("No tool use in Claude response");
      return {
        data: null,
        error: {
          code: "no_tool_use",
          message: "Claude did not return tool use - may have returned text instead"
        },
        usage,
      };
    }

    return { data: toolUse.input, usage };
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      console.error(`Claude API timeout after ${timeoutMs}ms`);
      return {
        data: null,
        error: {
          code: "timeout",
          message: `Claude API timeout after ${timeoutMs}ms`
        }
      };
    }
    console.error("Claude API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      data: null,
      error: {
        code: "unknown_error",
        message: `Claude API error: ${message}`
      }
    };
  }
}

/**
 * Call Gemini API with automatic retry on rate limits.
 * Uses OpenAI-compatible endpoint. Waits and retries on 429.
 */
export async function callGeminiWithRetry(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number = 45000,
  callerName: string = 'Gemini'
): Promise<Response> {
  return fetchWithAutoRetry(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    },
    { maxRetries: 3, baseDelayMs: 2000, callerName }
  );
}
