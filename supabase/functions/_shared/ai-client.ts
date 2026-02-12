/**
 * CENTRALIZED AI CLIENT - Unified Gemini AI provider with retry logic and cost tracking
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
  return status === 429 || status >= 500;
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
 * Call Gemini AI with automatic retry logic
 */
export async function callAI(options: AICallOptions): Promise<AICallResult> {
  const retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastResult: AICallResult | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    const result = await callGemini(options);

    if (result.success) {
      result.retryCount = retryCount;
      return result;
    }

    lastResult = result;

    if (!result.error?.retryable) {
      return result;
    }

    if (attempt < retryAttempts) {
      retryCount++;
      const isRateLimit = result.error?.code?.includes('429') || result.error?.code === 'http_429';
      const baseDelay = isRateLimit ? Math.max(retryDelayMs, 5000) : retryDelayMs;
      const delay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      console.warn(`AI call failed (attempt ${attempt + 1}/${retryAttempts + 1})${isRateLimit ? ' [rate limited]' : ''}, retrying in ${Math.round(delay + jitter)}ms...`);
      await sleep(delay + jitter);
    }
  }

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
