/**
 * Centralized API URL and Model Constants
 *
 * All third-party API base URLs and AI model identifiers used across edge functions.
 * Import from here instead of hardcoding URLs in individual functions.
 *
 * When a provider changes their API endpoint, update it once here.
 */

// =============================================================================
// API URLs — Third-party services
// =============================================================================

/** Firecrawl web scraping API */
export const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";
export const FIRECRAWL_MAP_URL = "https://api.firecrawl.dev/v1/map";

/** Fireflies.ai meeting transcription GraphQL API */
export const FIREFLIES_GRAPHQL_URL = "https://api.fireflies.ai/graphql";

/** DocuSeal document signing API */
export const DOCUSEAL_API_BASE = "https://api.docuseal.com";
export const DOCUSEAL_SUBMISSIONS_URL = `${DOCUSEAL_API_BASE}/submissions`;

/** Anthropic Claude API */
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/** Resend email API */
export const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/** Brevo (formerly Sendinblue) transactional email API */
export const BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email";

/** Apify web scraping platform API */
export const APIFY_API_BASE = "https://api.apify.com/v2";

// =============================================================================
// AI Model Identifiers
// =============================================================================

/** Gemini models */
export const GEMINI_FLASH_MODEL = "gemini-2.0-flash";
export const GEMINI_25_FLASH_MODEL = "gemini-2.5-flash";
export const GEMINI_PRO_MODEL = "gemini-2.0-pro-exp";

/** Claude models */
export const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";
export const CLAUDE_SONNET_MODEL = "claude-sonnet-4-6";
export const CLAUDE_OPUS_MODEL = "claude-opus-4-6";
export const CLAUDE_SONNET_DATED_MODEL = "claude-sonnet-4-20250514";

/** Gemini API endpoint (OpenAI-compatible) */
export const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
