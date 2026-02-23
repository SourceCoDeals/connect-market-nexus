# SourceCo AI Command Center - AI Best Practices & Prompt Engineering Guide

**Version:** 1.0
**Date:** 2026-02-23

---

## 1. Core Principles

### 1.1 Zero Hallucination Policy

The AI Command Center operates on **real M&A data** where accuracy is non-negotiable. A single fabricated buyer name, incorrect score, or invented meeting quote erodes trust permanently.

**Rules:**

1. **Tool-first architecture:** The LLM NEVER answers from parametric memory. Every data-grounded claim must originate from a tool call result.
2. **Explicit unknowns:** When data is not available, the response must say "I don't have [X] data" rather than hedging or guessing.
3. **Source attribution:** Every factual claim includes its source: "Based on the call transcript from Feb 15..." or "According to the scoring engine..."
4. **No interpolation:** If a buyer's revenue target is $5-10M, the system never says "around $7M" - it says "$5-10M range."
5. **Confidence calibration:** Use "Based on available data..." when data completeness is below 70%.

### 1.2 Data Grounding Framework

```
GROUNDING HIERARCHY:

Level 1: Direct tool result (highest confidence)
  "Summit Capital has a composite score of 78 for this deal."
  Source: get_score_breakdown tool result

Level 2: Derived from tool results (high confidence)
  "Summit Capital is the 3rd highest-scored buyer for this deal."
  Source: Ranking from get_top_buyers_for_deal results

Level 3: Inferred from multiple tool results (moderate confidence)
  "Summit Capital appears to be a strong geographic fit based on their
  Southeast footprint and the deal's Florida location."
  Source: Combining buyer geographic_footprint + deal location

Level 4: General M&A knowledge (use sparingly, always disclaim)
  "In general, PE firms in this space typically look for 3-5x EBITDA multiples."
  MUST prefix with: "Based on general industry knowledge (not specific to your data)..."
```

### 1.3 Prompt Engineering Standards

#### System Prompt Structure

Every system prompt follows this structure:

```
1. IDENTITY (who the AI is)
2. CONTEXT (what the user is looking at, who they are)
3. CAPABILITIES (what tools are available)
4. CONSTRAINTS (what NOT to do)
5. FORMAT (how to structure responses)
6. DOMAIN KNOWLEDGE (M&A glossary, score definitions)
```

#### Prompt Antipatterns to Avoid

| Antipattern | Why It's Bad | Better Approach |
|------------|-------------|-----------------|
| "You are an expert M&A analyst" | Induces overconfidence, hallucination | "You are a data retrieval assistant for an M&A platform" |
| "Be helpful and informative" | Too vague, leads to filler | "Answer questions using ONLY data from tool results" |
| "Try your best" | LLMs comply literally | "If you cannot answer with available data, say so explicitly" |
| Long enumerated rules (50+ items) | Gets lost in context | Keep constraints to 10-15 key rules |
| Negative instructions only ("don't hallucinate") | Less effective than positive framing | "Only reference data returned by tools" |

---

## 2. Prompt Templates

### 2.1 Router Prompt (Haiku)

```
You are a query classifier for the SourceCo M&A platform.

Given a user query and conversation history, classify the intent and select the appropriate response strategy.

CLASSIFICATION CATEGORIES:
- DEAL_STATUS: Questions about deal progress, pipeline stages, activity
- FOLLOW_UP: Who needs follow-up, overdue tasks, response tracking
- BUYER_SEARCH: Finding buyers by criteria, cross-source search
- BUYER_ANALYSIS: Score breakdowns, fit analysis, buyer deep dives
- MEETING_INTEL: Transcript content, meeting summaries, action items
- PIPELINE_ANALYTICS: Aggregate metrics, trends, comparisons
- DAILY_BRIEFING: Morning briefing, comprehensive daily summaries
- GENERAL: Greetings, help requests, clarification, off-topic

MODEL TIER RULES:
- QUICK: Simple lookups, counts, single-table queries (use Haiku)
- STANDARD: Multi-table queries, analysis requiring 2-5 tool calls (use Sonnet)
- DEEP: Cross-system synthesis, briefings, complex multi-source analysis (use Opus)

TOOL SELECTION:
Select the minimum set of tools needed. Common patterns:
- "my active deals" -> [get_current_user_context, query_deals]
- "who needs follow-up" -> [get_current_user_context, get_deal_tasks, get_outreach_status]
- "find HVAC buyers in Florida" -> [search_buyers, search_lead_sources]
- "what did CEO say about timing" -> [search_transcripts, search_fireflies]
- "morning briefing" -> [get_current_user_context, query_deals, get_deal_tasks, get_outreach_status, get_analytics]

Respond ONLY with JSON:
{
  "category": "CATEGORY",
  "model_tier": "QUICK|STANDARD|DEEP",
  "tools_needed": ["tool1", "tool2"],
  "requires_user_context": true|false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}
```

### 2.2 Orchestrator System Prompt (Sonnet/Opus)

```
You are the SourceCo AI Command Center, a data-driven assistant for the SourceCo M&A deal management platform.

YOUR ROLE:
- Retrieve and synthesize data from the SourceCo platform to answer admin user questions
- You have access to deal pipeline data, buyer profiles, meeting transcripts, outreach records, and analytics
- You are NOT a general AI assistant - you answer questions about SourceCo data only

CURRENT USER:
- Name: {user_name}
- User ID: {user_id}
- Role: Admin
{page_context}

CURRENT DATE: {current_date}
TODAY IS: {day_of_week}, {full_date}

TOOLS AVAILABLE:
{tool_descriptions}

CRITICAL RULES:
1. ONLY reference data returned by your tools. NEVER fabricate names, scores, dates, or quotes.
2. If a tool returns no results, say "I didn't find any [X]" - do not guess.
3. When data is incomplete (buyer data_completeness < 50%), mention this: "Note: this buyer's profile is {X}% complete."
4. For transcript questions with no transcripts available, say: "No call transcripts are available for this deal."
5. Always include the deal identifier (D-XXXX) when referencing deals.
6. Use "CURRENT_USER" when calling tools that need the current user's ID for "my" queries.
7. Limit tool calls to {max_tool_calls}. If you need more data, ask the user to narrow their question.
8. For "my deals" or "my tasks", always call get_current_user_context first.
9. Never expose internal UUIDs to the user - use names and identifiers instead.
10. Format responses with markdown: **bold** for key values, bullet points for lists.

RESPONSE FORMAT:
- Keep responses concise (under 500 words for standard queries)
- Use structured sections for complex answers (headers, bullets)
- End with a follow-up suggestion when appropriate: "Would you like me to [specific action]?"
- For lists of 10+ items, show top 5 and mention the total: "Showing top 5 of 23 results"

SCORE DEFINITIONS:
- Tier A (80-100): Excellent fit
- Tier B (60-79): Good fit
- Tier C (40-59): Moderate fit
- Tier D (20-39): Poor fit
- Tier F (0-19): No fit
- Score dimensions: geography, size (revenue/EBITDA), service alignment, owner goals

BUYER TYPES: Private Equity, Strategic Acquirer, Family Office, Independent Sponsor, Search Fund

DEAL SOURCES: Marketplace, CapTarget, GP Partners, Valuation Leads, Referrals, Manual
```

---

## 3. Tool Use Best Practices

### 3.1 Tool Call Patterns

| Query Pattern | Tool Sequence | Notes |
|--------------|--------------|-------|
| "My active deals" | 1. get_current_user_context -> 2. query_deals(owner=CURRENT_USER) | Always get user context first for "my" queries |
| "Tell me about Acme Corp" | 1. get_deal_details(name="Acme Corp") | Single tool, direct lookup |
| "Who needs follow-up?" | 1. get_current_user_context -> 2a. get_deal_tasks(overdue) + 2b. get_outreach_status(no_response) + 2c. get_meeting_action_items | Parallel tool calls for efficiency |
| "HVAC buyers in Florida" | 1. search_buyers(services=["HVAC"], geo=["FL"]) -> 2. search_lead_sources(industries=["HVAC"], geo=["FL"]) | Sequential: check buyers first, then leads |
| "Why is X a bad fit?" | 1. get_score_breakdown(buyer, deal) -> 2. get_buyer_profile(buyer, include_transcripts=true) | Score first, then context |
| "Morning briefing" | 1. get_current_user_context -> 2. query_deals + get_deal_tasks + get_outreach_status + get_analytics | Maximum parallelism |

### 3.2 Parallel vs Sequential Tool Calls

**Use parallel calls when:**
- Tools query independent data sources
- Results don't depend on each other
- User is asking about multiple domains simultaneously

**Use sequential calls when:**
- Second tool needs data from first (e.g., buyer ID from search -> profile from ID)
- Name resolution is needed before data fetch
- Results need to be validated before next step

### 3.3 Result Size Management

```
TOOL RESULT SIZE GUIDELINES:

- search_buyers: limit=25, return only key fields (name, type, geo, score)
- query_deals: limit=20, return summary not full details
- get_deal_activities: limit=50, most recent first
- search_transcripts: limit=10, return key_quotes not full text
- get_outreach_status: limit=50, group by status

If initial results are too large (>50 items), ask the user to narrow:
"I found 127 buyers matching that criteria. Can you narrow by geography or buyer type?"
```

---

## 4. Hallucination Prevention

### 4.1 Verification Checklist

Before including any factual claim in a response, verify:

- [ ] The claim originates from a tool call result (not LLM knowledge)
- [ ] Names are exactly as returned by the tool (no paraphrasing)
- [ ] Numbers are exactly as returned (no rounding or averaging)
- [ ] Dates are exactly as returned (no approximation)
- [ ] Scores are from the scoring engine, not estimated
- [ ] Quotes are verbatim from transcripts, not paraphrased

### 4.2 Common Hallucination Vectors

| Vector | Example | Prevention |
|--------|---------|-----------|
| Name fabrication | Inventing a buyer name not in results | System prompt: "Only reference buyers returned by tools" |
| Score invention | Making up a composite score | Always call get_score_breakdown; never estimate |
| Date approximation | "About 2 weeks ago" when exact date is available | Use exact dates from tool results |
| Transcript fabrication | Inventing a CEO quote | System prompt: "Never invent transcript content" |
| Status assumption | Assuming a deal is active without checking | Always verify via tool call |
| Extrapolation | "Based on the trend, next month will..." | Don't predict; report current state |

### 4.3 Guardrail Implementation

```typescript
// Post-processing guardrail
function validateResponse(response: string, toolResults: any[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for common hallucination patterns
  const scorePattern = /score of (\d+)/gi;
  const matches = response.matchAll(scorePattern);
  for (const match of matches) {
    const claimedScore = parseInt(match[1]);
    // Verify score exists in tool results
    const scoreExists = toolResults.some(r =>
      JSON.stringify(r).includes(String(claimedScore))
    );
    if (!scoreExists) {
      issues.push(`Potential hallucinated score: ${claimedScore}`);
    }
  }

  // Check for names not in results
  // ... (additional checks)

  return { valid: issues.length === 0, issues };
}
```

---

## 5. RAG vs Direct Query Decision Matrix

### 5.1 When to Use Direct Database Queries (Tools)

- Structured data with known schema (deals, buyers, scores)
- Exact lookups by ID, name, or filter criteria
- Aggregation queries (counts, sums, averages)
- Time-range filtering
- Status and stage queries

**This is 95%+ of the Command Center's queries.**

### 5.2 When to Use RAG (Vector Search)

- Free-text search across large transcript bodies
- "Find mentions of [topic] across all meetings"
- Semantic similarity search ("deals similar to Acme Corp")
- When exact keyword matching isn't sufficient

### 5.3 RAG Implementation Plan (Phase 3)

```
Embedding Strategy:
- Model: text-embedding-3-small (OpenAI) or Voyage AI
- Chunk size: 500 tokens with 100-token overlap
- Tables to embed:
  - call_transcripts.transcript_text (chunked)
  - deal_transcripts.transcript_text (chunked)
  - buyer_transcripts.transcript_text (chunked)
  - remarketing_buyers.business_summary + thesis_summary
  - listings.description + description_html

Storage:
- pgvector extension in Supabase
- New table: ai_embeddings (source_table, source_id, chunk_index, embedding vector(1536), text_chunk)

Query Flow:
1. User asks semantic question ("find deals similar to X")
2. Embed user query
3. Vector similarity search (cosine distance)
4. Return top-K relevant chunks
5. Feed chunks to LLM as context for answer generation
```

---

## 6. Evaluation Framework

### 6.1 Benchmark Suite (100 Queries)

The benchmark suite covers all query categories with known-correct answers:

```
Category Distribution:
- Deal Pipeline (20 queries): Pipeline status, stage counts, activity summaries
- Follow-Up (15 queries): Overdue tasks, no-response buyers, action items
- Buyer Search (20 queries): Cross-source search, criteria filtering, geographic matching
- Buyer Analysis (15 queries): Score breakdowns, fit analysis, profiles
- Meeting Intelligence (15 queries): Transcript search, CEO detection, action items
- Analytics (10 queries): Pipeline metrics, conversion rates, trends
- Edge Cases (5 queries): Ambiguous names, no results, data quality issues
```

### 6.2 Evaluation Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **Factual Accuracy** | % of factual claims verified against database | >= 95% |
| **Completeness** | % of relevant data points included in response | >= 80% |
| **Relevance** | % of response content directly addressing the question | >= 90% |
| **Hallucination Rate** | % of responses containing fabricated data | 0% |
| **Tool Efficiency** | Average tool calls per query | <= 4 |
| **Latency P50** | 50th percentile response time | < 3s |
| **Cost per Query** | Average cost across all queries | < $0.03 |

### 6.3 Automated Evaluation Pipeline

```typescript
// evaluation/run-benchmark.ts

interface BenchmarkQuery {
  id: string;
  query: string;
  expected_tools: string[];
  expected_facts: string[]; // Key facts that must appear
  forbidden_patterns: string[]; // Patterns that indicate hallucination
  max_latency_ms: number;
}

async function evaluateQuery(benchmark: BenchmarkQuery): Promise<EvalResult> {
  const startTime = Date.now();
  const result = await sendQuery(benchmark.query);
  const latencyMs = Date.now() - startTime;

  return {
    id: benchmark.id,
    latency_ms: latencyMs,
    latency_pass: latencyMs <= benchmark.max_latency_ms,

    // Check expected facts present
    facts_found: benchmark.expected_facts.filter(fact =>
      result.content.toLowerCase().includes(fact.toLowerCase())
    ),
    facts_missing: benchmark.expected_facts.filter(fact =>
      !result.content.toLowerCase().includes(fact.toLowerCase())
    ),
    completeness: facts_found.length / expected_facts.length,

    // Check for hallucination patterns
    hallucinations: benchmark.forbidden_patterns.filter(pattern =>
      new RegExp(pattern, 'i').test(result.content)
    ),

    // Check tool usage
    tools_used: result.toolCalls.map(t => t.name),
    tools_expected: benchmark.expected_tools,
    tool_efficiency: result.toolCalls.length,
  };
}
```

### 6.4 Weekly Audit Process

1. **Automated:** Run benchmark suite nightly against staging environment
2. **Manual review:** Sample 20 random production queries weekly
3. **User feedback analysis:** Review all negative feedback ratings
4. **Hallucination review:** Investigate every hallucination report
5. **Cost review:** Check daily/weekly cost trends against budget

---

## 7. Prompt Versioning & A/B Testing

### 7.1 Prompt Version Control

```
All prompts stored in code (not database) for:
- Version control via git
- Code review for prompt changes
- Rollback capability
- Diff visibility

File structure:
supabase/functions/ai-command-center/prompts/
├── router-v1.ts
├── orchestrator-v1.ts
├── tool-descriptions-v1.ts
└── guardrails-v1.ts
```

### 7.2 A/B Testing Framework

```typescript
// For testing prompt variations
function getPromptVersion(userId: string): string {
  // Hash-based deterministic assignment
  const hash = hashCode(userId);
  const variant = hash % 100;

  if (variant < 50) return 'v1'; // Control
  return 'v2'; // Treatment

  // Track variant in usage logging
}
```

---

## 8. Continuous Improvement Loop

```
1. COLLECT: Gather user feedback (ratings, comments) and usage patterns
2. ANALYZE: Weekly review of low-rated responses and hallucination reports
3. IDENTIFY: Find patterns in failures (specific query types, tool gaps, prompt weaknesses)
4. IMPROVE: Update prompts, add tools, fix data access gaps
5. VALIDATE: Run benchmark suite to confirm improvement without regression
6. DEPLOY: Ship changes with monitoring
7. REPEAT
```

### 8.1 Feedback-Driven Prompt Refinement

```
Common failure -> Prompt fix:

"AI listed a buyer not in the database"
-> Add: "Before mentioning any buyer by name, verify it appears in your tool results."

"AI said 'I think' instead of citing data"
-> Add: "Never use hedging language. Either cite data or say 'I don't have that data.'"

"AI didn't mention the buyer's deal breakers"
-> Add: "When analyzing buyer fit, always check and mention deal_breakers if they exist."

"AI response was too long for a simple question"
-> Add: "For simple count/status questions, respond in 1-2 sentences maximum."
```
