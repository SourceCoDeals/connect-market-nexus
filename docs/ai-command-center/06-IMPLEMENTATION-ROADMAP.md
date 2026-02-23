# SourceCo AI Command Center - Implementation Roadmap

**Version:** 1.0
**Date:** 2026-02-23

---

## 1. Phase Overview

```
Phase 1: Foundation          Phase 2: Core Intelligence    Phase 3: Advanced Features
(Weeks 1-4)                  (Weeks 5-10)                  (Weeks 11-16)
|                            |                             |
|-- Backend scaffolding      |-- Buyer intelligence tools  |-- Fireflies deep integration
|-- Claude API integration   |-- Meeting intelligence      |-- Proactive alerts
|-- Deal pipeline tools      |-- Cross-source search       |-- Daily briefings
|-- Basic chat UI            |-- Follow-up management      |-- Vector search (RAG)
|-- Streaming infrastructure |-- Conversation persistence  |-- Analytics dashboard
|-- Auth + rate limiting     |-- Feedback system           |-- A/B testing framework
|                            |                             |
v                            v                             v
MVP: Deal queries work       Full: All core queries work   Complete: Production-ready

                                                           Phase 4: Polish & Scale
                                                           (Weeks 17-20)
                                                           |
                                                           |-- Performance optimization
                                                           |-- Prompt tuning from feedback
                                                           |-- Load testing at scale
                                                           |-- Documentation & training
                                                           |-- Production deployment
                                                           v
                                                           Launch: GA release
```

---

## 2. Phase 1: Foundation (Weeks 1-4)

### Week 1: Backend Scaffolding

| Task | Description | Deliverable |
|------|------------|-------------|
| 1.1 | Create `ai-command-center` edge function skeleton | `supabase/functions/ai-command-center/index.ts` |
| 1.2 | Set up Claude API client with streaming support | `supabase/functions/_shared/claude-client.ts` |
| 1.3 | Create tool registry and executor framework | `supabase/functions/ai-command-center/tools/index.ts` |
| 1.4 | Implement auth layer (JWT + admin check + rate limiting) | Auth middleware in edge function |
| 1.5 | Create database migration for usage tracking table | `supabase/migrations/XXXX_ai_command_center.sql` |
| 1.6 | Set up Anthropic API key in Supabase Vault | Environment configuration |

**Dependencies:** Anthropic API key provisioned, Supabase project access
**Risk:** None - uses established patterns from existing edge functions

### Week 2: Intent Router + Deal Pipeline Tools

| Task | Description | Deliverable |
|------|------------|-------------|
| 2.1 | Implement intent router (Haiku) | `router.ts` with classification prompt |
| 2.2 | Implement `query_deals` tool | Deal pipeline query with filters |
| 2.3 | Implement `get_deal_details` tool | Comprehensive deal detail retrieval |
| 2.4 | Implement `get_deal_activities` tool | Activity timeline for deals |
| 2.5 | Implement `get_deal_tasks` tool | Task retrieval with overdue detection |
| 2.6 | Implement `get_pipeline_summary` tool | Aggregate pipeline statistics |
| 2.7 | Implement `get_current_user_context` tool | User profile and owned deals |
| 2.8 | Write unit tests for all tools | 20+ unit tests |

**Milestone:** Can answer "What are my active deals?" end-to-end via API

### Week 3: Orchestrator + Streaming

| Task | Description | Deliverable |
|------|------------|-------------|
| 3.1 | Implement orchestrator with tool calling loop | `orchestrator.ts` |
| 3.2 | Build system prompt assembly | `system-prompt.ts` with dynamic context |
| 3.3 | Implement SSE streaming from edge function | Streaming response pipeline |
| 3.4 | Implement usage tracking and cost estimation | `usage-tracker.ts` |
| 3.5 | Write integration tests for deal query flows | 5 integration tests |
| 3.6 | Test multi-turn tool calling (sequential + parallel) | Verified tool loop behavior |

**Milestone:** Full deal pipeline query flow working with streaming

### Week 4: Basic Chat UI

| Task | Description | Deliverable |
|------|------------|-------------|
| 4.1 | Create `AICommandCenterProvider` context | React context for state management |
| 4.2 | Create `AICommandCenterPanel` component (sliding panel) | Chat panel UI with message list |
| 4.3 | Create `AICommandCenterTrigger` (floating button + Cmd+K) | Global trigger component |
| 4.4 | Implement SSE client for streaming responses | `useAICommandCenter` hook |
| 4.5 | Create message rendering with markdown support | `AssistantMessage` with markdown |
| 4.6 | Create tool call progress indicators | "Searching deals..." indicators |
| 4.7 | Add chat panel to `AdminLayout` | Available on all admin pages |
| 4.8 | Page context injection (deal page -> deal context) | Auto-context from current page |

**Phase 1 Exit Criteria:**
- [x] Admin user can open chat from any admin page
- [x] Can ask deal pipeline questions and get accurate, streamed responses
- [x] Tool calls visible as progress indicators
- [x] Usage tracked in database
- [x] Rate limiting enforced
- [x] Unit and integration tests passing

---

## 3. Phase 2: Core Intelligence (Weeks 5-10)

### Week 5: Buyer Intelligence Tools

| Task | Description | Deliverable |
|------|------------|-------------|
| 5.1 | Implement `search_buyers` tool (cross remarketing + profiles) | Buyer search with filters |
| 5.2 | Implement `get_buyer_profile` tool | Comprehensive buyer profile |
| 5.3 | Implement `get_score_breakdown` tool | Detailed scoring analysis |
| 5.4 | Implement `get_top_buyers_for_deal` tool | Ranked buyer list per deal |
| 5.5 | Implement service taxonomy for semantic matching | "HVAC" -> ["heating", "cooling", "mechanical"] |
| 5.6 | Write unit tests for buyer tools | 15+ unit tests |

**Milestone:** Can answer "Find HVAC buyers in Florida" and "Why is X a bad fit?"

### Week 6: Lead Source + Cross-System Search

| Task | Description | Deliverable |
|------|------------|-------------|
| 6.1 | Implement `search_lead_sources` tool | Cross-source lead search |
| 6.2 | Implement `search_industry_trackers` tool | M&A intelligence tracker search |
| 6.3 | Entity deduplication logic | Match same buyer across sources |
| 6.4 | Geographic adjacency integration in search | "Florida" expands to FL + adjacent states |
| 6.5 | Write integration tests for cross-system search | 5 integration tests |

**Milestone:** Single query searches across all lead sources simultaneously

### Week 7: Meeting Intelligence

| Task | Description | Deliverable |
|------|------------|-------------|
| 7.1 | Implement `search_transcripts` tool (local DB) | Transcript keyword search |
| 7.2 | Implement `search_fireflies` tool (API) | Fireflies.ai GraphQL integration |
| 7.3 | Implement `get_meeting_action_items` tool | Action item extraction |
| 7.4 | Two-tier transcript fallback (local -> Fireflies) | Automatic fallback logic |
| 7.5 | CEO detection integration in transcript search | Filter by ceo_detected field |
| 7.6 | Write unit + integration tests | 10+ tests |

**Milestone:** Can answer "What did the CEO say about timing?" using local transcripts + Fireflies

### Week 8: Follow-Up Management + Outreach Tools

| Task | Description | Deliverable |
|------|------------|-------------|
| 8.1 | Implement `get_outreach_status` tool | Outreach tracking with response detection |
| 8.2 | Implement `get_connection_requests` tool | Marketplace connection request queries |
| 8.3 | Build follow-up priority scoring logic | Composite urgency scoring |
| 8.4 | Cross-reference meeting action items with existing tasks | Dedup detection |
| 8.5 | Write tests for follow-up identification flow | 5+ integration tests |

**Milestone:** "Who do I need to follow up with?" returns comprehensive, prioritized results

### Week 9: Conversation Persistence + History

| Task | Description | Deliverable |
|------|------------|-------------|
| 9.1 | Integrate conversation save/load with chat UI | Auto-save on each message |
| 9.2 | Build conversation history panel | List of previous conversations |
| 9.3 | Implement conversation search | Full-text search across messages |
| 9.4 | Add "New Chat" / "Resume Chat" buttons | UI controls |
| 9.5 | Context-aware conversation titles (auto-generated) | "Deal analysis - Acme Corp" |
| 9.6 | Conversation archiving | Soft delete old conversations |

**Milestone:** Conversations persist, searchable, and resumable

### Week 10: Feedback System + Analytics Tools

| Task | Description | Deliverable |
|------|------------|-------------|
| 10.1 | Implement feedback buttons (thumbs up/down) | `ChatFeedbackButtons` component |
| 10.2 | Implement feedback modal with reason selection | Feedback form |
| 10.3 | Implement `get_analytics` tool | Platform analytics queries |
| 10.4 | Build initial usage dashboard (admin settings) | Query count, cost, feedback stats |
| 10.5 | Run full benchmark suite (100 queries) | Benchmark report |
| 10.6 | Fix issues found in benchmark | Prompt tuning, tool fixes |

**Phase 2 Exit Criteria:**
- [x] All 7 tool categories operational (deal, buyer, lead, transcript, outreach, analytics, user)
- [x] Cross-source search working
- [x] Fireflies integration working
- [x] Conversation persistence working
- [x] Feedback system working
- [x] Benchmark accuracy >= 95%
- [x] Zero hallucinations in benchmark
- [x] All 20 user stories from P0 testable

---

## 4. Phase 3: Advanced Features (Weeks 11-16)

### Week 11-12: Proactive Intelligence

| Task | Description |
|------|------------|
| 11.1 | Implement daily briefing generation | Scheduled or on-demand briefing |
| 11.2 | Implement stale deal detection alerts | Configurable inactivity thresholds |
| 11.3 | Implement new lead matching notifications | Match leads against active deal criteria |
| 11.4 | Build notification integration | In-app notifications for proactive alerts |

### Week 13-14: Vector Search (RAG)

| Task | Description |
|------|------------|
| 13.1 | Enable pgvector extension in Supabase | Database configuration |
| 13.2 | Create embeddings table and chunking pipeline | Transcript + buyer profile embeddings |
| 13.3 | Implement embedding generation (batch + incremental) | On transcript/buyer update |
| 13.4 | Implement semantic search tool | Vector similarity search |
| 13.5 | Integrate RAG into orchestrator | Automatic fallback for semantic queries |

### Week 15-16: Analytics Dashboard + A/B Testing

| Task | Description |
|------|------------|
| 15.1 | Build AI Command Center admin dashboard | Usage, cost, accuracy, feedback metrics |
| 15.2 | Implement prompt versioning system | A/B testing framework |
| 15.3 | Build cost management alerts | Daily budget monitoring |
| 15.4 | Implement query analytics | Popular queries, failure patterns |

---

## 5. Phase 4: Polish & Scale (Weeks 17-20)

### Week 17-18: Performance + Prompt Tuning

| Task | Description |
|------|------------|
| 17.1 | Analyze feedback data and tune prompts | Address top failure patterns |
| 17.2 | Implement Claude prompt caching | Cache system prompt prefix |
| 17.3 | Optimize tool result sizes | Reduce token usage |
| 17.4 | Implement response caching for common queries | Cache frequently asked questions |
| 17.5 | Load testing with 50 concurrent users | Verify scalability |

### Week 19-20: Production Readiness

| Task | Description |
|------|------------|
| 19.1 | Security audit | Penetration testing, injection testing |
| 19.2 | Documentation: user guide | How-to for admin users |
| 19.3 | Documentation: developer guide | Architecture, deployment, maintenance |
| 19.4 | Training sessions for admin team | Live demo and Q&A |
| 19.5 | Production deployment with monitoring | Staged rollout |
| 19.6 | Post-launch monitoring (1 week) | Active incident response |

---

## 6. Resource Requirements

### 6.1 Team Composition

| Role | Allocation | Responsibilities |
|------|-----------|-----------------|
| **AI/ML Engineer** | Full-time | Prompt engineering, tool design, Claude integration, evaluation |
| **Backend Engineer** | Full-time | Edge functions, database, Fireflies integration, infrastructure |
| **Frontend Engineer** | 50% (Weeks 1-4), 100% (Weeks 4-10) | Chat UI, streaming, state management |
| **QA Engineer** | 50% | Benchmark suite, integration tests, UAT |
| **Product Owner** | 25% | Requirements clarification, UAT sign-off, user training |

### 6.2 Infrastructure Requirements

| Resource | Specification | Cost (est.) |
|----------|--------------|-------------|
| Anthropic API | Claude Haiku, Sonnet, Opus access | $300-900/month |
| Supabase (existing) | Edge Functions compute | Included in existing plan |
| Fireflies.ai API | Business plan for API access | Existing subscription |
| pgvector (Phase 3) | Supabase extension | Included in existing plan |

### 6.3 Dependencies

| Dependency | Owner | Status | Needed By |
|-----------|-------|--------|-----------|
| Anthropic API key | DevOps | Not provisioned | Week 1 |
| Fireflies API key | DevOps | Exists | Week 7 |
| pgvector extension | DBA | Not enabled | Week 13 |
| Admin team availability for UAT | Product | TBD | Week 10, 20 |

---

## 7. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Claude API latency exceeds targets | Medium | High | Implement caching, optimize tool results, add timeout handling |
| Hallucination in production | Low | Critical | Zero-tolerance benchmark, post-processing validation, user feedback loop |
| Cost overrun | Medium | Medium | Model tier routing (Haiku for 20% of queries), tool call limits, daily budget alerts |
| Fireflies API reliability | Medium | Medium | Two-tier architecture with local fallback, graceful degradation |
| User adoption below target | Low | High | Training sessions, contextual onboarding tips, suggested questions |
| Data staleness (enrichment lag) | Medium | Low | Show data freshness indicators, last-enriched timestamps |
| Concurrent user scaling | Low | Medium | Edge function auto-scaling, connection pooling, rate limiting |

---

## 8. Success Metrics by Phase

| Metric | Phase 1 Target | Phase 2 Target | Phase 4 (Launch) Target |
|--------|---------------|---------------|----------------------|
| Supported query types | 5 (deal pipeline) | 20 (all categories) | 20+ |
| Benchmark accuracy | >= 90% | >= 95% | >= 97% |
| Hallucination rate | < 5% | 0% | 0% |
| P50 latency | < 5s | < 3s | < 3s |
| Daily active users | 2-3 (testing) | 50% of team | 100% of team |
| User satisfaction | N/A | >= 3.5/5 | >= 4.2/5 |
| Cost per query | < $0.05 | < $0.03 | < $0.03 |
| Test coverage | 50% | 80% | 90% |

---

## 9. Migration from Existing Chatbot

### 9.1 Current State

The platform has two existing chat endpoints:
- `chat-buyer-query`: Deal-buyer analysis chat (uses Gemini via Lovable AI Gateway)
- `chat-remarketing`: General remarketing chat (uses Gemini via Lovable AI Gateway)

### 9.2 Migration Strategy

**Phase 1-2:** AI Command Center runs alongside existing chatbots. No removal.

**Phase 3:** Evaluate whether existing chatbots should be migrated:
- If AI Command Center covers all use cases -> deprecate old chatbots
- If specialized chatbots still provide value -> keep both, cross-link

**Phase 4:** Decision point on migration:
- Option A: Replace existing chatbots with Command Center (recommended)
- Option B: Keep specialized chatbots, Command Center for general queries
- Option C: Unified interface that routes to specialized backends

### 9.3 Data Migration

- Existing `chat_conversations` table reused (add `source` column to distinguish)
- Existing `chat_tools.ts` tool definitions ported to new tool registry
- Existing `chat-persistence.ts` helpers reused
- No data loss during migration

---

## 10. Go-Live Checklist

### Pre-Launch (1 week before)

- [ ] All Phase 1-4 tasks complete
- [ ] Benchmark accuracy >= 97%
- [ ] Zero hallucinations in last 5 benchmark runs
- [ ] Security audit complete, no critical findings
- [ ] Load test: 50 concurrent users, < 5s P50, < 15s P99
- [ ] Monitoring dashboards configured (latency, errors, cost, feedback)
- [ ] Alerting configured (error rate > 5%, cost > $50/day, hallucination reported)
- [ ] Rollback plan documented and tested
- [ ] User documentation complete
- [ ] Training session scheduled

### Launch Day

- [ ] Deploy to production (off-peak hours)
- [ ] Verify auth + rate limiting in production
- [ ] Send 5 test queries, verify responses
- [ ] Monitor error rates for first hour
- [ ] Announce to team with getting-started guide
- [ ] Active monitoring for first 24 hours

### Post-Launch (1 week after)

- [ ] Daily feedback review
- [ ] Cost tracking against budget
- [ ] User adoption tracking
- [ ] Performance baseline established
- [ ] First prompt tuning based on real usage
- [ ] Team check-in for feedback and feature requests
