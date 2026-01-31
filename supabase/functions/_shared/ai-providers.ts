/**
 * AI Provider Configuration
 * 
 * Centralized module for direct API calls to AI providers.
 * Migrated from Lovable AI Gateway to direct provider APIs.
 */

// API Endpoints
export const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

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

/**
 * Get the native Gemini model name from a Lovable Gateway model name
 */
export function getGeminiModel(gatewayModel: string): string {
  return GEMINI_MODEL_MAP[gatewayModel] || DEFAULT_GEMINI_MODEL;
}

/**
 * Build Gemini API request headers
 */
export function getGeminiHeaders(apiKey: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiKey}`,
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
