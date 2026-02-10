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
  // Retry on: rate limit (429), Anthropic overload (529), server errors (5xx)
  return status === 429 || status === 529 || status >= 500;
}

/**
 * Parse Retry-After header into milliseconds.
 */
function parseRetryAfterHeader(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  return null;
}

// ============= GEMINI CLIENT =============

async function callGemini(options: AICallOptions): Promise<AICallResult> {
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

    // Add tool_choice if specified (convert from OpenAI format to Claude format)
    if (options.toolChoice && typeof options.toolChoice === 'object' && options.toolChoice.type === 'function') {
      body.tool_choice = {
        type: 'tool',
        name: options.toolChoice.function.name
      };
    }
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

// ============= UNIFIED API =============

/**
 * Call an AI provider with automatic retry logic
 */
export async function callAI(options: AICallOptions): Promise<AICallResult> {
  const retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastResult: AICallResult | null = null;
  let retryCount = 0;

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
      return result;
    }

    lastResult = result;

    // Don't retry if error is not retryable
    if (!result.error?.retryable) {
      return result;
    }

    // Don't retry on last attempt
    if (attempt < retryAttempts) {
      retryCount++;
      // For rate limits (429), use longer delays to let the limit window pass
      const isRateLimit = result.error?.code?.includes('429') || result.error?.code === 'http_429';
      const baseDelay = isRateLimit ? Math.max(retryDelayMs, 5000) : retryDelayMs;
      const delay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
      console.warn(`AI call failed (attempt ${attempt + 1}/${retryAttempts + 1})${isRateLimit ? ' [rate limited]' : ''}, retrying in ${Math.round(delay + jitter)}ms...`);
      await sleep(delay + jitter);
    }
  }

  // All retries exhausted
  if (lastResult) {
    lastResult.retryCount = retryCount;
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
