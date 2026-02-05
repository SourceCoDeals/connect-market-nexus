# Connect Market Nexus - Edge Function API Reference

> **89 Supabase Edge Functions** organized by category. All functions run on the Deno runtime.
>
> **Base URL**: `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/`
>
> **Authentication**: Most endpoints require a Bearer token (Supabase JWT) in the `Authorization` header.

---

## Table of Contents

1. [AI & Enrichment Functions](#1-ai--enrichment-functions)
2. [Scoring & Matching Functions](#2-scoring--matching-functions)
3. [Chat & Query Functions](#3-chat--query-functions)
4. [Data Import & Mapping Functions](#4-data-import--mapping-functions)
5. [Email Functions](#5-email-functions)
6. [Notification Functions](#6-notification-functions)
7. [Security & Authentication Functions](#7-security--authentication-functions)
8. [Session & Tracking Functions](#8-session--tracking-functions)
9. [Admin & Analytics Functions](#9-admin--analytics-functions)
10. [External Scraping Functions](#10-external-scraping-functions)
11. [Background Processing Functions](#11-background-processing-functions)
12. [Utility Functions](#12-utility-functions)
13. [Shared Modules](#13-shared-modules-_shared)

---

## 1. AI & Enrichment Functions

### `enrich-buyer`
Enriches a buyer record with AI-extracted data from web sources. Runs 6 parallel AI calls via `Promise.allSettled` for business overview, customer profile, geography, acquisitions, PE activity, and portfolio analysis.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |
| **AI Model** | Gemini 2.0 Flash |
| **Timeout** | ~60s (parallelized from ~120s sequential) |

**Request Body:**
```json
{
  "buyerId": "uuid",
  "universeId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "buyer": { /* enriched buyer object */ },
  "enrichmentResults": {
    "businessOverview": "...",
    "customerProfile": "...",
    "geography": "...",
    "acquisitions": "...",
    "peActivity": "...",
    "portfolio": "..."
  }
}
```

---

### `enrich-deal`
Enriches a deal record with AI-extracted business data. Pulls web data and uses AI to extract structured fields (revenue, EBITDA, employees, locations, services, etc.).

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "dealId": "uuid"
}
```

**Response:** `200 OK` — Enriched deal object with validated fields.

---

### `enrich-geo-data`
Enriches geographic data for a deal or buyer, normalizing state codes, detecting local context, and geocoding addresses.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "entityId": "uuid",
  "entityType": "deal" | "buyer"
}
```

---

### `enrich-session-metadata`
Enriches a user session with metadata including device, browser, and location information.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

**Request Body:**
```json
{
  "sessionId": "uuid"
}
```

---

### `extract-buyer-criteria`
Extracts structured buyer acquisition criteria (size, services, geography, buyer types) from an M&A guide using Claude AI. Returns confidence scores per category.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |
| **AI Model** | Claude Sonnet 4 |
| **Features** | Retry logic for low confidence, relaxed scoring for qualitative guides |

**Request Body:**
```json
{
  "universeId": "uuid",
  "guideContent": "string (full M&A guide text)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "criteria": {
    "size_criteria": { "revenue_min": 5000000, "confidence_score": 85 },
    "service_criteria": { "target_services": [...], "confidence_score": 90 },
    "geography_criteria": { "target_states": [...], "confidence_score": 75 },
    "buyer_types_criteria": { "buyer_types": [...], "confidence_score": 80 }
  },
  "overall_confidence": 82.5
}
```

---

### `extract-buyer-criteria-background`
Background version of criteria extraction. Returns 202 immediately and processes asynchronously. Frontend polls `buyer_criteria_extractions` table for progress.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin or service role |
| **AI Model** | Claude Sonnet 4 |
| **Features** | Background processing, database polling |

**Request Body:**
```json
{
  "universeId": "uuid",
  "guideContent": "string"
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "message": "Extraction started in background",
  "extractionId": "uuid"
}
```

---

### `extract-buyer-transcript`
Extracts structured data from a buyer transcript (call notes, meeting transcripts). Parses acquisition criteria, investment thesis, and deal preferences.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "transcriptId": "uuid",
  "content": "string"
}
```

---

### `extract-deal-document`
Extracts structured deal information from uploaded documents (CIMs, teasers, financial summaries).

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "documentUrl": "string",
  "dealId": "uuid"
}
```

---

### `extract-deal-transcript`
Extracts deal-related data from transcripts of calls or meetings about specific deals.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "transcriptId": "uuid",
  "dealId": "uuid"
}
```

---

### `extract-transcript`
General-purpose transcript extraction. Parses any transcript and extracts structured information based on context.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "content": "string",
  "type": "buyer" | "deal" | "general"
}
```

---

### `generate-buyer-intro`
Generates a personalized buyer introduction email or message using AI, based on the buyer profile and deal details.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "buyerId": "uuid",
  "dealId": "uuid",
  "universeId": "uuid",
  "template": "string (optional)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "introduction": {
    "subject": "string",
    "body": "string"
  }
}
```

---

### `generate-ma-guide`
Generates a comprehensive 13-phase M&A industry guide using AI. Streams response via SSE (Server-Sent Events). This is the synchronous version — may timeout for large guides.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |
| **AI Model** | Gemini 2.0 Pro |
| **Response Type** | SSE (text/event-stream) |
| **Duration** | 60-150+ seconds |

**Request Body:**
```json
{
  "universeId": "uuid",
  "industry": "string",
  "context": "string (optional additional context)"
}
```

**SSE Events:**
```
data: {"phase": 1, "title": "Industry Overview", "content": "..."}
data: {"phase": 2, "title": "Market Size & Growth", "content": "..."}
...
data: {"phase": 13, "title": "Conclusion", "content": "..."}
data: {"complete": true}
```

---

### `generate-ma-guide-background`
Background version of M&A guide generation. Returns 202 immediately and processes asynchronously. Creates a tracking record in `ma_guide_generations` table.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |
| **AI Model** | Gemini 2.0 Pro |
| **Features** | Background processing, progress tracking |

**Request Body:**
```json
{
  "universeId": "uuid",
  "industry": "string"
}
```

**Response:** `202 Accepted`
```json
{
  "success": true,
  "message": "Guide generation started in background",
  "generationId": "uuid"
}
```

**Progress polling:** Query `ma_guide_generations` table where `id = generationId`. Fields: `status`, `current_phase`, `total_phases`, `content`, `error`.

---

### `generate-research-questions`
Generates AI-powered research questions for a deal or buyer to guide further investigation.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "entityId": "uuid",
  "entityType": "deal" | "buyer",
  "context": "string"
}
```

---

### `clarify-industry`
Uses AI to clarify and standardize industry classifications for deals or buyers.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "description": "string",
  "currentIndustry": "string (optional)"
}
```

---

### `parse-fit-criteria`
Parses natural language fit criteria into structured scoring rules. Converts text like "must have $5M+ revenue in the Southeast" into machine-readable criteria.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "criteria": "string (natural language)",
  "universeId": "uuid"
}
```

---

### `parse-scoring-instructions`
Parses natural language scoring instructions into structured scoring parameters for the deal matching engine.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "instructions": "string",
  "universeId": "uuid"
}
```

---

### `parse-tracker-documents`
Parses uploaded documents for M&A intelligence trackers, extracting deal and buyer information.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

---

## 2. Scoring & Matching Functions

### `score-buyer-deal`
Comprehensive buyer-deal scoring function. Evaluates fit across multiple dimensions including industry alignment, geography, size, services, and more. One of the largest functions (~1,700 lines).

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "buyerId": "uuid",
  "dealId": "uuid",
  "universeId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "score": {
    "overall": 78,
    "industry_fit": 85,
    "geography_fit": 70,
    "size_fit": 80,
    "service_fit": 75,
    "reasoning": "string"
  }
}
```

---

### `score-industry-alignment`
Scores a buyer's industry alignment against the M&A guide. Reads the full guide content (no character limit). M&A guide is mandatory — returns 400 if missing.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "buyerId": "uuid",
  "universeId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "score": 85,
  "reasoning": "string",
  "alignment_details": { /* detailed breakdown */ }
}
```

**Error:** `400` if M&A guide is not generated for the universe.

---

### `score-buyer-geography`
Scores geographic alignment between a buyer's coverage area and a deal's location.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "buyerId": "uuid",
  "dealId": "uuid"
}
```

---

### `score-service-fit`
Scores service/offering alignment between a buyer's capabilities and a deal's services.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "buyerId": "uuid",
  "dealId": "uuid"
}
```

---

### `calculate-deal-quality`
Calculates an overall quality score for a deal based on data completeness, financial metrics, and market positioning.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

**Request Body:**
```json
{
  "dealId": "uuid"
}
```

---

### `validate-criteria`
Validates extracted buyer criteria against business rules and data quality standards.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

**Request Body:**
```json
{
  "criteria": { /* BuyerCriteria object */ },
  "universeId": "uuid"
}
```

---

### `suggest-universe`
Suggests which buyer universe(s) a deal or buyer should be assigned to based on industry and characteristics.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "entityId": "uuid",
  "entityType": "deal" | "buyer"
}
```

---

### `query-buyer-universe`
Queries and filters buyers within a universe based on criteria, scores, and other attributes.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

**Request Body:**
```json
{
  "universeId": "uuid",
  "filters": {
    "minScore": 70,
    "geography": ["FL", "TX"],
    "buyerType": "pe_firm"
  }
}
```

---

### `update-fit-criteria-chat`
Updates buyer fit criteria through a conversational AI interface. Allows natural language updates to scoring criteria.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "universeId": "uuid",
  "message": "string (natural language update)"
}
```

---

### `dedupe-buyers`
Identifies and merges duplicate buyer records using fuzzy matching on name, website, and other fields.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |

**Request Body:**
```json
{
  "universeId": "uuid",
  "dryRun": true
}
```

---

## 3. Chat & Query Functions

### `chat-remarketing`
AI chat assistant for the remarketing module. Answers questions about buyers, deals, scores, and universes using database context. Context is optimized to ~25KB (reduced from ~300KB).

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |
| **Features** | Context-optimized queries (50-60 buyers, 12-14 fields per buyer) |

**Request Body:**
```json
{
  "message": "string",
  "universeId": "uuid",
  "conversationId": "uuid (optional)"
}
```

**Response:** `200 OK`
```json
{
  "response": "string (AI response)",
  "conversationId": "uuid"
}
```

---

### `chat-buyer-query`
AI chat for querying buyer information. Provides natural language access to buyer data and scoring information.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "message": "string",
  "buyerId": "uuid (optional)",
  "universeId": "uuid (optional)"
}
```

---

### `analyze-deal-notes`
AI analysis of deal notes to extract insights, action items, and risk factors.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "dealId": "uuid"
}
```

---

### `analyze-tracker-notes`
AI analysis of tracker notes for M&A intelligence insights.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

---

### `analyze-scoring-patterns`
Analyzes scoring patterns across buyers and deals to identify trends and anomalies.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |

---

### `analyze-seller-interest`
Analyzes seller interest signals based on engagement data, page views, and communication patterns.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

---

## 4. Data Import & Mapping Functions

### `bulk-import-remarketing`
Handles bulk CSV import of buyers into a remarketing universe. Processes large files with batch inserts.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |

**Request Body:**
```json
{
  "universeId": "uuid",
  "data": [ /* array of buyer objects */ ],
  "mappings": { /* column mappings */ }
}
```

---

### `import-reference-data`
Imports reference data (industry classifications, geographic regions, etc.) into the platform.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |

---

### `map-csv-columns`
AI-powered column mapping for CSV imports. Suggests mappings between CSV headers and database fields.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

**Request Body:**
```json
{
  "headers": ["Company Name", "Revenue ($M)", "State"],
  "sampleRows": [ /* 3-5 sample rows */ ],
  "targetEntity": "buyer" | "deal"
}
```

---

### `map-deal-csv-columns`
AI-powered column mapping specifically for deal CSV imports.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

---

### `map-contact-columns`
AI-powered column mapping for contact CSV imports.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **AI Model** | Gemini 2.0 Flash |

---

## 5. Email Functions

All email functions use the **Resend** email service for delivery.

### `send-email-notification`
General-purpose email notification sender. Sends templated emails for various platform events.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role or admin |
| **Service** | Resend |

**Request Body:**
```json
{
  "to": "email@example.com",
  "subject": "string",
  "html": "string",
  "from": "string (optional)"
}
```

---

### `enhanced-email-delivery`
Enhanced email delivery with retry logic, delivery tracking, and template rendering. Logs deliveries to `email_delivery_logs`.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role or admin |
| **Service** | Resend |
| **Features** | Retry on failure, delivery logging |

---

### `send-approval-email`
Sends account approval notification to newly approved users.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin or service role |

**Request Body:**
```json
{
  "userId": "uuid",
  "email": "string"
}
```

---

### `send-connection-notification`
Sends notification when a connection request status changes (accepted, declined, etc.).

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `send-contact-response`
Sends email response to a contact inquiry.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |

---

### `send-data-recovery-email`
Sends data recovery instructions to users who need to recover their account data.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `send-deal-alert`
Sends deal alert emails to users who have matching alert criteria.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

**Request Body:**
```json
{
  "dealId": "uuid",
  "alertId": "uuid"
}
```

---

### `send-deal-referral`
Sends deal referral emails to external partners.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |

---

### `send-fee-agreement-email`
Sends fee agreement documents for electronic signature.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |

---

### `send-feedback-email`
Sends feedback collection emails to platform users.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `send-feedback-notification`
Sends notification to admins when new feedback is submitted.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `send-nda-email`
Sends NDA (Non-Disclosure Agreement) documents for signature.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |

---

### `send-notification-email`
Generic notification email sender with template support.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `send-owner-inquiry-notification`
Notifies deal owners when a buyer submits an inquiry about their listing.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `send-owner-intro-notification`
Notifies deal owners about buyer introduction requests.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `send-password-reset-email`
Sends password reset link to users.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None (public endpoint) |

**Request Body:**
```json
{
  "email": "string"
}
```

---

### `send-simple-verification-email`
Sends a simple email verification link to new users.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None (public endpoint) |

---

### `send-task-notification-email`
Sends task assignment and update notifications to team members.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `send-user-notification`
Sends in-app and email notifications to users for various platform events.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `send-verification-email`
Sends full email verification with OTP code.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None (public endpoint) |

---

### `send-verification-success-email`
Sends confirmation email after successful email verification.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

## 6. Notification Functions

### `admin-notification`
Creates in-app notifications for admin users. Stores in `admin_notifications` table.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

**Request Body:**
```json
{
  "adminId": "uuid",
  "title": "string",
  "message": "string",
  "notificationType": "string",
  "actionUrl": "string (optional)"
}
```

---

### `enhanced-admin-notification`
Enhanced admin notification with priority levels, grouping, and read tracking.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `notify-deal-owner-change`
Notifies relevant parties when a deal's owner is changed.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `notify-deal-reassignment`
Notifies team members when a deal is reassigned to a different advisor.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `notify-new-deal-owner`
Sends notification to the new owner when they are assigned a deal.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `notify-remarketing-match`
Notifies admins when a high-scoring buyer-deal match is found during scoring.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `user-journey-notifications`
Sends lifecycle notifications based on user journey milestones.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

## 7. Security & Authentication Functions

### `security-validation`
Validates security tokens and session integrity. Used for critical operations that require additional verification.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

---

### `password-reset`
Handles password reset flow — validates tokens and updates passwords.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None (uses reset token) |

**Request Body:**
```json
{
  "token": "string",
  "newPassword": "string"
}
```

---

### `password-security`
Validates password strength and checks against common password lists.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None |

**Request Body:**
```json
{
  "password": "string"
}
```

---

### `rate-limiter`
General-purpose rate limiter. Returns rate limit status for a given action and identifier.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None |

**Request Body:**
```json
{
  "action": "string",
  "identifier": "string"
}
```

---

### `otp-rate-limiter`
Specialized rate limiter for OTP (One-Time Password) requests. Prevents brute-force attacks on verification codes.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None |

---

### `session-security`
Validates and secures user sessions. Checks for session anomalies and potential unauthorized access.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

---

### `create-lead-user`
Creates a new lead user account with minimal information for inbound lead capture.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None (public endpoint) |

**Request Body:**
```json
{
  "email": "string",
  "name": "string",
  "source": "string (optional)"
}
```

---

## 8. Session & Tracking Functions

### `session-heartbeat`
Keeps user sessions alive and tracks active status. Called periodically from the frontend.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

**Request Body:**
```json
{
  "sessionId": "uuid"
}
```

---

### `track-session`
Records session data including page views, duration, and user actions.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

---

### `track-initial-session`
Records the initial session data when a user first visits the platform. Captures UTM parameters and referral source.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None (captures anonymous sessions) |

---

### `track-engagement-signal`
Records specific engagement signals (clicks, scrolls, time on page) for analytics.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

**Request Body:**
```json
{
  "signalType": "string",
  "entityId": "uuid",
  "entityType": "string",
  "metadata": {}
}
```

---

## 9. Admin & Analytics Functions

### `admin-digest`
Generates a daily admin digest summarizing platform activity, new deals, pending requests, and key metrics.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin or service role |

---

### `aggregate-daily-metrics`
Aggregates daily platform metrics (user activity, deal flow, engagement) and stores in `daily_metrics` table. Typically run via cron job.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role |

---

### `get-feedback-analytics`
Returns aggregated feedback analytics including satisfaction scores, common themes, and trends.

| Property | Value |
|----------|-------|
| **Method** | GET |
| **Auth** | Admin required |

---

### `error-logger`
Centralized error logging endpoint. Records client-side errors for debugging and monitoring.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | None (accepts all errors) |

**Request Body:**
```json
{
  "error": "string",
  "stack": "string (optional)",
  "context": {},
  "url": "string",
  "userId": "uuid (optional)"
}
```

---

## 10. External Scraping Functions

### `apify-google-reviews`
Scrapes Google reviews for a business using the Apify platform. Returns review data for buyer/deal enrichment.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **Service** | Apify |

**Request Body:**
```json
{
  "businessName": "string",
  "location": "string (optional)"
}
```

---

### `apify-linkedin-scrape`
Scrapes LinkedIn profiles and company pages using Apify. Used for buyer enrichment.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **Service** | Apify |

**Request Body:**
```json
{
  "linkedinUrl": "string"
}
```

---

### `firecrawl-scrape`
Scrapes website content using Firecrawl. Returns structured data from web pages for AI processing.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |
| **Service** | Firecrawl |

**Request Body:**
```json
{
  "url": "string",
  "options": {
    "includeMarkdown": true
  }
}
```

---

### `find-buyer-contacts`
Searches for buyer contact information using web scraping and AI extraction.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Admin required |

**Request Body:**
```json
{
  "buyerId": "uuid",
  "companyName": "string",
  "website": "string (optional)"
}
```

---

### `verify-platform-website`
Verifies that a platform/company website is legitimate and accessible. Used during buyer enrichment.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

**Request Body:**
```json
{
  "url": "string"
}
```

---

## 11. Background Processing Functions

### `process-enrichment-queue`
Processes the deal enrichment queue. Claims pending items using `FOR UPDATE SKIP LOCKED` to prevent race conditions. Processes up to 5 items concurrently. Recovers stale items stuck for >10 minutes.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role only |
| **Features** | Concurrent processing (5), stale recovery, race-condition safe |

---

### `process-buyer-enrichment-queue`
Processes the buyer enrichment queue. Same pattern as deal enrichment queue but for buyer records.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Service role or admin |
| **Features** | Concurrent processing, stale recovery |

---

## 12. Utility Functions

### `generate-guide-pdf`
Generates a PDF version of an M&A guide for download/sharing.

| Property | Value |
|----------|-------|
| **Method** | POST |
| **Auth** | Required |

**Request Body:**
```json
{
  "universeId": "uuid"
}
```

---

### `get-mapbox-token`
Returns a Mapbox GL token for the frontend map components. Keeps the token server-side.

| Property | Value |
|----------|-------|
| **Method** | GET |
| **Auth** | Required |

**Response:** `200 OK`
```json
{
  "token": "pk.eyJ1..."
}
```

---

## 13. Shared Modules (`_shared/`)

These modules are imported by edge functions — they are not callable endpoints.

### `ai-client.ts`
Unified AI provider interface supporting Gemini, Claude, and OpenAI.

**Key Exports:**
- `callAI(options: AICallOptions): Promise<AIResponse>` — Main function for all AI calls
- `AIProvider` enum — `GEMINI`, `CLAUDE`, `OPENAI`
- `AIMessage`, `AICallOptions`, `AIResponse` interfaces
- Automatic retry with exponential backoff
- Cost tracking per call

### `ai-providers.ts`
API endpoint URLs, model mappings, and configuration for all AI providers.

**Key Exports:**
- `GEMINI_API_URL`, `OPENAI_API_URL`, `ANTHROPIC_API_URL`
- `DEFAULT_GEMINI_MODEL` = `"gemini-2.0-flash"`
- `DEFAULT_CLAUDE_MODEL` = `"claude-sonnet-4-20250514"`
- `getGeminiModel()`, `getGeminiHeaders()`, `getGeminiNativeUrl()`
- Model mapping from Lovable Gateway names to native model names

### `security.ts`
Rate limiting and SSRF protection.

**Key Exports:**
- `checkRateLimit(action, identifier, supabase): Promise<RateLimitResult>`
- `AI_RATE_LIMITS` — Configuration object (currently set to 999999 = unlimited)
- SSRF protection utilities

### `validation.ts`
Anti-hallucination guards for AI-extracted data.

**Key Exports:**
- `detectPlaceholders(text): boolean` — Detects placeholder text like [TBD], [INSERT], etc.
- `validateRevenue(revenue): ValidationResult`
- `validateEBITDA(ebitda, revenue): ValidationResult`
- `validateEmployeeCount(count): ValidationResult`
- `validateStateCode(stateCode): ValidationResult`
- `crossValidateAddress(address): ValidationResult`
- `rejectUnrealisticValues(data): { cleaned, rejected }`
- `removePlaceholders(data): { cleaned, rejected }`
- `validateExtraction(data, source): { valid, cleaned, errors }` — Comprehensive validation pipeline

### `buyer-criteria-extraction.ts`
Shared extraction logic for buyer criteria from M&A guides.

**Key Exports:**
- `BuyerCriteria` interface — Size, service, geography, and buyer type criteria
- `extractBuyerCriteria(guideContent, supabase): Promise<BuyerCriteria>`
- Retry logic with simplified prompts for low-confidence results
- Inference rules for common industry terms

### `geography.ts`
US state normalization and geographic utilities.

**Key Exports:**
- `normalizeState(input): string` — Converts state names/abbreviations to 2-letter codes
- `STATE_MAPPINGS` — Complete US state mapping (full names + abbreviations)
- Local context detection functions

### `geography-utils.ts`
Additional geographic utility functions for distance calculation and region mapping.

### `criteria-validation.ts`
Validates extracted buyer criteria against quality standards.

### `source-priority.ts`
Defines priority rankings for different data sources (manual > AI-extracted > scraped).

### `admin-profiles.ts`
Utilities for fetching and managing admin profile data.

---

## Error Handling

All edge functions follow a consistent error response format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE (optional)",
  "details": {}
}
```

Common HTTP status codes:
- `200` — Success
- `202` — Accepted (background processing started)
- `400` — Bad Request (missing/invalid parameters)
- `401` — Unauthorized (missing or invalid auth token)
- `403` — Forbidden (insufficient permissions)
- `404` — Not Found
- `429` — Rate Limited
- `500` — Internal Server Error

---

## CORS Configuration

All edge functions include CORS headers for browser access:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

All functions handle `OPTIONS` preflight requests.
