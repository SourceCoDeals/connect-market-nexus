/**
 * CENTRALIZED AI CLIENT - Unified AI provider with retry logic and cost tracking
 *
 * This module provides:
 * 1. Unified interface for multiple AI providers (Gemini, Claude, OpenAI)
 * 2. Automatic retry with exponential backoff
 * 3. Cost tracking and monitoring
 * 4. Response caching (optional)
 *
 * Usage:
 *   import { callAI, AIProvider } from "../_shared/ai-client.ts";
 *   const result = await callAI({
 *     provider: AIProvider.GEMINI,
 *     messages: [...],
 *     tools: [...],
 *   });
 */

import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "./ai-providers.ts";

// ============= TYPES =============

export enum AIProvider {
  GEMINI = "gemini",
  CLAUDE = "claude",
  OPENAI = "openai",
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AICallOptions {
  provider: AIProvider;
  model?: string;
  messages: AIMessage[];
  tools?: AITool[];
  toolChoice?: { type: "function"; function: { name: string } } | "auto";
  maxTokens?: number;
  temperature?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface AICallResult {
  success: boolean;
  content?: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  retryCount?: number;
}

// ============= RETRY LOGIC =============

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;
const DEFAULT_TIMEOUT_MS = 60000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(status: number): boolean {
  // Retry on: rate limit (429), server errors (5xx), network errors
  return status === 429 || status >= 500;
}

// ============= RATE LIMITING =============

// Rate limiting configuration for Gemini API (15 req/min free tier)
const GEMINI_RATE_LIMIT = 15; // requests per minute
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Track Gemini requests in last minute
let geminiRequestTimestamps: number[] = [];

/**
 * Enforce rate limiting before making Gemini API call
 * Waits if necessary to avoid hitting rate limits proactively
 */
async function enforceGeminiRateLimit(): Promise<void> {
  const now = Date.now();

  // Remove timestamps older than 1 minute
  geminiRequestTimestamps = geminiRequestTimestamps.filter(
    ts => now - ts < RATE_LIMIT_WINDOW_MS
  );

  // If we're at the limit, wait until the oldest request is >1 minute old
  if (geminiRequestTimestamps.length >= GEMINI_RATE_LIMIT) {
    const oldestRequest = geminiRequestTimestamps[0];
    const waitTime = RATE_LIMIT_WINDOW_MS - (now - oldestRequest);

    if (waitTime > 0) {
      console.log(`[RATE_LIMIT] At Gemini limit (${GEMINI_RATE_LIMIT}/min), waiting ${waitTime}ms`);
      await sleep(waitTime + 100); // Add small buffer

      // Clean up old timestamps again after waiting
      const afterWait = Date.now();
      geminiRequestTimestamps = geminiRequestTimestamps.filter(
        ts => afterWait - ts < RATE_LIMIT_WINDOW_MS
      );
    }
  }

  // Record this request
  geminiRequestTimestamps.push(Date.now());
  console.log(`[RATE_LIMIT] Gemini requests in last minute: ${geminiRequestTimestamps.length}/${GEMINI_RATE_LIMIT}`);
}

// ============= GEMINI CLIENT =============

async function callGemini(options: AICallOptions): Promise<AICallResult> {
  // Enforce rate limiting BEFORE making API call
  await enforceGeminiRateLimit();

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    return {
      success: false,
      error: { code: "missing_api_key", message: "GEMINI_API_KEY not configured", retryable: false },
    };
  }

  const model = options.model || DEFAULT_GEMINI_MODEL;
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    if (options.toolChoice) {
      body.tool_choice = options.toolChoice;
    }
  }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: getGeminiHeaders(geminiApiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: {
          code: `http_${response.status}`,
          message: errorText,
          retryable: isRetryableError(response.status),
        },
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    // Extract tool call if present
    const toolCall = message?.tool_calls?.[0];
    if (toolCall?.function) {
      try {
        return {
          success: true,
          toolCall: {
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
          },
          usage: data.usage
            ? {
                inputTokens: data.usage.prompt_tokens || 0,
                outputTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0,
              }
            : undefined,
        };
      } catch (e) {
        return {
          success: false,
          error: {
            code: "parse_error",
            message: `Failed to parse tool arguments: ${e instanceof Error ? e.message : "unknown"}`,
            retryable: false,
          },
        };
      }
    }

    return {
      success: true,
      content: message?.content || "",
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens || 0,
            outputTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      error: {
        code: isTimeout ? "timeout" : "network_error",
        message: error instanceof Error ? error.message : "Unknown error",
        retryable: true,
      },
    };
  }
}

// ============= CLAUDE CLIENT =============

async function callClaude(options: AICallOptions): Promise<AICallResult> {
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicApiKey) {
    return {
      success: false,
      error: { code: "missing_api_key", message: "ANTHROPIC_API_KEY not configured", retryable: false },
    };
  }

  const model = options.model || "claude-sonnet-4-20250514";

  // Convert messages format - extract system message
  const systemMessage = options.messages.find((m) => m.role === "system")?.content;
  const nonSystemMessages = options.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens || 4096,
    messages: nonSystemMessages,
  };

  if (systemMessage) {
    body.system = systemMessage;
  }

  if (options.tools && options.tools.length > 0) {
    // Convert to Claude's tool format
    body.tools = options.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: {
          code: `http_${response.status}`,
          message: errorText,
          retryable: isRetryableError(response.status),
        },
      };
    }

    const data = await response.json();
    const content = data.content?.[0];

    // Check for tool use
    if (content?.type === "tool_use") {
      return {
        success: true,
        toolCall: {
          name: content.name,
          arguments: content.input,
        },
        usage: data.usage
          ? {
              inputTokens: data.usage.input_tokens || 0,
              outputTokens: data.usage.output_tokens || 0,
              totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
            }
          : undefined,
      };
    }

    return {
      success: true,
      content: content?.type === "text" ? content.text : "",
      usage: data.usage
        ? {
            inputTokens: data.usage.input_tokens || 0,
            outputTokens: data.usage.output_tokens || 0,
            totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
          }
        : undefined,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      error: {
        code: isTimeout ? "timeout" : "network_error",
        message: error instanceof Error ? error.message : "Unknown error",
        retryable: true,
      },
    };
  }
}

// ============= OPENAI CLIENT =============

async function callOpenAI(options: AICallOptions): Promise<AICallResult> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    return {
      success: false,
      error: { code: "missing_api_key", message: "OPENAI_API_KEY not configured", retryable: false },
    };
  }

  const model = options.model || "gpt-4o-mini";
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    if (options.toolChoice) {
      body.tool_choice = options.toolChoice;
    }
  }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: {
          code: `http_${response.status}`,
          message: errorText,
          retryable: isRetryableError(response.status),
        },
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    // Extract tool call if present
    const toolCall = message?.tool_calls?.[0];
    if (toolCall?.function) {
      try {
        return {
          success: true,
          toolCall: {
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
          },
          usage: data.usage
            ? {
                inputTokens: data.usage.prompt_tokens || 0,
                outputTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0,
              }
            : undefined,
        };
      } catch (e) {
        return {
          success: false,
          error: {
            code: "parse_error",
            message: `Failed to parse tool arguments: ${e instanceof Error ? e.message : "unknown"}`,
            retryable: false,
          },
        };
      }
    }

    return {
      success: true,
      content: message?.content || "",
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens || 0,
            outputTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      error: {
        code: isTimeout ? "timeout" : "network_error",
        message: error instanceof Error ? error.message : "Unknown error",
        retryable: true,
      },
    };
  }
}

// ============= COST TRACKING =============

// Pricing per 1M tokens (as of 2026-02, in USD)
const PRICING = {
  gemini: {
    input: 0.075,   // Gemini Flash 2.0
    output: 0.30,
  },
  claude: {
    input: 3.0,     // Claude Sonnet 4.5
    output: 15.0,
  },
  openai: {
    'gpt-4o': {
      input: 2.50,
      output: 10.0,
    },
    'gpt-4o-mini': {
      input: 0.15,
      output: 0.60,
    },
  },
};

/**
 * Calculate cost in USD for an AI API call
 */
function calculateCost(
  provider: AIProvider,
  model: string,
  inputTokens: number,
  outputTokens: number
): { inputCost: number; outputCost: number; totalCost: number } {
  let inputRate = 0;
  let outputRate = 0;

  if (provider === AIProvider.GEMINI) {
    inputRate = PRICING.gemini.input;
    outputRate = PRICING.gemini.output;
  } else if (provider === AIProvider.CLAUDE) {
    inputRate = PRICING.claude.input;
    outputRate = PRICING.claude.output;
  } else if (provider === AIProvider.OPENAI) {
    // Determine OpenAI model pricing
    if (model.includes('gpt-4o-mini')) {
      inputRate = PRICING.openai['gpt-4o-mini'].input;
      outputRate = PRICING.openai['gpt-4o-mini'].output;
    } else {
      inputRate = PRICING.openai['gpt-4o'].input;
      outputRate = PRICING.openai['gpt-4o'].output;
    }
  }

  const inputCost = (inputTokens / 1_000_000) * inputRate;
  const outputCost = (outputTokens / 1_000_000) * outputRate;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
}

/**
 * Log AI API call to cost tracking table
 * This is fire-and-forget to avoid blocking the main request
 */
async function logAICost(
  provider: AIProvider,
  model: string,
  functionName: string,
  result: AICallResult,
  durationMs: number
): Promise<void> {
  try {
    // Skip logging if no usage data
    if (!result.usage) {
      return;
    }

    const cost = calculateCost(
      provider,
      model,
      result.usage.inputTokens,
      result.usage.outputTokens
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[COST_TRACKING] Supabase credentials not available, skipping cost logging');
      return;
    }

    // Log to database (fire-and-forget)
    fetch(`${supabaseUrl}/rest/v1/ai_api_calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal', // Don't wait for response
      },
      body: JSON.stringify({
        provider,
        model,
        function_name: functionName,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        input_cost_usd: cost.inputCost,
        output_cost_usd: cost.outputCost,
        success: result.success,
        error_code: result.error?.code,
        error_message: result.error?.message,
        retry_count: result.retryCount || 0,
        duration_ms: durationMs,
      }),
    }).catch(err => {
      // Silently log error - don't let cost tracking failure affect main request
      console.error('[COST_TRACKING] Failed to log AI cost:', err);
    });

    // Also log to console for immediate visibility
    console.log('[COST_TRACKING]', {
      provider,
      model,
      function: functionName,
      tokens: `${result.usage.inputTokens} in / ${result.usage.outputTokens} out`,
      cost: `$${cost.totalCost.toFixed(6)}`,
      duration: `${durationMs}ms`,
    });

  } catch (error) {
    console.error('[COST_TRACKING] Error in cost logging:', error);
  }
}

// ============= UNIFIED API =============

/**
 * Call an AI provider with automatic retry logic and cost tracking
 */
export async function callAI(options: AICallOptions): Promise<AICallResult> {
  const retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const startTime = Date.now();

  let lastResult: AICallResult | null = null;
  let retryCount = 0;

  // Try to infer function name from stack trace
  const functionName = new Error().stack?.match(/at (\w+)/)?.[1] || 'unknown';

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    // Select provider
    let result: AICallResult;
    switch (options.provider) {
      case AIProvider.GEMINI:
        result = await callGemini(options);
        break;
      case AIProvider.CLAUDE:
        result = await callClaude(options);
        break;
      case AIProvider.OPENAI:
        result = await callOpenAI(options);
        break;
      default:
        return {
          success: false,
          error: { code: "invalid_provider", message: `Unknown provider: ${options.provider}`, retryable: false },
        };
    }

    if (result.success) {
      result.retryCount = retryCount;

      // Track cost (fire-and-forget)
      const duration = Date.now() - startTime;
      const model = options.model || (
        options.provider === AIProvider.GEMINI ? 'gemini-2.0-flash-exp' :
        options.provider === AIProvider.CLAUDE ? 'claude-sonnet-4-20250514' :
        'gpt-4o-mini'
      );
      logAICost(options.provider, model, functionName, result, duration);

      return result;
    }

    lastResult = result;

    // Don't retry if error is not retryable
    if (!result.error?.retryable) {
      // Track failed call cost if usage data is available
      if (result.usage) {
        const duration = Date.now() - startTime;
        const model = options.model || 'unknown';
        logAICost(options.provider, model, functionName, result, duration);
      }
      return result;
    }

    // Don't retry on last attempt
    if (attempt < retryAttempts) {
      retryCount++;
      const delay = retryDelayMs * Math.pow(2, attempt); // Exponential backoff
      console.warn(`AI call failed (attempt ${attempt + 1}/${retryAttempts + 1}), retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  if (lastResult) {
    lastResult.retryCount = retryCount;

    // Track final failed attempt
    if (lastResult.usage) {
      const duration = Date.now() - startTime;
      const model = options.model || 'unknown';
      logAICost(options.provider, model, functionName, lastResult, duration);
    }

    return lastResult;
  }

  return {
    success: false,
    error: { code: "unknown", message: "All retry attempts failed", retryable: false },
    retryCount,
  };
}

/**
 * Convenience function for Gemini calls
 */
export async function callGeminiAI(
  messages: AIMessage[],
  options?: Partial<Omit<AICallOptions, "provider" | "messages">>
): Promise<AICallResult> {
  return callAI({
    provider: AIProvider.GEMINI,
    messages,
    ...options,
  });
}

/**
 * Convenience function for Claude calls
 */
export async function callClaudeAI(
  messages: AIMessage[],
  options?: Partial<Omit<AICallOptions, "provider" | "messages">>
): Promise<AICallResult> {
  return callAI({
    provider: AIProvider.CLAUDE,
    messages,
    ...options,
  });
}

/**
 * Convenience function for OpenAI calls
 */
export async function callOpenAIAI(
  messages: AIMessage[],
  options?: Partial<Omit<AICallOptions, "provider" | "messages">>
): Promise<AICallResult> {
  return callAI({
    provider: AIProvider.OPENAI,
    messages,
    ...options,
  });
}
