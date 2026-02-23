# SourceCo AI Command Center - Technical Architecture

**Version:** 1.0
**Date:** 2026-02-23

---

## 1. System Architecture Overview

```
                    +------------------------------------------+
                    |        React SPA (Admin Interface)        |
                    |                                          |
                    |  +----------------------------------+    |
                    |  |   AI Command Center Panel        |    |
                    |  |   (Persistent Sidebar/Overlay)   |    |
                    |  |                                  |    |
                    |  |  [Chat Input]                    |    |
                    |  |  [Message History]               |    |
                    |  |  [Conversation List]             |    |
                    |  |  [Feedback Buttons]              |    |
                    |  +----------------------------------+    |
                    +-------------------+----------------------+
                                        |
                                        | HTTPS (Supabase Edge Function)
                                        v
                    +------------------------------------------+
                    |     ai-command-center Edge Function       |
                    |                                          |
                    |  +------------------------------------+  |
                    |  |  1. Auth Layer                      |  |
                    |  |     - JWT validation                |  |
                    |  |     - Admin role check              |  |
                    |  |     - Rate limiting                 |  |
                    |  +------------------------------------+  |
                    |                                          |
                    |  +------------------------------------+  |
                    |  |  2. Intent Router (Claude Haiku)    |  |
                    |  |     - Classify query intent         |  |
                    |  |     - Select tool set               |  |
                    |  |     - Determine model tier          |  |
                    |  +------------------------------------+  |
                    |                                          |
                    |  +------------------------------------+  |
                    |  |  3. Orchestrator (Claude Sonnet)    |  |
                    |  |     - System prompt assembly        |  |
                    |  |     - Tool calling loop             |  |
                    |  |     - Response streaming            |  |
                    |  +------------------------------------+  |
                    |                                          |
                    |  +------------------------------------+  |
                    |  |  4. Tool Execution Layer            |  |
                    |  |     - Database query tools          |  |
                    |  |     - Fireflies API tools           |  |
                    |  |     - Analytics computation tools   |  |
                    |  |     - Cross-system search tools     |  |
                    |  +------------------------------------+  |
                    |                                          |
                    |  +------------------------------------+  |
                    |  |  5. Response Pipeline               |  |
                    |  |     - Citation injection            |  |
                    |  |     - Cost tracking                 |  |
                    |  |     - Conversation persistence      |  |
                    |  +------------------------------------+  |
                    +-------------------+----------------------+
                                        |
                    +-------------------+----------------------+
                    |                                          |
               +----v----+  +--------+  +--------+  +--------+
               | Supabase |  | Claude |  |Fireflies| | Firecrawl|
               | Database |  |  API   |  |  API    | |  API     |
               +----------+  +--------+  +--------+  +----------+
```

---

## 2. Model Strategy: Claude Tiered Architecture

### 2.1 Model Selection Rationale

Claude is chosen as the sole LLM provider for the AI Command Center based on:

1. **Tool use quality:** Claude's tool/function calling is the strongest available for complex multi-tool orchestration. The Command Center requires decomposing natural language into 3-7 sequential or parallel tool calls per query.
2. **Existing ecosystem:** The codebase already uses Claude (Sonnet) for lead memo generation (`generate-lead-memo`). Adding the Command Center keeps the stack unified.
3. **Tiered cost optimization:** Claude's model family (Haiku/Sonnet/Opus) allows routing queries to the appropriate cost/quality tier.
4. **Streaming + tool use:** Claude supports streaming responses while handling tool calls, enabling real-time UX.

### 2.2 Model Tier Assignment

```
                     Query arrives
                          |
                          v
                  +---------------+
                  | Claude Haiku  |  ~$0.001/query
                  | (Router)      |  < 300ms
                  +-------+-------+
                          |
              +-----------+-----------+
              |           |           |
              v           v           v
        +---------+ +---------+ +---------+
        | Haiku   | | Sonnet  | |  Opus   |
        | Simple  | | Standard| | Complex |
        | lookups | | queries | | analysis|
        +---------+ +---------+ +---------+
        ~$0.001     ~$0.01-0.02 ~$0.05-0.10
        < 1s        < 5s        < 12s
```

| Tier | Model | Use Cases | % of Traffic |
|------|-------|-----------|-------------|
| **Tier 1: Router** | claude-haiku-4-5 | Intent classification, tool selection, model routing | 100% (first pass) |
| **Tier 2: Quick** | claude-haiku-4-5 | Simple lookups ("How many active deals?"), single-tool queries, status checks | ~20% |
| **Tier 3: Standard** | claude-sonnet-4 | Multi-tool queries, buyer search, deal analysis, follow-up identification | ~70% |
| **Tier 4: Deep** | claude-opus-4 | Complex synthesis (daily briefings, multi-source analysis, trend comparisons), edge cases where Sonnet struggles | ~10% |

### 2.3 Router Implementation

```typescript
// Intent classification prompt (Haiku)
const ROUTER_PROMPT = `You are a query router for an M&A deal management system.

Classify the user's query into exactly one category and select the appropriate model tier.

Categories:
- DEAL_STATUS: Pipeline stage, deal progress, activity summaries
- FOLLOW_UP: Who needs follow-up, overdue tasks, response tracking
- BUYER_SEARCH: Find buyers by criteria, cross-source search
- BUYER_ANALYSIS: Score breakdowns, fit analysis, buyer profiles
- MEETING_INTEL: Transcript queries, meeting summaries, action items
- PIPELINE_ANALYTICS: Aggregate metrics, trends, comparisons
- DAILY_BRIEFING: Morning briefing, comprehensive summaries
- GENERAL: Greetings, help, clarification requests

Model tier rules:
- QUICK (Haiku): Single-table lookups, yes/no questions, simple counts
- STANDARD (Sonnet): Multi-table queries, analysis, search
- DEEP (Opus): Cross-system synthesis, daily briefings, complex comparisons

Respond with JSON:
{
  "category": "CATEGORY_NAME",
  "model_tier": "QUICK|STANDARD|DEEP",
  "tools_needed": ["tool1", "tool2"],
  "confidence": 0.0-1.0
}`;
```

---

## 3. Tool Catalog

### 3.1 Tool Design Principles

1. **Atomic operations:** Each tool does one thing well
2. **Structured output:** Tools return JSON, not free text
3. **Error handling:** Every tool returns `{ data, error }` pattern
4. **Pagination:** Large result sets are paginated (default limit: 50)
5. **Timeout protection:** Each tool has a 10-second timeout

### 3.2 Complete Tool Definitions

#### Category 1: Deal Pipeline Tools

```typescript
// Tool: query_deals
{
  name: "query_deals",
  description: "Query deals from the pipeline with flexible filters. Use for questions about deal status, stage, owner, priority, or activity.",
  input_schema: {
    type: "object",
    properties: {
      owner_id: { type: "string", description: "Filter by deal owner UUID. Use 'CURRENT_USER' for the asking user's deals." },
      stage_name: { type: "string", description: "Filter by stage name (fuzzy match). E.g., 'LOI', 'Due Diligence', 'Closed'." },
      status: { type: "string", enum: ["active", "won", "lost", "stalled"], description: "Filter by deal status." },
      priority: { type: "string", enum: ["high", "medium", "low"] },
      min_activity_days: { type: "number", description: "Only deals with activity in the last N days." },
      max_inactivity_days: { type: "number", description: "Only deals with NO activity in the last N days (stale detection)." },
      listing_search: { type: "string", description: "Search listing title or internal company name." },
      order_by: { type: "string", enum: ["recent_activity", "stage_order", "created_date", "priority"], default: "recent_activity" },
      limit: { type: "number", default: 20 }
    }
  }
}

// Tool: get_deal_details
{
  name: "get_deal_details",
  description: "Get comprehensive details for a specific deal including listing, buyer, stage, activities, tasks, and notes.",
  input_schema: {
    type: "object",
    properties: {
      deal_id: { type: "string", description: "Deal UUID" },
      listing_id: { type: "string", description: "Listing UUID (alternative to deal_id)" },
      deal_name: { type: "string", description: "Deal/company name for fuzzy search" },
      include_activities: { type: "boolean", default: true },
      include_tasks: { type: "boolean", default: true },
      include_notes: { type: "boolean", default: false },
      activity_days: { type: "number", default: 30, description: "How many days of activities to include" }
    },
    required: [] // At least one of deal_id, listing_id, or deal_name required
  }
}

// Tool: get_deal_activities
{
  name: "get_deal_activities",
  description: "Get activity timeline for a deal. Use for 'what happened on deal X' questions.",
  input_schema: {
    type: "object",
    properties: {
      deal_id: { type: "string" },
      listing_id: { type: "string" },
      since: { type: "string", description: "ISO date string. Activities after this date." },
      activity_types: { type: "array", items: { type: "string" }, description: "Filter by activity type." },
      limit: { type: "number", default: 50 }
    }
  }
}

// Tool: get_deal_tasks
{
  name: "get_deal_tasks",
  description: "Get tasks for deals. Use for overdue task questions and follow-up identification.",
  input_schema: {
    type: "object",
    properties: {
      assigned_to: { type: "string", description: "UUID or 'CURRENT_USER'" },
      deal_id: { type: "string" },
      status: { type: "string", enum: ["pending", "in_progress", "completed"] },
      overdue_only: { type: "boolean", default: false },
      due_before: { type: "string", description: "ISO date. Tasks due before this date." },
      due_after: { type: "string", description: "ISO date. Tasks due after this date." }
    }
  }
}

// Tool: get_pipeline_summary
{
  name: "get_pipeline_summary",
  description: "Get aggregate pipeline statistics: deal counts by stage, total values, conversion rates.",
  input_schema: {
    type: "object",
    properties: {
      owner_id: { type: "string", description: "Filter by owner. 'CURRENT_USER' for asking user." },
      date_range: { type: "string", description: "Time period: 'this_week', 'this_month', 'this_quarter', 'last_30_days'" }
    }
  }
}
```

#### Category 2: Buyer Intelligence Tools

```typescript
// Tool: search_buyers
{
  name: "search_buyers",
  description: "Search for buyers across remarketing_buyers and marketplace profiles. Supports filtering by geography, services, size, type, and more.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search across company name, PE firm name, services" },
      geographies: { type: "array", items: { type: "string" }, description: "State codes to filter by" },
      services: { type: "array", items: { type: "string" }, description: "Service/industry keywords" },
      buyer_types: { type: "array", items: { type: "string" }, description: "e.g., ['Private Equity', 'Strategic']" },
      min_revenue: { type: "number" },
      max_revenue: { type: "number" },
      has_fee_agreement: { type: "boolean" },
      min_acquisition_appetite: { type: "string" },
      min_data_completeness: { type: "number" },
      include_marketplace: { type: "boolean", default: false, description: "Also search marketplace profiles" },
      limit: { type: "number", default: 25 }
    }
  }
}

// Tool: get_buyer_profile
{
  name: "get_buyer_profile",
  description: "Get comprehensive buyer profile including contacts, scores, outreach history, and transcripts.",
  input_schema: {
    type: "object",
    properties: {
      buyer_id: { type: "string" },
      buyer_name: { type: "string", description: "Company name for fuzzy search" },
      include_scores: { type: "boolean", default: true },
      include_contacts: { type: "boolean", default: true },
      include_outreach: { type: "boolean", default: true },
      include_transcripts: { type: "boolean", default: true }
    }
  }
}

// Tool: get_score_breakdown
{
  name: "get_score_breakdown",
  description: "Get detailed scoring breakdown for a buyer-deal pair.",
  input_schema: {
    type: "object",
    properties: {
      buyer_id: { type: "string" },
      listing_id: { type: "string" }
    },
    required: ["buyer_id", "listing_id"]
  }
}

// Tool: get_top_buyers_for_deal
{
  name: "get_top_buyers_for_deal",
  description: "Get the highest-scored buyers for a specific deal, with score breakdowns.",
  input_schema: {
    type: "object",
    properties: {
      listing_id: { type: "string" },
      tier_filter: { type: "string", enum: ["A", "B", "C", "D", "F"] },
      status_filter: { type: "string", enum: ["pending", "approved", "passed", "hidden"] },
      limit: { type: "number", default: 20 }
    },
    required: ["listing_id"]
  }
}
```

#### Category 3: Lead Source Tools

```typescript
// Tool: search_lead_sources
{
  name: "search_lead_sources",
  description: "Search across all lead sources: inbound leads, valuation leads, CapTarget, GP Partners. Use for cross-source deal discovery.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search" },
      industries: { type: "array", items: { type: "string" } },
      geographies: { type: "array", items: { type: "string" } },
      sources: { type: "array", items: { type: "string" }, description: "Filter by source: 'inbound', 'valuation', 'captarget', 'gp_partner'" },
      min_revenue: { type: "number" },
      max_revenue: { type: "number" },
      limit: { type: "number", default: 25 }
    }
  }
}

// Tool: search_industry_trackers
{
  name: "search_industry_trackers",
  description: "Search M&A intelligence trackers for industry-specific data.",
  input_schema: {
    type: "object",
    properties: {
      industry: { type: "string" },
      query: { type: "string" }
    }
  }
}
```

#### Category 4: Meeting & Transcript Tools

```typescript
// Tool: search_transcripts
{
  name: "search_transcripts",
  description: "Search call/deal/buyer transcripts for keywords, topics, or specific content. Searches key_quotes, extracted_insights, and transcript text.",
  input_schema: {
    type: "object",
    properties: {
      listing_id: { type: "string", description: "Filter to transcripts for a specific deal" },
      buyer_id: { type: "string", description: "Filter to transcripts for a specific buyer" },
      keywords: { type: "array", items: { type: "string" }, description: "Search terms" },
      ceo_only: { type: "boolean", description: "Only transcripts where CEO was detected" },
      since: { type: "string", description: "ISO date. Only transcripts after this date." },
      limit: { type: "number", default: 10 }
    }
  }
}

// Tool: search_fireflies
{
  name: "search_fireflies",
  description: "Search Fireflies.ai meetings for transcripts, action items, and summaries. Use when local transcripts are insufficient or for meeting scheduling questions.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keywords" },
      participant_name: { type: "string", description: "Filter by participant name" },
      since: { type: "string", description: "ISO date" },
      limit: { type: "number", default: 10 }
    }
  }
}

// Tool: get_meeting_action_items
{
  name: "get_meeting_action_items",
  description: "Get action items from recent meetings via Fireflies and local transcripts.",
  input_schema: {
    type: "object",
    properties: {
      user_name: { type: "string", description: "Filter action items assigned to this person" },
      since: { type: "string", description: "ISO date" },
      deal_id: { type: "string", description: "Filter to a specific deal" }
    }
  }
}
```

#### Category 5: Outreach & Communication Tools

```typescript
// Tool: get_outreach_status
{
  name: "get_outreach_status",
  description: "Get outreach status for buyers on a deal. Use for follow-up tracking and response monitoring.",
  input_schema: {
    type: "object",
    properties: {
      listing_id: { type: "string" },
      buyer_id: { type: "string" },
      status: { type: "string", enum: ["sent", "delivered", "opened", "responded", "no_response"] },
      days_since_sent: { type: "number", description: "Filter to outreach sent N+ days ago" },
      limit: { type: "number", default: 50 }
    }
  }
}

// Tool: get_connection_requests
{
  name: "get_connection_requests",
  description: "Get marketplace connection requests. Use for buyer interest and engagement queries.",
  input_schema: {
    type: "object",
    properties: {
      listing_id: { type: "string" },
      status: { type: "string", enum: ["pending", "approved", "rejected"] },
      since: { type: "string" },
      limit: { type: "number", default: 25 }
    }
  }
}
```

#### Category 6: Analytics & Metrics Tools

```typescript
// Tool: get_analytics
{
  name: "get_analytics",
  description: "Get platform analytics: marketplace metrics, engagement stats, conversion rates.",
  input_schema: {
    type: "object",
    properties: {
      metric_type: { type: "string", enum: ["marketplace", "engagement", "pipeline", "connections", "activity"] },
      date_range: { type: "string", description: "'this_week', 'this_month', 'this_quarter', 'last_30_days', 'last_90_days'" },
      compare_previous: { type: "boolean", default: false, description: "Include previous period for comparison" }
    },
    required: ["metric_type"]
  }
}
```

#### Category 7: User Context Tools

```typescript
// Tool: get_current_user_context
{
  name: "get_current_user_context",
  description: "Get the current user's profile, owned deals, assigned tasks, and team context. Always call this first for personalized queries.",
  input_schema: {
    type: "object",
    properties: {
      include_deals: { type: "boolean", default: true },
      include_tasks: { type: "boolean", default: true },
      include_team: { type: "boolean", default: false }
    }
  }
}
```

### 3.3 Tool Execution Pipeline

```
Query: "Who do I need to follow up with?"

Step 1: Router (Haiku) -> { category: "FOLLOW_UP", model_tier: "STANDARD", tools: ["get_current_user_context", "get_deal_tasks", "get_outreach_status", "get_meeting_action_items"] }

Step 2: Orchestrator (Sonnet) calls tools:
  Call 1: get_current_user_context({ include_deals: true, include_tasks: true })
    -> { user: { id: "uuid", name: "Sarah", deals: [...] }, tasks: [...] }

  Call 2 (parallel):
    a) get_deal_tasks({ assigned_to: "CURRENT_USER", overdue_only: true })
       -> { tasks: [{ title: "Send LOI", deal: "Acme Corp", due_date: "2026-02-20", days_overdue: 3 }, ...] }
    b) get_outreach_status({ days_since_sent: 7 })
       -> { outreach: [{ buyer: "Summit Capital", deal: "Acme Corp", sent_date: "2026-02-10", status: "no_response" }, ...] }
    c) get_meeting_action_items({ user_name: "Sarah", since: "2026-02-16" })
       -> { items: [{ meeting: "Acme Corp Intro Call", action: "Send revised terms", assigned: "Sarah" }, ...] }

Step 3: Orchestrator synthesizes response:
  "Here are your follow-ups, prioritized by urgency:

  **Overdue Tasks (3):**
  1. Send LOI for Acme Corp - 3 days overdue
  2. Review data room for Beta Services - 1 day overdue
  3. Update scoring for Gamma Corp - 1 day overdue

  **Buyers Awaiting Response (5):**
  1. Summit Capital on Acme Corp - sent 13 days ago, no response
  2. Greenfield Advisors on Beta Services - sent 10 days ago, no response
  ...

  **Meeting Action Items (2):**
  1. Send revised terms to Acme Corp buyer (from Feb 18 call)
  2. Schedule data room access for Delta Partners (from Feb 17 call)

  Would you like me to draft follow-up emails for any of these?"
```

---

## 4. Edge Function Design

### 4.1 Primary Edge Function: `ai-command-center`

```typescript
// supabase/functions/ai-command-center/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { routeQuery } from "./router.ts";
import { executeQuery } from "./orchestrator.ts";
import { trackUsage } from "./usage-tracker.ts";
import { saveConversation } from "../_shared/chat-persistence.ts";

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);

  // 1. Auth
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const auth = await requireAdmin(req, supabase);
  if (!auth.isAdmin) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.authenticated ? 403 : 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 2. Parse request
  const {
    query,
    messages = [],
    conversationId,
    context = {},  // { type: 'deal', dealId, dealName } etc.
  } = await req.json();

  if (!query || query.length > 2000) {
    return new Response(JSON.stringify({ error: 'Invalid query' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 3. Rate limiting
  // ... (check user quota)

  // 4. Route query (Haiku)
  const route = await routeQuery(query, messages, context);

  // 5. Execute with streaming
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Start streaming response
  const responsePromise = executeQuery({
    query,
    messages,
    context,
    route,
    userId: auth.userId,
    supabase,
    onToken: async (token: string) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`));
    },
    onToolCall: async (toolName: string, args: any) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', tool: toolName })}\n\n`));
    },
    onComplete: async (result: any) => {
      // Track usage
      await trackUsage(supabase, {
        userId: auth.userId,
        conversationId,
        model: route.model_tier,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        toolCalls: result.toolCalls,
        latencyMs: result.latencyMs,
      });

      // Save conversation
      await saveConversation(supabase, {
        userId: auth.userId,
        context,
        messages: [...messages, { role: 'user', content: query }, { role: 'assistant', content: result.content }],
        conversationId,
      });

      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done', usage: result.usage })}\n\n`));
      await writer.close();
    },
  });

  return new Response(stream.readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
});
```

### 4.2 Module Structure

```
supabase/functions/
├── ai-command-center/
│   ├── index.ts                 # Main entry point
│   ├── router.ts                # Intent classification (Haiku)
│   ├── orchestrator.ts          # Query execution (Sonnet/Opus)
│   ├── system-prompt.ts         # System prompt assembly
│   ├── usage-tracker.ts         # Token & cost tracking
│   └── tools/
│       ├── deal-tools.ts        # Deal pipeline tools
│       ├── buyer-tools.ts       # Buyer intelligence tools
│       ├── lead-tools.ts        # Lead source tools
│       ├── transcript-tools.ts  # Meeting/transcript tools
│       ├── outreach-tools.ts    # Outreach/communication tools
│       ├── analytics-tools.ts   # Analytics tools
│       ├── user-tools.ts        # User context tools
│       └── index.ts             # Tool registry & executor
├── _shared/
│   ├── ai-providers.ts          # (existing) Anthropic/Gemini config
│   ├── chat-persistence.ts      # (existing) Conversation save/load
│   ├── chat-tools.ts            # (existing) Legacy tool definitions
│   ├── auth.ts                  # (existing) Auth guards
│   ├── cors.ts                  # (existing) CORS
│   └── rate-limiter.ts          # (existing) Rate limiting
```

---

## 5. System Prompt Architecture

### 5.1 Prompt Structure

```
[IDENTITY]
You are the SourceCo AI Command Center, an M&A intelligence assistant...

[USER CONTEXT]
Current user: {name}, Role: {role}
Owned deals: {deal_list}
Team: {team_members}
Current page context: {deal/buyer if on specific page}

[CAPABILITIES]
You have access to the following tools: {tool_list}
You can query: deals, buyers, transcripts, outreach, analytics, Fireflies meetings

[DATA GROUNDING RULES]
- NEVER fabricate data. Only reference data returned by tools.
- ALWAYS cite sources: "Based on 3 call transcripts from January..."
- When data is missing, say "I don't have [X] data" explicitly
- Use confidence language: "Based on available data..."
- If a buyer's data completeness < 50%, mention this limitation

[TOOL USE RULES]
- Always call get_current_user_context first for personalized queries
- Use parallel tool calls when queries span multiple domains
- Limit to 7 tool calls per query to control cost
- If initial results are insufficient, ask the user for clarification rather than making speculative queries

[RESPONSE FORMAT]
- Use markdown formatting for readability
- Bold key names, scores, and dates
- Use bullet points for lists
- Include deal identifiers (D-XXXX) when referencing deals
- Limit responses to 500 words unless the user asks for detail

[DOMAIN KNOWLEDGE]
- Score tiers: A (80-100), B (60-79), C (40-59), D (20-39), F (0-19)
- Pipeline stages: {stage_list}
- Buyer types: Private Equity, Strategic, Family Office, Independent Sponsor, Search Fund
- Lead sources: Marketplace, CapTarget, GP Partners, Valuation Leads, Referrals, Manual
- Geographic regions: Northeast, Southeast, Midwest, Southwest, West
```

### 5.2 Dynamic Context Injection

```typescript
function buildSystemPrompt(userId: string, userProfile: any, pageContext: any): string {
  let prompt = BASE_SYSTEM_PROMPT;

  // Inject user context
  prompt += `\n\nCURRENT USER:\n`;
  prompt += `Name: ${userProfile.first_name} ${userProfile.last_name}\n`;
  prompt += `Email: ${userProfile.email}\n`;
  prompt += `User ID: ${userId}\n`;

  // Inject page context if available
  if (pageContext?.type === 'deal') {
    prompt += `\nPAGE CONTEXT: You are on the detail page for deal "${pageContext.dealName}" (ID: ${pageContext.dealId}). `;
    prompt += `When the user says "this deal", they mean this one.\n`;
  } else if (pageContext?.type === 'buyer') {
    prompt += `\nPAGE CONTEXT: You are on the profile page for buyer "${pageContext.buyerName}" (ID: ${pageContext.buyerId}). `;
    prompt += `When the user says "this buyer", they mean this one.\n`;
  }

  // Inject current date for time-relative queries
  prompt += `\nCURRENT DATE: ${new Date().toISOString().split('T')[0]}\n`;
  prompt += `TODAY IS: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;

  return prompt;
}
```

---

## 6. Anthropic Claude API Integration

### 6.1 API Client Configuration

```typescript
// supabase/functions/_shared/claude-client.ts

import { fetchWithAutoRetry } from './ai-providers.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: any;
  tool_use_id?: string;
  content?: string;
}

interface ClaudeStreamOptions {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  messages: ClaudeMessage[];
  tools?: any[];
  onToken: (token: string) => Promise<void>;
  onToolUse: (id: string, name: string, input: any) => Promise<void>;
  onComplete: (usage: { input_tokens: number; output_tokens: number }) => Promise<void>;
  timeoutMs?: number;
}

export async function streamClaudeWithTools(options: ClaudeStreamOptions): Promise<{
  content: string;
  toolCalls: { name: string; input: any; result: any }[];
  usage: { input_tokens: number; output_tokens: number };
}> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  const response = await fetchWithAutoRetry(
    ANTHROPIC_API_URL,
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens,
        system: options.systemPrompt,
        messages: options.messages,
        tools: options.tools,
        stream: true,
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 60000),
    },
    { maxRetries: 2, baseDelayMs: 2000, callerName: `Claude/${options.model}` }
  );

  // Process SSE stream
  // ... (streaming implementation)
}
```

### 6.2 Tool Calling Loop

```typescript
// supabase/functions/ai-command-center/orchestrator.ts

export async function executeQuery(params: ExecuteParams): Promise<QueryResult> {
  const { query, messages, context, route, userId, supabase, onToken, onToolCall, onComplete } = params;

  const systemPrompt = buildSystemPrompt(userId, context);
  const model = getModelForTier(route.model_tier);
  const tools = getToolsForCategory(route.category, route.tools_needed);

  let conversationMessages: ClaudeMessage[] = [
    ...messages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: query }
  ];

  let fullContent = '';
  let allToolCalls: ToolCallRecord[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const startTime = Date.now();

  // Tool calling loop (max 5 iterations)
  for (let iteration = 0; iteration < 5; iteration++) {
    const response = await callClaude({
      model,
      maxTokens: 4096,
      systemPrompt,
      messages: conversationMessages,
      tools: iteration < 4 ? tools : undefined, // No tools on last iteration
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Process response content blocks
    let hasToolUse = false;
    const assistantContent: ContentBlock[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        fullContent += block.text;
        await onToken(block.text);
        assistantContent.push(block);
      } else if (block.type === 'tool_use') {
        hasToolUse = true;
        await onToolCall(block.name, block.input);

        // Execute tool
        const toolResult = await executeToolCall(supabase, block.name, block.input, userId);
        allToolCalls.push({ name: block.name, input: block.input, result: toolResult });

        assistantContent.push(block);

        // Add tool result to conversation
        conversationMessages.push({
          role: 'assistant',
          content: assistantContent
        });
        conversationMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(toolResult)
          }]
        });
      }
    }

    // If no tool use, we're done
    if (!hasToolUse) break;
  }

  const latencyMs = Date.now() - startTime;

  await onComplete({
    content: fullContent,
    toolCalls: allToolCalls,
    usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
    latencyMs,
  });

  return { content: fullContent, toolCalls: allToolCalls, usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens }, latencyMs };
}
```

---

## 7. Frontend Architecture

### 7.1 Component Hierarchy

```
AdminLayout
  |-- AICommandCenterProvider (Context)
  |     |-- state: isOpen, conversationId, messages, context
  |     |-- actions: sendMessage, startNewChat, loadConversation
  |
  |-- AICommandCenterTrigger (Floating button + Cmd+K shortcut)
  |
  |-- AICommandCenterPanel (Sliding panel from right)
        |-- ConversationHeader
        |     |-- Title (auto-generated)
        |     |-- New Chat button
        |     |-- History toggle
        |
        |-- ConversationHistory (collapsible list)
        |     |-- ConversationItem (click to load)
        |
        |-- MessageList
        |     |-- UserMessage
        |     |-- AssistantMessage
        |     |     |-- MarkdownRenderer
        |     |     |-- ToolCallIndicator ("Searching deals...")
        |     |     |-- FeedbackButtons (thumbs up/down)
        |     |     |-- CitationLinks
        |     |
        |     |-- TypingIndicator
        |
        |-- ChatInput
              |-- TextArea (auto-resize)
              |-- SendButton
              |-- SuggestedQuestions (contextual)
```

### 7.2 State Management

```typescript
// src/context/AICommandCenterContext.tsx

interface AICommandCenterState {
  isOpen: boolean;
  conversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  pageContext: PageContext | null;
  toolCallsInProgress: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallRecord[];
  feedback?: 'positive' | 'negative';
}

interface PageContext {
  type: 'deal' | 'buyer' | 'general';
  dealId?: string;
  dealName?: string;
  buyerId?: string;
  buyerName?: string;
}
```

### 7.3 Streaming Integration

```typescript
// src/hooks/useAICommandCenter.ts

function useAICommandCenter() {
  const sendMessage = async (query: string) => {
    setIsStreaming(true);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-command-center`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        conversationId,
        context: pageContext,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let assistantContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = JSON.parse(line.slice(6));
          switch (event.type) {
            case 'token':
              assistantContent += event.content;
              updateStreamingMessage(assistantContent);
              break;
            case 'tool_call':
              addToolCallIndicator(event.tool);
              break;
            case 'done':
              finalizeMessage(assistantContent, event.usage);
              break;
          }
        }
      }
    }

    setIsStreaming(false);
  };
}
```

---

## 8. Database Schema Extensions

### 8.1 New Tables

```sql
-- AI Command Center usage tracking
CREATE TABLE IF NOT EXISTS ai_command_center_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  conversation_id UUID REFERENCES chat_conversations(id),
  query_preview TEXT,

  -- Routing
  intent_category TEXT,
  model_tier TEXT,
  model_used TEXT,

  -- Token usage
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- Cost
  estimated_cost_usd NUMERIC(10, 6),

  -- Performance
  latency_ms INTEGER,
  tool_calls JSONB, -- Array of { name, input_preview, duration_ms }
  tool_call_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(COALESCE(tool_calls, '[]'::jsonb))) STORED,

  -- Quality
  feedback_rating TEXT CHECK (feedback_rating IN ('positive', 'negative')),
  feedback_type TEXT,
  feedback_comment TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_usage_user_created ON ai_command_center_usage(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_model ON ai_command_center_usage(model_used, created_at DESC);
CREATE INDEX idx_ai_usage_category ON ai_command_center_usage(intent_category, created_at DESC);

-- Enable RLS
ALTER TABLE ai_command_center_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage usage" ON ai_command_center_usage
  FOR ALL USING (public.is_admin(auth.uid()));

-- AI Command Center configuration
CREATE TABLE IF NOT EXISTS ai_command_center_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default configuration
INSERT INTO ai_command_center_config (key, value) VALUES
  ('rate_limits', '{"queries_per_hour": 100, "queries_per_day": 1000}'),
  ('model_config', '{"router": "claude-haiku-4-5-20250514", "standard": "claude-sonnet-4-20250514", "deep": "claude-opus-4-20250514"}'),
  ('stale_deal_threshold_days', '14'),
  ('follow_up_threshold_days', '7'),
  ('max_tool_calls_per_query', '7'),
  ('max_conversation_messages', '50')
ON CONFLICT (key) DO NOTHING;
```

### 8.2 Existing Table Usage

The Command Center reads from these existing tables (no modifications needed):

- `listings`, `deals`, `deal_stages`, `deal_tasks`, `deal_activities`, `deal_notes`, `deal_comments`
- `remarketing_buyers`, `remarketing_scores`, `remarketing_buyer_contacts`
- `profiles` (admin and buyer profiles)
- `outreach_records`, `remarketing_outreach`
- `connection_requests`, `connection_messages`
- `call_transcripts`, `deal_transcripts`, `buyer_transcripts`
- `data_room_access`, `data_room_audit_log`
- `inbound_leads`, `valuation_leads`, `industry_trackers`
- `firm_agreements`, `firm_members`
- `listing_analytics`, `daily_metrics`, `engagement_signals`
- `chat_conversations` (for persistence)

---

## 9. Fireflies.ai Integration

### 9.1 Integration Approach

```
Two-tier architecture:

Tier 1: Local transcripts (fast, in-database)
  - call_transcripts, deal_transcripts, buyer_transcripts
  - Synced from Fireflies via existing sync-fireflies-transcripts function
  - Pre-processed: extracted_insights, key_quotes, ceo_detected

Tier 2: Fireflies API (comprehensive, on-demand)
  - Full transcript text with speaker labels
  - Action items and tasks
  - Meeting summaries
  - Participant details
  - Used as fallback when local data is insufficient
```

### 9.2 Fireflies Tool Implementation

```typescript
// supabase/functions/ai-command-center/tools/transcript-tools.ts

export async function searchFireflies(args: {
  query?: string;
  participant_name?: string;
  since?: string;
  limit?: number;
}): Promise<FirefliesSearchResult> {
  const FIREFLIES_API_KEY = Deno.env.get('FIREFLIES_API_KEY');
  if (!FIREFLIES_API_KEY) {
    return { meetings: [], error: 'Fireflies not configured' };
  }

  // GraphQL query to Fireflies API
  const graphqlQuery = `
    query {
      transcripts(
        ${args.query ? `search: "${args.query}"` : ''}
        ${args.since ? `fromDate: "${args.since}"` : ''}
        limit: ${args.limit || 10}
      ) {
        id
        title
        date
        duration
        participants
        summary {
          overview
          action_items
          keywords
        }
        sentences {
          speaker_name
          text
          start_time
        }
      }
    }
  `;

  const response = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIREFLIES_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: graphqlQuery }),
  });

  const data = await response.json();

  // Filter by participant if specified
  let meetings = data.data?.transcripts || [];
  if (args.participant_name) {
    meetings = meetings.filter((m: any) =>
      m.participants?.some((p: string) =>
        p.toLowerCase().includes(args.participant_name!.toLowerCase())
      )
    );
  }

  return { meetings, total: meetings.length };
}
```

---

## 10. Cost Management Architecture

### 10.1 Cost Tracking

```typescript
// Cost per model (as of Feb 2026)
const MODEL_COSTS = {
  'claude-haiku-4-5-20250514': { input: 0.80, output: 4.00 },    // per million tokens
  'claude-sonnet-4-20250514':  { input: 3.00, output: 15.00 },
  'claude-opus-4-20250514':    { input: 15.00, output: 75.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model];
  if (!costs) return 0;
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}
```

### 10.2 Cost Controls

1. **Model routing:** 90% of queries go to Sonnet, not Opus
2. **Tool call limits:** Max 7 tool calls per query
3. **Context window management:** Conversation history trimmed to last 10 messages
4. **Prompt caching:** Claude's prompt caching for repeated system prompt prefix
5. **Result pagination:** Tool results capped at 25-50 items
6. **Daily budget alerts:** Notification when daily spend exceeds threshold

### 10.3 Projected Monthly Costs

| Scenario | Queries/Month | Avg Cost/Query | Monthly Cost |
|----------|--------------|----------------|-------------|
| Low usage | 5,000 | $0.02 | $100 |
| Medium usage | 15,000 | $0.025 | $375 |
| High usage | 30,000 | $0.03 | $900 |

---

## 11. Security Architecture

### 11.1 Authentication Flow

```
1. User opens chat -> React sends JWT from Supabase auth session
2. Edge function validates JWT -> extracts user_id
3. is_admin() check -> confirms admin role
4. Rate limit check -> user hasn't exceeded quota
5. Query processed with service role (bypasses RLS for cross-user data access)
6. Response streamed back to authenticated client
```

### 11.2 Data Access Controls

- Admin users can query all data (consistent with existing admin access patterns)
- Service role key used in edge functions (existing pattern across 113+ functions)
- No PII logged (query previews truncated to 100 chars)
- Conversation data isolated by user_id via RLS
- API keys stored in Supabase Vault / environment variables only

### 11.3 Input Validation

```typescript
// Query sanitization
const MAX_QUERY_LENGTH = 2000;
const MAX_MESSAGES = 50;

function validateInput(query: string, messages: any[]): { valid: boolean; error?: string } {
  if (!query || typeof query !== 'string') return { valid: false, error: 'Query required' };
  if (query.length > MAX_QUERY_LENGTH) return { valid: false, error: 'Query too long' };
  if (messages.length > MAX_MESSAGES) return { valid: false, error: 'Too many messages' };
  return { valid: true };
}
```

---

## 12. Observability & Monitoring

### 12.1 Metrics to Track

| Metric | Type | Alert Threshold |
|--------|------|----------------|
| Query latency P50 | Histogram | > 5s |
| Query latency P99 | Histogram | > 15s |
| Error rate | Counter | > 5% |
| Tool call failure rate | Counter | > 10% |
| Daily cost | Gauge | > $50 |
| User feedback (negative) | Rate | > 30% |
| Hallucination reports | Counter | > 0 per day |

### 12.2 Logging Strategy

```typescript
// Structured logging for every query
console.log(JSON.stringify({
  type: 'ai_command_center_query',
  user_id: userId,
  query_preview: query.substring(0, 100),
  intent_category: route.category,
  model_tier: route.model_tier,
  model_used: model,
  tool_calls: toolCalls.map(t => t.name),
  tool_call_count: toolCalls.length,
  input_tokens: totalInputTokens,
  output_tokens: totalOutputTokens,
  estimated_cost: estimateCost(model, totalInputTokens, totalOutputTokens),
  latency_ms: Date.now() - startTime,
  timestamp: new Date().toISOString(),
}));
```
