# Data Pipelines Architecture

This document describes the enrichment data pipeline architecture used by Connect Market Nexus. It covers the data flow, external API integrations, error handling, retry strategy, and the dead letter queue pattern.

## Pipeline Overview

The platform uses an event-driven enrichment pipeline to augment deal and buyer records with data from external sources. The pipeline is implemented as a set of Supabase Edge Functions (Deno/TypeScript) that communicate via HTTP invocations, database queues, and shared utility modules.

```
                         ENRICHMENT PIPELINE ARCHITECTURE

  +-----------+     +-------------------+     +--------------------+
  |  Trigger  | --> | Queue (DB table)  | --> | Queue Processor    |
  |           |     |                   |     | (Edge Function)    |
  +-----------+     +-------------------+     +--------------------+
       |                                              |
       |  - Admin UI button                           |  Claims items atomically
       |  - Bulk import                               |  Loops until empty or
       |  - Scheduled cron                            |  time limit reached
       |  - New deal/buyer created                    |
                                                      v
                                            +--------------------+
                                            | Enrichment Worker  |
                                            | (Edge Function)    |
                                            +--------------------+
                                                      |
                              +-----------+-----------+-----------+
                              |           |           |           |
                              v           v           v           v
                         +---------+ +---------+ +---------+ +---------+
                         |Firecrawl| | Gemini  | |  Apify  | |Fireflies|
                         | Scrape  | | AI/LLM  | |LinkedIn | | GraphQL |
                         +---------+ +---------+ |Google   | +---------+
                                                 +---------+
                              |           |           |           |
                              v           v           v           v
                                            +--------------------+
                                            | Database Update    |
                                            | (Supabase/Postgres)|
                                            +--------------------+
                                                      |
                                                      v
                                            +--------------------+
                                            | Score Calculation  |
                                            | (score-buyer-deal) |
                                            +--------------------+
                                                      |
                                                      v
                                            +--------------------+
                                            | UI Display         |
                                            | (React frontend)   |
                                            +--------------------+
```

## Data Flow

### Deal Enrichment Pipeline

**Trigger**: Admin clicks "Enrich" on a deal, or a deal enters the enrichment queue via bulk import or new listing creation.

**Flow**: `trigger` -> `enrichment_queue` -> `process-enrichment-queue` -> `enrich-deal` -> database

1. **Queue Entry**: A record is inserted into the `enrichment_queue` table with status `pending`.
2. **Queue Processor** (`process-enrichment-queue`): Picks up pending items using atomic claim (RPC call). Processes items in parallel chunks (configurable concurrency). Self-continues by invoking itself when items remain.
3. **Enrichment Worker** (`enrich-deal`): Orchestrates multi-step enrichment for a single deal:
   - **Step 0**: Transcript processing (highest priority source). Fetches content from Fireflies if needed, runs AI extraction via sub-functions.
   - **Step 0.5**: Notes analysis (`analyze-deal-notes`). Extracts structured data from free-text notes.
   - **Step 1**: Website scraping via Firecrawl API. Scrapes homepage and subpages.
   - **Step 2**: AI extraction via Gemini. Sends scraped content to Gemini with a structured tool-call schema to extract deal intelligence fields.
   - **Step 3**: Validation and cleaning. Strips financials, validates LinkedIn URLs, normalizes geography.
   - **Step 4**: External enrichment. LinkedIn data via Apify (`apify-linkedin-scrape`). Google Reviews via Apify (`apify-google-reviews`).
   - **Step 5**: Database write with optimistic locking and source-priority system.
4. **Scoring**: After enrichment, `score-buyer-deal` calculates composite fit scores between enriched deals and buyers.

### Buyer Enrichment Pipeline

**Trigger**: Admin adds buyers to a universe, or triggers bulk enrichment from the UI.

**Flow**: `trigger` -> `buyer_enrichment_queue` -> `process-buyer-enrichment-queue` -> `enrich-buyer` -> database

1. **Queue Entry**: A record is inserted into `buyer_enrichment_queue` with status `pending`.
2. **Queue Processor** (`process-buyer-enrichment-queue`): Self-looping processor that runs until the queue is empty or the function time limit is reached (~140s). Processes one buyer at a time sequentially.
3. **Enrichment Worker** (`enrich-buyer`): Orchestrates multi-prompt enrichment for a single buyer:
   - Scrapes platform website and PE firm website in parallel via Firecrawl.
   - Discovers and scrapes location pages via `firecrawl-map`.
   - Runs 4 AI extraction prompts in batches via Gemini (business overview, geography, customer profile, PE intelligence).
   - Validates provenance (which source is authoritative for which field).
   - Writes enriched data to `remarketing_buyers` table.

## External API Integrations

| Provider   | API Type      | Used By                              | Purpose                         |
|-----------|---------------|--------------------------------------|---------------------------------|
| Firecrawl | REST          | `enrich-deal`, `enrich-buyer`, `firecrawl-scrape` | Website scraping + site mapping |
| Gemini    | OpenAI-compat | `enrich-deal`, `enrich-buyer`, `score-buyer-deal`, `extract-*` | AI extraction, scoring, analysis |
| Apify     | REST (Actor)  | `apify-linkedin-scrape`, `apify-google-reviews` | LinkedIn company data, Google Reviews |
| Fireflies | GraphQL       | `fetch-fireflies-content`, `search-fireflies-for-buyer` | Meeting transcript retrieval |
| Brevo     | REST          | `send-*-email` functions             | Transactional email delivery    |

## Error Handling and Retry Strategy

### Retry Layers

The pipeline uses multiple retry layers at different levels:

1. **Generic Retry Utility** (`_shared/retry.ts`):
   Generic `withRetry<T>` wrapper with exponential backoff and jitter. Used for wrapping any external API call. Configurable max retries, base delay, max delay, and retryable error filters.

2. **AI-Specific Retry** (`_shared/ai-providers.ts` - `fetchWithAutoRetry`):
   Purpose-built retry for AI API calls. Handles HTTP 429 (rate limit) with Retry-After header parsing. Handles 5xx server errors with exponential backoff. Integrated with the rate limiter for cross-function coordination.

3. **Email Retry** (`_shared/brevo-sender.ts`):
   Brevo email sending has built-in retry (3 attempts) for server errors (5xx) and network errors. Does not retry client errors (4xx).

4. **Queue-Level Retry**:
   Both `enrichment_queue` and `buyer_enrichment_queue` track attempt counts. Items that fail are reset to `pending` for retry (up to MAX_ATTEMPTS = 3). Items exceeding max attempts are marked `failed`.

### Rate Limiting

- **Provider-Level Coordination** (`_shared/rate-limiter.ts`): DB-backed rate limit state shared across concurrent edge function invocations. Tracks concurrent requests per provider and enforces cooldown periods after 429 responses.
- **Per-Provider Limits**: Gemini (10 concurrent, 30 RPM), Firecrawl (5 concurrent, 20 RPM), Apify (3 concurrent, 10 RPM).
- **Adaptive Delays**: `getAdaptiveDelay()` scales delay based on recent error count.

### Circuit Breaker Pattern

The circuit breaker (`_shared/circuit-breaker.ts`) provides per-invocation protection against cascading failures:

- **CLOSED** (normal): Requests pass through. Failures are counted.
- **OPEN** (failing): After N consecutive failures, requests are immediately rejected for a configurable duration.
- **HALF_OPEN** (testing): After the open duration expires, a limited number of test requests are allowed. On success, the circuit closes. On failure, it reopens.

This is especially useful for queue processors that iterate over many items in a single invocation, preventing a down service from wasting time on doomed requests.

### Edge Function Timeout Guard

`_shared/edge-timeout.ts` provides a timeout guard for the Supabase edge function hard limit (~60s). Wraps long-running operations with `withEdgeTimeout()` to return partial results before the function is killed.

## Dead Letter Queue Pattern

When a job fails after exhausting all retry attempts, it is sent to the dead letter queue via `_shared/dead-letter-queue.ts`. This ensures no work is silently lost.

### Dead Letter Queue Fields

| Field           | Description                                              |
|----------------|----------------------------------------------------------|
| function_name  | The edge function that failed                            |
| payload        | Original request payload (for replay)                    |
| error_message  | Human-readable error description                         |
| attempt_count  | Number of attempts before giving up                      |
| last_attempt_at| Timestamp of final attempt                               |
| entity_type    | Optional: deal, buyer, etc.                              |
| entity_id      | Optional: the specific record ID                         |
| status         | `pending` (needs investigation) or `resolved`            |

### DLQ Flow

```
  External API call fails
          |
          v
  withRetry exhausts all attempts
          |
          v
  sendToDeadLetterQueue()  (non-blocking, fire-and-forget)
          |
          v
  dead_letter_queue table  <-- Admin reviews via dashboard/SQL
          |
          v
  Manual retry or resolution
```

### DLQ Design Principles

- **Non-blocking**: DLQ writes never interfere with the primary error response. If the DLQ insert itself fails, the error is logged to console as structured JSON (fallback).
- **Replayable**: The full payload is stored so jobs can be retried without reconstructing the original request.
- **Observable**: Each entry includes the function name, error, and attempt count for easy filtering and alerting.

## Observability

### Enrichment Events

`_shared/enrichment-events.ts` logs structured events for every enrichment step (success, failure, timeout, rate_limited, skipped). Events are written non-blocking to the `enrichment_events` table via an RPC call.

### Cost Tracking

`_shared/cost-tracker.ts` logs AI token usage and estimated costs per call to `enrichment_cost_log`. Supports per-model pricing and aggregate spend queries.

### Enrichment Jobs

Queue processors create job records via `upsert_enrichment_job` RPC for tracking batch progress (total, succeeded, failed, rate-limited).

## Source Priority and Provenance

`_shared/source-priority.ts` and `_shared/provenance.ts` enforce a source hierarchy:

- **Transcript** > **Notes** > **Website** > **AI Inference** > **Manual**

Fields extracted from higher-priority sources are not overwritten by lower-priority sources. Provenance violations are logged and blocked during enrichment.

## Configuration

Key configuration constants:

| Constant                  | Value   | Location                           |
|--------------------------|---------|------------------------------------|
| MAX_ATTEMPTS (deal queue)| 3       | `process-enrichment-queue`         |
| MAX_ATTEMPTS (buyer queue)| 3      | `process-buyer-enrichment-queue`   |
| CONCURRENCY_LIMIT        | 5       | `process-enrichment-queue`         |
| MAX_FUNCTION_RUNTIME_MS  | 140000  | Queue processors                   |
| EDGE_FUNCTION_LIMIT_MS   | 58000   | `_shared/edge-timeout.ts`          |
| AI timeout               | 45000ms | `ai-providers.ts`                  |
| Scrape timeout (buyer)   | varies  | `buyer-extraction.ts`              |
