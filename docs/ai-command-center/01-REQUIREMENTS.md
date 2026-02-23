# SourceCo AI Command Center - Requirements Specification

**Version:** 1.1
**Date:** 2026-02-23
**Status:** Draft
**Classification:** Internal - Confidential

---

## 1. Executive Summary

### 1.1 Product Vision

The SourceCo AI Command Center is a conversational AI assistant embedded in the SourceCo admin platform that enables deal team members to query, analyze, and act on data across the entire SourceCo ecosystem through natural language. It serves as the central intelligence layer connecting deal pipeline data, buyer profiles, meeting transcripts (via Fireflies.ai), outreach records, and marketplace analytics into a single conversational interface.

### 1.2 Problem Statement

SourceCo admin users currently must navigate 15+ different pages and manually cross-reference data across multiple systems to answer basic operational questions:
- "What are the most active deals I'm working on?" requires visiting the Pipeline page, filtering by owner, checking activity logs, and reviewing recent outreach.
- "Who do I need to follow up with?" requires checking deal stages, outreach records, meeting notes, and task lists across multiple views.
- "Do we have any deals in our lead sources that do HVAC in Florida?" requires searching CapTarget, GP Partners, Valuation Leads, and the marketplace separately.

These workflows consume significant time daily and prevent team members from focusing on high-value relationship work.

### 1.3 Core Design Philosophy: Speed-First, Depth-On-Demand

**Speed is the #1 product requirement.** The AI Command Center must feel instant for everyday questions and only take time when the user explicitly requests a deep analysis. Users will abandon a tool that makes them wait 5 seconds for "how many active deals do I have?"

- **Fast by default:** Simple queries answered in < 1-2 seconds (not 5-8 seconds)
- **Depth on demand:** Users can "dive deeper" when they want full analysis — the system doesn't front-load complexity
- **Progressive disclosure:** Short answer first → follow-up suggestions → expanded analysis on request
- **Right-size every response:** 1-2 sentences for a count, a prioritized list for follow-ups, a multi-section analysis only when asked

### 1.4 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Query accuracy | >= 95% factual accuracy | Automated evaluation suite (100-query benchmark) |
| Simple query latency (P50) | < 1.5 seconds | Server-side instrumentation |
| Standard query latency (P50) | < 3 seconds | Server-side instrumentation |
| Complex query latency (P50) | < 8 seconds | Server-side instrumentation |
| First token latency | < 500ms | Client-side instrumentation |
| Cache hit rate | >= 10% of queries | Cache analytics |
| Daily active users | 100% of admin team within 30 days | Session analytics |
| User satisfaction | >= 4.2/5.0 | In-chat feedback ratings |
| Zero hallucination rate | 0% fabricated data points | Weekly audit of flagged responses |
| Cost per query (avg) | < $0.03 | Token tracking system |

---

## 2. Scope

### 2.1 In Scope

- Natural language query interface for all SourceCo data
- Deal pipeline intelligence (status, activity, follow-ups, stage progression)
- Buyer intelligence (profiles, scoring, acquisition history, contact info)
- Meeting intelligence via Fireflies.ai integration (transcripts, action items, key quotes)
- Cross-system search (deals, buyers, leads across all sources)
- Proactive alerts and daily briefings
- Conversation persistence and history
- Admin user authentication and role-based access
- Usage analytics and cost tracking

### 2.2 Out of Scope (v1)

- Buyer-facing chatbot (marketplace users)
- Automated deal creation or data modification via chat
- Integration with external CRMs beyond existing Salesforce sync
- Voice interface
- Mobile-specific UI (responsive web only in v1)
- Multi-language support

### 2.3 Assumptions

- All admin users have existing Supabase auth credentials
- Fireflies.ai integration is operational and transcripts are synced
- Claude API (Anthropic) is the chosen LLM provider
- Supabase Edge Functions (Deno) remain the backend runtime
- React + TypeScript frontend architecture is maintained

---

## 3. Data Landscape

### 3.1 Primary Data Sources

The AI Command Center has access to the following data domains:

#### 3.1.1 Deal Pipeline Data

| Table | Records (est.) | Key Fields | Update Frequency |
|-------|---------------|------------|------------------|
| `listings` | 100-500 | title, internal_company_name, revenue, ebitda, location, categories, status, primary_owner_id | Daily |
| `deals` | 500-2000 | listing_id, buyer_id, remarketing_buyer_id, stage_id, status, priority, owner_id, source | Real-time |
| `deal_stages` | 8-12 | name, sort_order, color | Rarely |
| `deal_tasks` | 1000+ | deal_id, title, status, assigned_to, due_date | Daily |
| `deal_activities` | 5000+ | deal_id, activity_type, description, performed_by | Real-time |
| `deal_notes` | 2000+ | deal_id, content, created_by | Daily |
| `deal_comments` | 3000+ | deal_id, content, @mentions | Real-time |
| `deal_contacts` | 1000+ | deal_id, name, title, email, phone | Weekly |

#### 3.1.2 Buyer Data

| Table | Records (est.) | Key Fields | Update Frequency |
|-------|---------------|------------|------------------|
| `remarketing_buyers` | 2000-5000 | company_name, pe_firm_name, buyer_type, target_geographies, target_services, target_revenue_min/max, geographic_footprint, deal_breakers, strategic_priorities, acquisition_appetite, data_completeness | Weekly (enrichment) |
| `remarketing_scores` | 50000+ | buyer_id, listing_id, composite_score, geography_score, size_score, service_score, tier, fit_reasoning, status | On-demand |
| `remarketing_buyer_contacts` | 10000+ | buyer_id, name, title, email, phone, is_primary_contact | Weekly |
| `profiles` (marketplace buyers) | 500-2000 | email, company_name, buyer_type, business_categories, target_locations, revenue_range | On signup |
| `buyer_contacts` | 5000+ | buyer_id, name, title, email | Weekly |

#### 3.1.3 Outreach & Communication Data

| Table | Records (est.) | Key Fields | Update Frequency |
|-------|---------------|------------|------------------|
| `outreach_records` | 10000+ | buyer_id, listing_id, channel, status, sent_at, response_at | Daily |
| `remarketing_outreach` | 5000+ | buyer_id, deal_id, outreach_type, status | Daily |
| `connection_requests` | 2000+ | listing_id, user_id, status, source, user_message | Real-time |
| `connection_messages` | 5000+ | connection_request_id, body, is_admin | Real-time |
| `memo_distribution_log` | 2000+ | memo_id, recipient, channel, sent_at | Daily |

#### 3.1.4 Transcript & Meeting Data

| Table | Records (est.) | Key Fields | Update Frequency |
|-------|---------------|------------|------------------|
| `call_transcripts` | 500+ | listing_id, buyer_id, transcript_text, extracted_insights, key_quotes, ceo_detected, call_type | After each call |
| `deal_transcripts` | 300+ | listing_id, transcript_text, extracted_data, source | After each call |
| `buyer_transcripts` | 200+ | buyer_id, transcript_text, extracted_data | After each call |

**Fireflies.ai Integration (via API):**
- Meeting transcripts with speaker identification
- Action items and follow-ups
- Meeting summaries and topics
- Participant lists and durations
- Searchable across all meetings by keyword, date, participant

#### 3.1.5 Document & Data Room Data

| Table | Records (est.) | Key Fields | Update Frequency |
|-------|---------------|------------|------------------|
| `data_room_documents` | 1000+ | deal_id, folder_name, file_name, document_category | Weekly |
| `data_room_access` | 5000+ | deal_id, buyer_id, can_view_teaser/memo/data_room | Daily |
| `data_room_audit_log` | 20000+ | deal_id, document_id, user_id, action | Real-time |
| `lead_memos` | 200+ | deal_id, memo_type, content, html_content, status | Weekly |
| `document_tracked_links` | 1000+ | document_id, recipient, open_count | Real-time |

#### 3.1.6 Analytics & Activity Data

| Table | Records (est.) | Key Fields | Update Frequency |
|-------|---------------|------------|------------------|
| `listing_analytics` | 500+ | listing_id, views, saves, connection_requests | Real-time |
| `user_activity` | 100000+ | user_id, action_type, metadata | Real-time |
| `engagement_signals` | 50000+ | user_id, signal_type, listing_id | Real-time |
| `daily_metrics` | 365+ | date, signups, page_views, connections | Daily (cron) |

#### 3.1.7 Lead Source Data

| Table | Records (est.) | Key Fields | Update Frequency |
|-------|---------------|------------|------------------|
| `inbound_leads` | 500+ | source, company_name, industry, revenue | Daily |
| `valuation_leads` | 200+ | company_name, industry, revenue, status | Weekly |
| `captarget_sync_log` | 1000+ | sync status, deal mappings | Weekly |
| `industry_trackers` | 50+ | industry, criteria, tracked_companies | Monthly |

#### 3.1.8 Agreement & Compliance Data

| Table | Records (est.) | Key Fields | Update Frequency |
|-------|---------------|------------|------------------|
| `firm_agreements` | 500+ | firm_name, fee_agreement_status, nda_status | Weekly |
| `firm_members` | 2000+ | firm_id, profile_id | Weekly |

### 3.2 Cross-System Entity Resolution

The AI Command Center must resolve entities across systems:

| Entity | Primary Key | Cross-References |
|--------|-------------|-----------------|
| Deal/Listing | `listings.id` | `deals.listing_id`, `remarketing_scores.listing_id`, `call_transcripts.listing_id`, `connection_requests.listing_id` |
| Remarketing Buyer | `remarketing_buyers.id` | `remarketing_scores.buyer_id`, `deals.remarketing_buyer_id`, `outreach_records.buyer_id`, `buyer_contacts.buyer_id` |
| Marketplace Buyer | `profiles.id` | `connection_requests.user_id`, `deals.buyer_id`, `data_room_access.marketplace_user_id` |
| Admin User | `profiles.id` (is_admin=true) | `deals.owner_id`, `listings.primary_owner_id`, `deal_tasks.assigned_to` |
| Firm | `firm_agreements.id` | `firm_members.firm_id`, `connection_requests.firm_id` |

---

## 4. Functional Requirements

### FR-001: Natural Language Query Interface

**Priority:** P0 (Must Have)
**Description:** Users can type natural language questions and receive accurate, data-grounded responses.

**Acceptance Criteria:**
- Text input field accessible from every admin page (persistent sidebar or floating panel)
- Supports queries in natural conversational English
- Handles typos, abbreviations, and M&A-specific jargon
- Responds with structured, readable answers (not raw data dumps)
- Cites data sources in responses (e.g., "Based on 3 call transcripts from January...")
- Supports follow-up questions within conversation context

### FR-002: Deal Pipeline Intelligence

**Priority:** P0 (Must Have)
**Description:** Users can query the status, activity, and health of their deal pipeline.

**Supported Queries:**
- "What are my most active deals?"
- "Which deals are stalled in due diligence?"
- "Show me all deals in the LOI stage"
- "What happened on the Acme Corp deal this week?"
- "Which deals need attention?"
- "What's the pipeline value by stage?"

**Data Sources:** `deals`, `deal_stages`, `deal_activities`, `deal_tasks`, `deal_notes`, `deal_comments`, `listings`

### FR-003: Follow-Up Management

**Priority:** P0 (Must Have)
**Description:** Users can identify who needs follow-up and what actions are overdue.

**Supported Queries:**
- "Who do I need to follow up with?"
- "What are my overdue tasks?"
- "Which buyers haven't responded to outreach in 2 weeks?"
- "Show me deals with no activity in the last 7 days"
- "What follow-ups came out of my meetings this week?"

**Data Sources:** `deal_tasks`, `outreach_records`, `deal_activities`, `call_transcripts` (extracted action items), Fireflies action items

### FR-004: Buyer Intelligence & Search

**Priority:** P0 (Must Have)
**Description:** Users can search for and analyze buyers across all sources.

**Supported Queries:**
- "Do we have any deals in the lead sources that do HVAC in Florida?"
- "Find me PE firms that acquire plumbing companies in the Southeast"
- "Which buyers have the highest acquisition appetite?"
- "Show me buyers with fee agreements who target $5-15M revenue"
- "Who are the top-scored buyers for the ABC Plumbing deal?"
- "What's the deal breaker for Summit Capital on this deal?"

**Data Sources:** `remarketing_buyers`, `remarketing_scores`, `profiles`, `inbound_leads`, `valuation_leads`, `industry_trackers`, `buyer_contacts`

### FR-005: Meeting Intelligence

**Priority:** P0 (Must Have)
**Description:** Users can query meeting transcripts and Fireflies data for insights.

**Supported Queries:**
- "What did the CEO say about timing in the last call?"
- "Summarize my meeting with John from Summit Capital"
- "What action items came out of the Acme Corp call?"
- "Did the seller mention any competitors?"
- "Show me all meetings where pricing was discussed"
- "What meetings do I have coming up related to active deals?"

**Data Sources:** `call_transcripts`, `deal_transcripts`, `buyer_transcripts`, Fireflies.ai API (transcripts, action items, summaries)

### FR-006: Cross-System Search

**Priority:** P1 (Should Have)
**Description:** Users can search across all data sources with a single query.

**Supported Queries:**
- "Find everything related to HVAC in our system"
- "What do we know about Summit Capital Partners?"
- "Show me all touchpoints with Greenfield Advisors"
- "What's the history with any landscaping deals?"

**Data Sources:** All tables, full-text search, Fireflies keyword search

### FR-007: Pipeline Analytics

**Priority:** P1 (Should Have)
**Description:** Users can get analytical summaries and trends.

**Supported Queries:**
- "How many deals did we close this quarter?"
- "What's our average time from LOI to close?"
- "Which lead sources generate the most deals?"
- "Show me pipeline conversion rates by stage"
- "Compare this month's activity to last month"

**Data Sources:** `deals`, `deal_stages`, `deal_activities`, `daily_metrics`, `listing_analytics`

### FR-008: Proactive Alerts & Daily Briefings

**Priority:** P1 (Should Have)
**Description:** The system proactively notifies users of important events and generates daily briefings.

**Capabilities:**
- Morning briefing: "Here's what needs your attention today"
- Stale deal alerts: Deals with no activity beyond configurable threshold
- Follow-up reminders: Based on meeting action items and task due dates
- Score change notifications: When buyer scores change significantly
- New lead matches: When new leads match active deal criteria

### FR-009: Conversation Persistence

**Priority:** P1 (Should Have)
**Description:** Conversations are saved and can be resumed.

**Capabilities:**
- Automatic save of all conversations
- Resume previous conversations
- Search conversation history
- Share conversation excerpts with team members
- Conversation organized by context (deal, buyer, general)

**Data Sources:** `chat_conversations` (existing table)

### FR-010: Admin Context Awareness

**Priority:** P0 (Must Have)
**Description:** The chatbot understands which admin is asking and personalizes responses accordingly.

**Capabilities:**
- Knows which deals are assigned to the current user
- Filters "my deals" vs "all deals" based on ownership
- Understands team structure (who owns what)
- References the user by name in responses
- Respects data access permissions

---

## 5. Non-Functional Requirements

### NFR-001: Performance (Speed-First Architecture)

**Design principle:** Every query is fast by default. Depth is opt-in, not default.

| Metric | Requirement | Design Strategy |
|--------|------------|-----------------|
| Instant queries (counts, status checks) | < 1s P50 | Haiku direct answer, cache hits |
| Quick queries (single-tool lookups) | < 1.5s P50 | Haiku + 1 tool call, context bypass routing |
| Standard queries (multi-tool analysis) | < 3s P50 | Sonnet + 2-3 parallel tool calls |
| Complex queries (cross-system synthesis) | < 5s P50 | Sonnet + 4-5 parallel tool calls |
| Deep analysis (briefings, full reports) | < 10s P50 | Opus + 5-7 tool calls, only when explicitly requested |
| Response latency (P99 all queries) | < 15 seconds | Hard timeout with partial results |
| First token to screen | < 500ms | Streaming enabled on all tiers |
| Concurrent users | 20+ simultaneous | Edge function auto-scaling |
| Cache hit response time | < 100ms | In-memory TTL cache for aggregate queries |
| Router bypass response time | < 200ms saved | Context-based routing skips Haiku classification |

**Speed Optimization Stack:**
1. **Client-side:** Prefetch user context on login, Cmd+K opens in < 50ms, optimistic UI
2. **Router:** Cache hits (< 100ms), context bypass (skip router), compact Haiku classification (< 300ms)
3. **Tools:** 5s hard timeout, default limit 5 results, parallel dispatch, two-depth mode (quick/full)
4. **LLM:** Haiku for 40% of queries, prompt caching, compact tool results, max 500 tokens for quick answers

### NFR-002: Security

- All queries authenticated via Supabase JWT
- Admin role verification on every request
- No PII exposure in logs (query previews truncated)
- API keys stored in environment variables only
- Service role used for cross-user data access (existing pattern)
- Rate limiting: 100 queries/user/hour, 1000 queries/user/day
- Query input sanitization (max 2000 chars)
- No SQL injection vectors (Supabase client handles parameterization)

### NFR-003: Reliability

- 99.5% uptime (matches Supabase SLA)
- Graceful degradation when AI service is unavailable
- Automatic retry with exponential backoff for transient failures
- Fallback responses for common queries when AI is down

### NFR-004: Cost Management (Speed-Optimized Distribution)

| Model Tier | Use Case | % of Traffic | Cost per Query (est.) |
|-----------|----------|-------------|----------------------|
| Cache hit | Repeated aggregate queries | ~10% | $0.00 |
| Claude Haiku | Routing + simple direct answers | ~40% | $0.001-0.003 |
| Claude Sonnet | Standard multi-tool queries | ~45% | $0.01-0.02 |
| Claude Opus | Deep analysis (user-requested only) | ~5% | $0.05-0.10 |
| **Weighted Average** | **All queries** | **100%** | **< $0.02** |

Monthly budget target: < $300/month at 15,000 queries/month (lower than original estimate due to Haiku handling 40% of traffic)

### NFR-005: Observability

- Token usage tracking per query, per user, per model tier
- Query latency histograms
- Tool call success/failure rates
- Conversation feedback aggregation
- Daily cost reports
- Error rate monitoring with alerts

---

## 6. User Personas

### Persona 1: Deal Manager (Primary)

**Name:** Sarah - VP of Deals
**Role:** Manages 10-15 active deals simultaneously
**Daily Questions:**
- "What needs my attention today?"
- "Which deals are moving forward vs stalled?"
- "Who do I need to call back?"
- "What did the buyer say in our last meeting?"

**Pain Points:**
- Checks 5+ pages daily to get pipeline overview
- Loses track of follow-ups across many deals
- Can't quickly find meeting notes from weeks ago

### Persona 2: Business Development (Primary)

**Name:** Mike - Director of Business Development
**Role:** Sources new deals and matches with buyers
**Daily Questions:**
- "Do we have any HVAC companies in Florida?"
- "Which PE firms are actively acquiring in the Southeast?"
- "What buyers would be good for this new deal?"
- "Who has fee agreements and targets our deal profile?"

**Pain Points:**
- Manually searches buyer database with filters
- Can't search across CapTarget, GP Partners, and marketplace simultaneously
- Doesn't know which buyers are actively looking vs dormant

### Persona 3: Analyst (Secondary)

**Name:** Alex - M&A Analyst
**Role:** Prepares deal memos, scores buyers, manages data room
**Daily Questions:**
- "What's the score breakdown for this buyer-deal match?"
- "How complete is this buyer's profile?"
- "What documents has this buyer accessed?"
- "What are the key risks for this deal?"

**Pain Points:**
- Manually reviews score breakdowns one at a time
- Data quality issues aren't surfaced proactively
- Cross-referencing transcript insights with buyer profiles is tedious

### Persona 4: Team Lead (Primary)

**Name:** Chris - Managing Director
**Role:** Oversees team performance and pipeline health
**Daily Questions:**
- "How's the pipeline looking this quarter?"
- "Which team members have the most overdue tasks?"
- "What's our close rate this year?"
- "Are there any deals at risk?"

**Pain Points:**
- No single view of team performance
- Pipeline analytics require manual aggregation
- Can't quickly identify bottlenecks across the team

### Persona 5: Operations (Secondary)

**Name:** Jordan - Operations Manager
**Role:** Manages agreements, compliance, data quality
**Daily Questions:**
- "Which buyers need NDA follow-ups?"
- "How many fee agreements are pending?"
- "What's our data enrichment completion rate?"
- "Are there any duplicate buyer records?"

**Pain Points:**
- Agreement status scattered across multiple views
- Data quality monitoring requires manual review
- No proactive alerts for compliance gaps

---

## 7. Glossary

| Term | Definition |
|------|-----------|
| **Deal/Listing** | A business (company) being marketed for acquisition. Stored in `listings` table. |
| **Remarketing Buyer** | An external buyer (PE firm, strategic acquirer) tracked in `remarketing_buyers`. Not a platform user. |
| **Marketplace Buyer** | A registered platform user who browses deals. Stored in `profiles`. |
| **Universe** | A named grouping of buyers for targeted outreach (`remarketing_buyer_universes`). |
| **Score** | A composite buyer-deal fit score (0-100) computed across geography, size, and service dimensions. |
| **Tier** | Score classification: A (80-100), B (60-79), C (40-59), D (20-39), F (0-19). |
| **Pipeline Stage** | A step in the deal process (e.g., Lead, NDA, LOI, Due Diligence, Closed). |
| **Outreach** | A contact attempt to a buyer (email, call, memo send). |
| **CapTarget** | An external lead source for deal sourcing, synced via Google Sheets. |
| **GP Partners** | General Partner referral deal source. |
| **Fee Agreement** | A contractual agreement between SourceCo and a buyer firm regarding success fees. |
| **NDA** | Non-Disclosure Agreement required before sharing deal details. |
| **Data Room** | Secure document storage for deal-related files (teasers, memos, financials). |
| **Enrichment** | AI-powered data enhancement of buyer/deal profiles using web scraping and LLM extraction. |
| **Fireflies** | Fireflies.ai - meeting recording and transcription service integrated via API. |

---

## 8. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-23 | AI/CTO | Initial draft |
| 1.1 | 2026-02-23 | AI/CTO | Added speed-first design philosophy, updated performance NFRs with tiered latency targets, updated cost model with Haiku-heavy traffic distribution |
