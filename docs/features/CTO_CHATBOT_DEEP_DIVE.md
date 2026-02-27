# CTO Deep Dive: AI Command Center Chatbot
**Date:** 2026-02-25
**Status:** Architecture Review & Build Plan
**Scope:** Full system analysis — what's broken, user stories, how to fix it

---

## Executive Summary

The AI Command Center has a **solid architectural foundation** — Claude-powered tool-calling loop, SSE streaming, 50+ tools, intent routing, confirmation flow — but it's **not working for the team** because of a gap between what the infrastructure can do and what the user experience delivers. The conversation above (HVAC deals, Essential Benefits contact, collision shop calling list) exposes the exact failure pattern:

1. **Data queries work** (HVAC count returned correctly from CapTarget)
2. **External enrichment fails** (Apify/Prospeo return 404s — infrastructure issue)
3. **Multi-step workflows break** (building a calling list requires chaining: search leads → enrich contacts → build list — the bot can't do this reliably)
4. **Platform guidance is missing** (no "how do I use this?" capability)

---

## Part 1: What's Actually Broken

### Issue 1: External API Failures (Apify + Prospeo)

**Symptom:** "Both tools are down right now — Google Search (Apify) and LinkedIn enrichment (Apify) are both returning 404 errors."

**Root Cause Analysis:**

The integration tools in `supabase/functions/ai-command-center/tools/integration-action-tools.ts` call external APIs directly:

```
Apify LinkedIn scraper:  apify-client.ts → curious_coder/linkedin-company-employees-scraper
Apify Google search:     apify-google-client.ts → apify/google-search-scraper
Prospeo email lookup:    prospeo-client.ts → api.prospeo.io/v1
```

**Possible Failure Points:**
- `APIFY_API_TOKEN` not set or expired in Supabase Edge Function secrets
- `PROSPEO_API_KEY` not set or expired
- Apify actor IDs changed (`curious_coder/linkedin-company-employees-scraper` may have been renamed/removed)
- Apify Google scraper actor (`apify/google-search-scraper`) deprecated or rate-limited
- 404 specifically means the API endpoint or actor doesn't exist anymore — this is an actor ID problem, not a rate limit

**Fix Required:**
1. Verify all API keys are current in Supabase Edge Function secrets
2. Verify Apify actor IDs are still valid (check Apify dashboard)
3. Add fallback actors if primary actors are unavailable
4. Add better error messages that distinguish "API key invalid" from "actor not found" from "rate limited"

### Issue 2: No Multi-Step Workflow Orchestration

**Symptom:** User asks "build a calling list of every collision shop owner" — bot finds 3 shops but can't enrich them into a calling list in one flow.

**Root Cause:** The orchestrator (`orchestrator.ts`) has a `MAX_TOOL_ROUNDS = 5` limit and tools are designed for single-step queries, not chained workflows. The bot should be able to:
1. Search all lead sources for collision shops
2. For each result, enrich contacts via Prospeo/Apify
3. Compile into a structured calling list with names, phones, emails

But the current architecture treats each tool call independently. There's no "workflow" concept that chains tool results together.

### Issue 3: No Platform Knowledge / Help System

**Symptom:** The chatbot has no ability to answer "how do I use this platform?" or "what can I do with CapTarget data?" — it can only query data, not explain the platform.

**Root Cause:** The system prompt in `system-prompt.ts` defines the bot as a data query tool. There is no:
- Platform documentation indexed for the bot
- FAQ knowledge base
- Feature explanation capability
- Onboarding guidance

### Issue 4: Fragile Error Handling for External Services

**Symptom:** When Apify returns 404, the bot says "tools are down" with no recovery path.

**Root Cause:** The integration tools throw errors that bubble up as tool failures. The orchestrator marks them as errors but Claude doesn't have good fallback instructions. The system prompt should instruct:
- If enrichment fails, explain what happened and offer alternatives
- If Google search fails, suggest manual lookup or alternative data sources
- Never leave the user with just "it's broken"

---

## Part 2: User Stories (What Internal Users Need)

Based on the conversation and platform analysis, here are the core user stories:

### Story 1: Data Discovery
> "As a deal team member, I want to ask the chatbot about deals across ALL data sources and get accurate counts, lists, and details."

**Current State:** Partially working. CapTarget queries work. GP Partners returned 0 correctly. But the bot should also check valuation leads, inbound leads, and active deals in the pipeline.

**Tools Involved:** `search_lead_sources`, `search_valuation_leads`, `search_inbound_leads`, `query_deals`

**What's Missing:** The bot doesn't always search ALL sources unless specifically asked. Need to improve the system prompt to instruct: "When asked about deals in an industry, search ALL sources by default — CapTarget, GP Partners, Marketplace, Inbound, Valuation Leads, AND Active Deals."

### Story 2: Contact Discovery & Enrichment
> "As a deal team member, I want to find the owner/contact info for any company — whether it's already in our database or needs to be looked up externally."

**Current State:** Broken. Internal contact search works (unified contacts table). But external enrichment via Apify/Prospeo is returning 404 errors.

**Tools Involved:** `search_contacts`, `search_pe_contacts`, `enrich_buyer_contacts`, `enrich_linkedin_contact`, `find_and_enrich_person`, `google_search_companies`

**Desired Flow:**
1. Search unified contacts table first
2. If not found, search enriched_contacts (previously discovered)
3. If still not found, offer to enrich via LinkedIn + Prospeo
4. If enrichment succeeds, present results and offer to save to CRM
5. If enrichment fails (API down), explain clearly and suggest manual alternatives

### Story 3: Building Calling Lists
> "As a deal team member, I want to say 'build me a calling list of collision shop owners' and get back a structured list with names, phones, and emails ready to call."

**Current State:** Can find the 3 collision shops but can't enrich them into a calling list.

**Desired Flow:**
1. Search all lead sources for the industry
2. Compile unique companies
3. For each company, check if contacts exist
4. For companies without contacts, attempt enrichment
5. Return a structured table: Company | Owner | Phone | Email | Source
6. Offer to push to PhoneBurner for dialing

### Story 4: Platform Guidance & Help
> "As a new team member, I want to ask the chatbot 'how do I find HVAC deals?' or 'what is CapTarget?' and get a clear explanation of the platform's features."

**Current State:** Not implemented at all. The bot only queries data.

**What's Needed:**
- A knowledge base of platform features, workflows, and terminology
- System prompt section that handles "how to" questions
- Ability to explain: What is CapTarget? What is GP Partners? How do I create a buyer universe? How do I send an NDA? What is remarketing? How does scoring work?

### Story 5: Proactive Intelligence
> "As a deal team member, I want the chatbot to proactively tell me things like 'you have 3 overdue tasks' or 'Deal X has gone cold — no activity in 14 days.'"

**Current State:** Tools exist (`get_follow_up_queue`, `get_stale_deals`, `get_deal_health`) but they're not surfaced proactively. User must ask.

**What's Needed:**
- Daily briefing that auto-runs on first chat of the day
- Proactive alerts when the user opens the chat panel
- Smart suggestions that adapt to current state (overdue tasks, cold deals, unsigned NDAs)

### Story 6: Cross-Platform Tool Integration
> "As a deal team member, I want to say 'push these 3 collision shops to PhoneBurner' or 'start an email campaign for HVAC leads' and have the bot handle the integration."

**Current State:** Tools exist (`push_to_phoneburner`, `push_to_smartlead`) but the workflow is fragmented. Must first find contacts, then manually specify IDs to push.

**What's Needed:**
- Natural language commands that chain: find → filter → push
- Confirmation step before any external action
- Status tracking after push ("5 of 8 contacts pushed successfully, 3 had no phone number")

---

## Part 3: Architecture Assessment

### What's Working Well

| Component | Status | Notes |
|-----------|--------|-------|
| Claude API integration | OK | Haiku routing + Sonnet/Opus orchestration |
| SSE streaming | OK | Real-time text + tool status events |
| Intent router | OK | 40+ bypass rules + LLM fallback |
| Tool registry | OK | 50+ tools covering all data sources |
| Supabase data access | OK | Unified contacts, deals, buyers, transcripts |
| Confirmation flow | OK | Destructive actions require user approval |
| Cost tracking | OK | Per-request cost estimation logged |
| Conversation persistence | OK | sessionStorage + DB backup |

### What's Broken or Missing

| Component | Status | Impact |
|-----------|--------|--------|
| Apify integration | BROKEN | Google search and LinkedIn scraping return 404 |
| Prospeo integration | BROKEN | Email enrichment fails |
| Multi-step workflows | MISSING | Can't chain search → enrich → compile |
| Platform knowledge base | MISSING | Can't answer "how do I...?" questions |
| Error recovery | WEAK | Fails with "tools are down" instead of offering alternatives |
| Proactive briefings | MISSING | No auto-alerts on chat open |
| Calling list builder | MISSING | No workflow to compile contacts into callable lists |

### Architecture Diagram (Current)

```
User Input
    │
    ▼
┌─────────────────┐
│  AICommandCenter │  (React Panel)
│  Panel.tsx       │
└────────┬────────┘
         │ POST /ai-command-center
         ▼
┌─────────────────┐
│  index.ts        │  (Edge Function)
│  Auth → Route →  │
│  Orchestrate     │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│ Router │ │Orchestrator │
│(Haiku) │ │(Sonnet/Opus)│
└────────┘ └─────┬──────┘
                  │
         ┌───────┼───────┐
         ▼       ▼       ▼
    ┌────────┐ ┌─────┐ ┌──────────┐
    │Supabase│ │Claude│ │External  │
    │ Tools  │ │ LLM  │ │APIs      │
    │(50+)   │ │      │ │Apify     │
    │        │ │      │ │Prospeo   │
    └────────┘ └─────┘ └──────────┘
```

---

## Part 4: Build Plan — How to Fix It

### Phase 1: Fix External APIs (Critical — Do First)

**Goal:** Get Apify and Prospeo working again so enrichment functions.

**Tasks:**
1. **Verify API keys** in Supabase Edge Function secrets dashboard
2. **Verify Apify actor IDs** — check if `curious_coder/linkedin-company-employees-scraper` and `apify/google-search-scraper` are still valid
3. **Update actor IDs** if they've changed
4. **Add API health checks** — before calling external APIs, ping them to verify connectivity
5. **Improve error messages** — distinguish between auth failures, actor not found, rate limits, and network errors
6. **Add retry logic** — exponential backoff for transient failures (already exists in `ai-providers.ts` but not applied to Apify/Prospeo tools)

**Files to Modify:**
- `supabase/functions/_shared/apify-client.ts`
- `supabase/functions/_shared/apify-google-client.ts`
- `supabase/functions/_shared/prospeo-client.ts`
- `supabase/functions/ai-command-center/tools/integration-action-tools.ts`

### Phase 2: Add Platform Knowledge Base

**Goal:** Let the chatbot answer "how do I...?" and "what is...?" questions about the platform.

**Tasks:**
1. **Create a platform knowledge base** as a structured document that gets injected into the system prompt for GENERAL and help-related queries
2. **Add a bypass rule** for help/how-to questions in `router.ts`
3. **Create a `PLATFORM_GUIDE` intent category** with no tools needed (pure knowledge response)
4. **Include:** Feature explanations, terminology glossary, workflow guides, common tasks

**Content to Cover:**
- What is CapTarget? GP Partners? Marketplace? Inbound Leads? Valuation Leads?
- How do I create a buyer universe?
- How do I send an NDA or fee agreement?
- How do I enrich contacts?
- How does scoring work?
- How do I push contacts to PhoneBurner or SmartLead?
- How do I build a calling list?
- What is remarketing?
- How do I track outreach?

**Files to Modify:**
- `supabase/functions/ai-command-center/system-prompt.ts` — add PLATFORM_GUIDE section
- `supabase/functions/ai-command-center/router.ts` — add help/how-to bypass rules

### Phase 3: Multi-Step Workflow Support

**Goal:** Enable natural language commands that chain multiple tools together.

**Approach:** Rather than building a separate workflow engine, improve the system prompt to instruct Claude on how to chain tools for common workflows:

**Workflows to Support:**

1. **Contact Discovery Workflow:**
   ```
   User: "Find the owner of Essential Benefits"
   Step 1: search_contacts(company_name="Essential Benefits")
   Step 2: If no results → search_pe_contacts(firm_name="Essential Benefits")
   Step 3: If no results → enrich_buyer_contacts(company_name="Essential Benefits")
   Step 4: Present results or explain failure
   ```

2. **Calling List Workflow:**
   ```
   User: "Build a calling list of collision shop owners"
   Step 1: search_lead_sources(industry="collision", source_type="all")
   Step 2: query_deals(industry="collision")
   Step 3: For each company → search_contacts(company_name=X)
   Step 4: Compile into structured table
   Step 5: Offer to push to PhoneBurner
   ```

3. **Industry Research Workflow:**
   ```
   User: "How many HVAC deals do we have across everything?"
   Step 1: search_lead_sources(industry="hvac", source_type="captarget")
   Step 2: search_lead_sources(industry="hvac", source_type="gp_partners")
   Step 3: query_deals(industry="hvac")
   Step 4: search_valuation_leads(industry="hvac")
   Step 5: search_inbound_leads(industry="hvac")
   Step 6: Compile totals by source
   ```

**Implementation:**
- Add workflow instructions to `system-prompt.ts`
- Increase `MAX_TOOL_ROUNDS` from 5 to 8 for workflow-heavy queries
- Add a `WORKFLOW` tier that allows more tool rounds

**Files to Modify:**
- `supabase/functions/ai-command-center/system-prompt.ts`
- `supabase/functions/ai-command-center/orchestrator.ts` (increase MAX_TOOL_ROUNDS)
- `supabase/functions/ai-command-center/router.ts` (add workflow-aware routing)

### Phase 4: Better Error Recovery

**Goal:** When external APIs fail, give useful alternatives instead of "tools are down."

**Tasks:**
1. **Add fallback instructions** to system prompt for each external tool
2. **When Google search fails:** "I couldn't search Google right now. You can try searching manually at google.com, or I can search our internal database for [company]."
3. **When LinkedIn enrichment fails:** "LinkedIn enrichment is unavailable. I can check our existing contacts database, or you can paste a LinkedIn URL and I'll try to enrich it via Prospeo directly."
4. **When Prospeo fails:** "Email enrichment is down. I found the contact name — you can look them up on LinkedIn and I'll try again later."

**Files to Modify:**
- `supabase/functions/ai-command-center/system-prompt.ts`

### Phase 5: Proactive Intelligence

**Goal:** Surface important information without being asked.

**Tasks:**
1. **Daily briefing on first message** — if chat is opened with no history, auto-run `get_follow_up_queue` and `get_deal_health`
2. **Smart suggestions** — improve context-aware suggestions to reflect actual state
3. **Alerts** — surface overdue tasks, cold deals, unsigned NDAs in the empty state

**Files to Modify:**
- `src/components/ai-command-center/AICommandCenterPanel.tsx` — smart suggestions
- `supabase/functions/ai-command-center/system-prompt.ts` — briefing instructions

---

## Part 5: Specific Code Changes Required

### Change 1: Fix Router for Help Questions

**File:** `supabase/functions/ai-command-center/router.ts`

Add bypass rule for platform help questions:

```typescript
// Platform help / "how do I" questions
{
  test: (q) =>
    /\b(how (do|can|should) I|how to|what is|what are|explain|help me|teach me|show me how|guide|tutorial|walkthrough)\b/i.test(q) &&
    /\b(platform|sourceco|captarget|gp partner|marketplace|remarketing|universe|scoring|enrichment|data room|nda|fee agreement|phoneburner|smartlead|pipeline|outreach|chatbot|ai command|this tool)\b/i.test(q),
  result: {
    category: 'PLATFORM_GUIDE',
    tier: 'STANDARD',
    tools: ['get_current_user_context'],
    confidence: 0.95,
  },
},
```

### Change 2: Add Platform Knowledge to System Prompt

**File:** `supabase/functions/ai-command-center/system-prompt.ts`

Add a comprehensive platform guide section to the IDENTITY/GENERAL section.

### Change 3: Add Workflow Instructions to System Prompt

Add explicit multi-step workflow instructions for common patterns:
- Contact discovery workflow
- Calling list builder workflow
- Industry research workflow
- Enrichment-with-fallback workflow

### Change 4: Increase Tool Rounds for Complex Queries

**File:** `supabase/functions/ai-command-center/orchestrator.ts`

Change:
```typescript
const MAX_TOOL_ROUNDS = 5;
```
To:
```typescript
const MAX_TOOL_ROUNDS = 8;
```

### Change 5: Add PLATFORM_GUIDE Category to Tool Registry

**File:** `supabase/functions/ai-command-center/tools/index.ts`

Add:
```typescript
PLATFORM_GUIDE: ['get_current_user_context'],
```

### Change 6: Improve Error Handling in Integration Tools

**File:** `supabase/functions/ai-command-center/tools/integration-action-tools.ts`

Add structured error responses that give Claude enough context to suggest alternatives.

---

## Part 6: Priority Order

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| P0 | Fix Apify/Prospeo API keys and actor IDs | Unblocks all enrichment | 1 hour |
| P1 | Add platform knowledge base to system prompt | Enables "how do I?" questions | 2-3 hours |
| P2 | Add multi-step workflow instructions | Enables calling lists, research workflows | 2-3 hours |
| P3 | Improve error recovery in system prompt | Better UX when APIs fail | 1 hour |
| P4 | Increase MAX_TOOL_ROUNDS to 8 | Enables complex multi-tool chains | 5 minutes |
| P5 | Add PLATFORM_GUIDE router bypass | Routes help questions correctly | 30 minutes |
| P6 | Proactive daily briefing | Auto-surfaces important info | 2 hours |

---

## Part 7: What We Can Implement Right Now

Without access to the Supabase dashboard (to verify API keys), we can still implement P1-P6:

1. Add platform knowledge base to system prompt
2. Add workflow instructions for multi-step queries
3. Add better error recovery instructions
4. Increase MAX_TOOL_ROUNDS
5. Add PLATFORM_GUIDE router category and bypass rules
6. Improve the AI's ability to chain tools intelligently

These changes are all code-level and will immediately improve the chatbot experience for the most common failure patterns seen in the conversation.

---

## Conclusion

The AI Command Center has strong bones — 50+ tools, Claude-powered orchestration, SSE streaming, cost tracking. The issues are:

1. **External API configuration** (Apify/Prospeo keys/actors — needs dashboard access to fix)
2. **No platform knowledge** (easily fixable by adding to system prompt)
3. **No workflow chaining** (fixable by improving system prompt instructions + increasing tool rounds)
4. **Poor error recovery** (fixable by adding fallback instructions to system prompt)

The recommended approach: Fix the code-level issues now (system prompt, router, tool rounds), then address the API configuration in the Supabase dashboard separately.
