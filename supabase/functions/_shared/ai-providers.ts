/**
 * AI Provider Configuration
 * 
 * Centralized module for direct API calls to AI providers.
 * Migrated from Lovable AI Gateway to direct provider APIs.
 */

// API Endpoints
// Gemini OpenAI-compatible endpoint with x-goog-api-key header
export const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Get the Gemini API URL with API key
 */
export function getGeminiApiUrl(apiKey: string): string {
  return GEMINI_API_URL;
}

/**
 * Build Gemini API URL for native endpoint (non-OpenAI compatible)
 */
export function getGeminiNativeUrl(model: string, apiKey: string): string {
  return `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
}

// Model mappings (Lovable Gateway model names → Native model names)
export const GEMINI_MODEL_MAP: Record<string, string> = {
  // Gemini models - map to native names
  "google/gemini-3-flash-preview": "gemini-2.0-flash",
  "google/gemini-2.5-flash": "gemini-2.0-flash",
  "google/gemini-2.5-flash-lite": "gemini-2.0-flash-lite",
  "google/gemini-2.5-pro": "gemini-2.0-pro-exp",
};

// Default models for different use cases
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const DEFAULT_GEMINI_PRO_MODEL = "gemini-2.0-pro-exp";

// Claude/Anthropic models
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";
export const DEFAULT_CLAUDE_FAST_MODEL = "claude-3-5-haiku-20241022";

/**
 * Get the native Gemini model name from a Lovable Gateway model name
 */
export function getGeminiModel(gatewayModel: string): string {
  return GEMINI_MODEL_MAP[gatewayModel] || DEFAULT_GEMINI_MODEL;
}

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
    "anthropic-version": "2023-06-01",
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

/**
 * Call Claude API with tool use (function calling)
 * Converts OpenAI-style tool format to Claude format for compatibility
 */
export async function callClaudeWithTool(
  systemPrompt: string,
  userPrompt: string,
  tool: any,
  apiKey: string,
  model: string = DEFAULT_CLAUDE_MODEL,
  timeoutMs: number = 20000,
  maxTokens: number = 8192
): Promise<{ data: any | null; error?: { code: string; message: string } }> {
  try {
    const claudeTool = convertOpenAIToolToClaudeTool(tool);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: getAnthropicHeaders(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
        tools: [claudeTool],
        tool_choice: {
          type: "tool",
          name: claudeTool.name,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    // Handle billing/rate limit errors
    if (response.status === 402) {
      return {
        data: null,
        error: { code: "payment_required", message: "AI credits depleted" },
      };
    }

    if (response.status === 429) {
      return {
        data: null,
        error: { code: "rate_limited", message: "Rate limit exceeded" },
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

    // Extract tool use from Claude response
    const toolUse = responseData.content?.find((block: any) => block.type === "tool_use");
    if (!toolUse) {
      console.warn("No tool use in Claude response");
      return {
        data: null,
        error: {
          code: "no_tool_use",
          message: "Claude did not return tool use - may have returned text instead"
        }
      };
    }

    return { data: toolUse.input };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("Claude API timeout");
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
