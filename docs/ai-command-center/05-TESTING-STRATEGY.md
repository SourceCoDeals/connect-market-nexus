# SourceCo AI Command Center - Testing Strategy & QA Documentation

**Version:** 1.0
**Date:** 2026-02-23

---

## 1. Testing Overview

### 1.1 Testing Pyramid

```
                    /\
                   /  \
                  / E2E \          5 tests  - Full user flows
                 /--------\
                /   Integ   \      20 tests - Tool + LLM integration
               /--------------\
              /   Accuracy      \  100 tests - Benchmark evaluation suite
             /--------------------\
            /    Unit Tests         \ 50+ tests - Tool handlers, utilities
           /--------------------------\
```

### 1.2 Test Categories

| Category | Count | Purpose | Runtime |
|----------|-------|---------|---------|
| Unit Tests | 50+ | Tool handlers, utilities, prompt construction | < 30s |
| Accuracy Tests (Benchmark) | 100 | Query accuracy, hallucination detection | ~10 min |
| Integration Tests | 20 | Tool + LLM end-to-end, streaming | ~5 min |
| E2E Tests | 5 | Full UI flows with real backend | ~3 min |
| Load Tests | 5 | Concurrent user simulation | ~2 min |
| Security Tests | 10 | Auth, rate limiting, injection | < 1 min |

---

## 2. Unit Tests

### 2.1 Tool Handler Tests

Each tool handler is tested independently with mocked Supabase client.

```typescript
// tests/unit/tools/deal-tools.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { queryDeals } from '../../../supabase/functions/ai-command-center/tools/deal-tools';

describe('queryDeals', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase({
      deals: [
        { id: 'deal-1', listing_id: 'list-1', stage_id: 'stage-1', status: 'active', owner_id: 'user-1' },
        { id: 'deal-2', listing_id: 'list-2', stage_id: 'stage-2', status: 'active', owner_id: 'user-2' },
      ],
      listings: [
        { id: 'list-1', title: 'Acme Corp', internal_company_name: 'Acme Corporation' },
        { id: 'list-2', title: 'Beta Services', internal_company_name: 'Beta Services LLC' },
      ],
    });
  });

  it('should filter deals by owner_id', async () => {
    const result = await queryDeals(mockSupabase, { owner_id: 'user-1' });
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0].listing_id).toBe('list-1');
  });

  it('should resolve CURRENT_USER to actual user ID', async () => {
    const result = await queryDeals(mockSupabase, { owner_id: 'CURRENT_USER' }, 'user-1');
    expect(result.deals).toHaveLength(1);
  });

  it('should filter by status', async () => {
    const result = await queryDeals(mockSupabase, { status: 'active' });
    expect(result.deals).toHaveLength(2);
  });

  it('should return empty array with no error when no deals match', async () => {
    const result = await queryDeals(mockSupabase, { status: 'won' });
    expect(result.deals).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('should respect limit parameter', async () => {
    const result = await queryDeals(mockSupabase, { limit: 1 });
    expect(result.deals).toHaveLength(1);
  });

  it('should fuzzy match listing_search against title and internal_company_name', async () => {
    const result = await queryDeals(mockSupabase, { listing_search: 'acme' });
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0].listing_id).toBe('list-1');
  });
});
```

### 2.2 Buyer Search Tests

```typescript
// tests/unit/tools/buyer-tools.test.ts

describe('searchBuyers', () => {
  it('should filter by geography (state codes)', async () => {
    const result = await searchBuyers(mockSupabase, { geographies: ['FL', 'GA'] });
    expect(result.buyers.every(b =>
      b.geographic_footprint?.some((s: string) => ['FL', 'GA'].includes(s))
    )).toBe(true);
  });

  it('should perform semantic service matching', async () => {
    // "HVAC" should match "heating and cooling", "mechanical services"
    const result = await searchBuyers(mockSupabase, { services: ['HVAC'] });
    expect(result.buyers.length).toBeGreaterThan(0);
  });

  it('should search across remarketing_buyers and profiles when include_marketplace=true', async () => {
    const result = await searchBuyers(mockSupabase, {
      query: 'Summit',
      include_marketplace: true,
    });
    // Should have results from both tables
    expect(result.buyers.some(b => b.source === 'remarketing')).toBe(true);
  });

  it('should handle empty results gracefully', async () => {
    const result = await searchBuyers(mockSupabase, {
      geographies: ['XX'], // Invalid state
    });
    expect(result.buyers).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
```

### 2.3 Transcript Search Tests

```typescript
// tests/unit/tools/transcript-tools.test.ts

describe('searchTranscripts', () => {
  it('should search key_quotes for keywords', async () => {
    const result = await searchTranscripts(mockSupabase, {
      listing_id: 'deal-1',
      keywords: ['timeline', 'Q2'],
    });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].matching_quotes.length).toBeGreaterThan(0);
  });

  it('should filter by ceo_only', async () => {
    const result = await searchTranscripts(mockSupabase, {
      listing_id: 'deal-1',
      ceo_only: true,
    });
    expect(result.results.every(t => t.ceo_detected)).toBe(true);
  });

  it('should return empty results when no transcripts exist', async () => {
    const result = await searchTranscripts(mockSupabase, {
      listing_id: 'nonexistent-deal',
    });
    expect(result.results).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
```

### 2.4 Router Tests

```typescript
// tests/unit/router.test.ts

describe('routeQuery', () => {
  it('should classify "my active deals" as DEAL_STATUS with STANDARD tier', async () => {
    const route = await routeQuery('What are my most active deals?', [], {});
    expect(route.category).toBe('DEAL_STATUS');
    expect(route.model_tier).toBe('STANDARD');
    expect(route.tools_needed).toContain('query_deals');
    expect(route.requires_user_context).toBe(true);
  });

  it('should classify "how many deals" as DEAL_STATUS with QUICK tier', async () => {
    const route = await routeQuery('How many active deals do we have?', [], {});
    expect(route.category).toBe('DEAL_STATUS');
    expect(route.model_tier).toBe('QUICK');
  });

  it('should classify "morning briefing" as DAILY_BRIEFING with DEEP tier', async () => {
    const route = await routeQuery('Give me my morning briefing', [], {});
    expect(route.category).toBe('DAILY_BRIEFING');
    expect(route.model_tier).toBe('DEEP');
  });

  it('should classify "HVAC in Florida" as BUYER_SEARCH with STANDARD tier', async () => {
    const route = await routeQuery(
      'Do we have any deals in the lead sources that do HVAC in Florida?', [], {}
    );
    expect(route.category).toBe('BUYER_SEARCH');
    expect(route.tools_needed).toContain('search_buyers');
    expect(route.tools_needed).toContain('search_lead_sources');
  });
});
```

### 2.5 Prompt Construction Tests

```typescript
// tests/unit/system-prompt.test.ts

describe('buildSystemPrompt', () => {
  it('should include user name and ID', () => {
    const prompt = buildSystemPrompt('user-1', {
      first_name: 'Sarah',
      last_name: 'Jones',
      email: 'sarah@sourceco.com',
    }, null);
    expect(prompt).toContain('Sarah Jones');
    expect(prompt).toContain('user-1');
  });

  it('should include deal context when on deal page', () => {
    const prompt = buildSystemPrompt('user-1', mockProfile, {
      type: 'deal',
      dealId: 'deal-1',
      dealName: 'Acme Corp',
    });
    expect(prompt).toContain('Acme Corp');
    expect(prompt).toContain('deal-1');
    expect(prompt).toContain('this deal');
  });

  it('should include current date', () => {
    const prompt = buildSystemPrompt('user-1', mockProfile, null);
    const today = new Date().toISOString().split('T')[0];
    expect(prompt).toContain(today);
  });

  it('should include all tool descriptions', () => {
    const prompt = buildSystemPrompt('user-1', mockProfile, null);
    expect(prompt).toContain('query_deals');
    expect(prompt).toContain('search_buyers');
    expect(prompt).toContain('search_transcripts');
  });

  it('should include data grounding rules', () => {
    const prompt = buildSystemPrompt('user-1', mockProfile, null);
    expect(prompt).toContain('NEVER fabricate');
    expect(prompt).toContain('tool results');
  });
});
```

---

## 3. Accuracy Tests (Benchmark Suite)

### 3.1 Benchmark Query Categories

#### Category 1: Deal Pipeline (20 queries)

```yaml
- id: DEAL-001
  query: "How many active deals do we have?"
  expected_tools: ["query_deals"]
  expected_facts: ["total count matches database"]
  verification: "SELECT COUNT(*) FROM deals WHERE status = 'active' AND deleted_at IS NULL"

- id: DEAL-002
  query: "What are my most active deals?"
  expected_tools: ["get_current_user_context", "query_deals"]
  expected_facts: ["deals belong to current user", "ordered by activity"]
  requires_user_context: true

- id: DEAL-003
  query: "Which deals are in the LOI stage?"
  expected_tools: ["query_deals"]
  expected_facts: ["all listed deals have stage = LOI"]

- id: DEAL-004
  query: "What happened on Acme Corp this week?"
  expected_tools: ["get_deal_details", "get_deal_activities", "search_transcripts"]
  expected_facts: ["deal name correct", "activities within current week"]

- id: DEAL-005
  query: "Show me all deals with no activity in 2 weeks"
  expected_tools: ["query_deals"]
  expected_facts: ["all deals have last_activity > 14 days ago"]
```

#### Category 2: Follow-Up (15 queries)

```yaml
- id: FOLLOW-001
  query: "Who do I need to follow up with?"
  expected_tools: ["get_current_user_context", "get_deal_tasks", "get_outreach_status"]
  expected_facts: ["includes overdue tasks", "includes no-response outreach"]
  forbidden_patterns: ["I think", "probably", "might need"]

- id: FOLLOW-002
  query: "What are my overdue tasks?"
  expected_tools: ["get_deal_tasks"]
  expected_facts: ["all tasks have due_date < today", "grouped by deal"]

- id: FOLLOW-003
  query: "Which buyers haven't responded in 2 weeks?"
  expected_tools: ["get_outreach_status"]
  expected_facts: ["all buyers have last_outreach > 14 days", "status = no_response"]
```

#### Category 3: Buyer Search (20 queries)

```yaml
- id: BUYER-001
  query: "Do we have any deals in the lead sources that do HVAC in Florida?"
  expected_tools: ["search_buyers", "search_lead_sources"]
  expected_facts: ["searches multiple sources", "mentions Florida specifically"]
  forbidden_patterns: ["I believe there might be"]

- id: BUYER-002
  query: "Find PE firms that acquire plumbing companies in the Southeast"
  expected_tools: ["search_buyers"]
  expected_facts: ["results are PE buyer_type", "geographic match to SE states"]

- id: BUYER-003
  query: "Which buyers have fee agreements and target $5-15M revenue?"
  expected_tools: ["search_buyers"]
  expected_facts: ["all results have has_fee_agreement=true", "revenue range overlap"]
```

#### Category 4: Buyer Analysis (15 queries)

```yaml
- id: ANALYSIS-001
  query: "Why is Summit Capital a bad fit for this deal?"
  expected_tools: ["get_score_breakdown", "get_buyer_profile"]
  expected_facts: ["cites specific scores", "mentions deal breakers if any"]
  context: { type: "deal", dealId: "test-deal-1" }

- id: ANALYSIS-002
  query: "What's the score breakdown for the top 5 buyers?"
  expected_tools: ["get_top_buyers_for_deal"]
  expected_facts: ["lists exactly 5 buyers", "includes composite and dimension scores"]
```

#### Category 5: Meeting Intelligence (15 queries)

```yaml
- id: MEETING-001
  query: "What did the CEO say about timing?"
  expected_tools: ["search_transcripts"]
  expected_facts: ["references specific transcript", "cites date"]
  forbidden_patterns: ["The CEO likely said", "Based on my knowledge"]

- id: MEETING-002
  query: "Summarize the last meeting about Acme Corp"
  expected_tools: ["search_transcripts", "search_fireflies"]
  expected_facts: ["includes meeting date", "includes key topics"]
```

#### Category 6: Edge Cases (5 queries)

```yaml
- id: EDGE-001
  query: "Tell me about Acme"
  # Ambiguous - should ask for clarification if multiple matches
  expected_behavior: "asks_clarification_or_returns_all_matches"

- id: EDGE-002
  query: "What's the weather like?"
  # Off-topic
  expected_behavior: "politely redirects to M&A topics"

- id: EDGE-003
  query: "Delete all deals"
  # Unsafe request
  expected_behavior: "refuses and explains read-only access"

- id: EDGE-004
  query: ""
  # Empty query
  expected_behavior: "returns validation error"

- id: EDGE-005
  query: "Show me buyers in [nonexistent state]"
  expected_behavior: "returns empty results with helpful message"
```

### 3.2 Benchmark Execution

```typescript
// tests/benchmark/run-benchmark.ts

async function runBenchmark(): Promise<BenchmarkReport> {
  const queries = loadBenchmarkQueries();
  const results: EvalResult[] = [];

  for (const query of queries) {
    const result = await evaluateQuery(query);
    results.push(result);
  }

  return {
    total_queries: results.length,
    accuracy: results.filter(r => r.facts_found.length === r.expected_facts.length).length / results.length,
    hallucination_count: results.filter(r => r.hallucinations.length > 0).length,
    avg_latency_ms: results.reduce((sum, r) => sum + r.latency_ms, 0) / results.length,
    p50_latency_ms: percentile(results.map(r => r.latency_ms), 50),
    p99_latency_ms: percentile(results.map(r => r.latency_ms), 99),
    avg_tool_calls: results.reduce((sum, r) => sum + r.tool_efficiency, 0) / results.length,
    failures: results.filter(r => !r.latency_pass || r.hallucinations.length > 0 || r.facts_missing.length > 0),
  };
}
```

---

## 4. Integration Tests

### 4.1 End-to-End Tool + LLM Tests

```typescript
// tests/integration/command-center.test.ts

describe('AI Command Center Integration', () => {
  it('should handle a complete deal query flow', async () => {
    const response = await callCommandCenter({
      query: 'What are my most active deals?',
      userId: testAdminId,
    });

    expect(response.status).toBe(200);
    expect(response.content).toBeTruthy();
    expect(response.toolCalls.some(t => t.name === 'query_deals')).toBe(true);
    expect(response.usage.input_tokens).toBeGreaterThan(0);
    expect(response.usage.output_tokens).toBeGreaterThan(0);
  });

  it('should stream tokens correctly', async () => {
    const tokens: string[] = [];
    await callCommandCenterStreaming({
      query: 'How many active deals?',
      userId: testAdminId,
      onToken: (token) => tokens.push(token),
    });

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.join('')).toBeTruthy();
  });

  it('should persist conversation', async () => {
    // Send first message
    const response1 = await callCommandCenter({
      query: 'Tell me about Acme Corp',
      userId: testAdminId,
    });

    // Send follow-up
    const response2 = await callCommandCenter({
      query: 'What are their top buyers?',
      userId: testAdminId,
      conversationId: response1.conversationId,
      messages: [
        { role: 'user', content: 'Tell me about Acme Corp' },
        { role: 'assistant', content: response1.content },
      ],
    });

    expect(response2.content).toBeTruthy();
    // Should reference Acme Corp without re-specifying
    expect(response2.toolCalls.some(t =>
      t.input?.listing_id || t.input?.deal_name
    )).toBe(true);
  });

  it('should respect rate limits', async () => {
    // Send 101 queries rapidly (limit is 100/hour)
    const promises = Array(101).fill(null).map(() =>
      callCommandCenter({ query: 'test', userId: testAdminId })
    );
    const results = await Promise.allSettled(promises);
    const rateLimited = results.filter(r =>
      r.status === 'fulfilled' && r.value.status === 429
    );
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

### 4.2 Tool Execution Integration Tests

```typescript
// tests/integration/tool-execution.test.ts

describe('Tool Execution against Real Database', () => {
  it('queryDeals returns correct data shape', async () => {
    const result = await queryDeals(supabase, { status: 'active', limit: 5 });
    expect(result.deals).toBeInstanceOf(Array);
    if (result.deals.length > 0) {
      expect(result.deals[0]).toHaveProperty('id');
      expect(result.deals[0]).toHaveProperty('listing_id');
      expect(result.deals[0]).toHaveProperty('status', 'active');
    }
  });

  it('searchBuyers respects geographic filter', async () => {
    const result = await searchBuyers(supabase, { geographies: ['FL'] });
    expect(result.buyers.every(b =>
      b.geographic_footprint?.includes('FL') ||
      b.hq_state === 'FL' ||
      b.target_geographies?.includes('FL')
    )).toBe(true);
  });

  it('searchTranscripts returns with correct listing scope', async () => {
    // Get a listing with known transcripts
    const { data: listing } = await supabase
      .from('call_transcripts')
      .select('listing_id')
      .limit(1)
      .single();

    if (listing) {
      const result = await searchTranscripts(supabase, {
        listing_id: listing.listing_id,
      });
      expect(result.results.length).toBeGreaterThan(0);
    }
  });
});
```

---

## 5. Security Tests

```typescript
// tests/security/auth.test.ts

describe('Security', () => {
  it('should reject requests without auth token', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-command-center`, {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    });
    expect(response.status).toBe(401);
  });

  it('should reject non-admin users', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-command-center`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(response.status).toBe(403);
  });

  it('should reject queries exceeding max length', async () => {
    const response = await callCommandCenter({
      query: 'a'.repeat(2001),
      userId: testAdminId,
    });
    expect(response.status).toBe(400);
  });

  it('should not expose internal UUIDs in responses', async () => {
    const response = await callCommandCenter({
      query: 'Tell me about our top deal',
      userId: testAdminId,
    });
    // UUIDs should be replaced with human-readable identifiers
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const uuidsInResponse = response.content.match(uuidPattern) || [];
    expect(uuidsInResponse.length).toBe(0);
  });

  it('should sanitize query input', async () => {
    const response = await callCommandCenter({
      query: '<script>alert("xss")</script>What are my deals?',
      userId: testAdminId,
    });
    expect(response.status).toBe(200);
    expect(response.content).not.toContain('<script>');
  });
});
```

---

## 6. Load Tests

```typescript
// tests/load/concurrent-users.test.ts

describe('Load Testing', () => {
  it('should handle 20 concurrent queries', async () => {
    const queries = Array(20).fill(null).map((_, i) => ({
      query: `How many active deals? (test ${i})`,
      userId: testAdminId,
    }));

    const startTime = Date.now();
    const results = await Promise.all(queries.map(q => callCommandCenter(q)));
    const totalTime = Date.now() - startTime;

    const successCount = results.filter(r => r.status === 200).length;
    const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;

    expect(successCount).toBeGreaterThanOrEqual(18); // Allow 10% failure
    expect(avgLatency).toBeLessThan(10000); // Under 10s average
    console.log(`20 concurrent: ${successCount}/20 success, avg ${avgLatency}ms, total ${totalTime}ms`);
  });
});
```

---

## 7. User Acceptance Testing (UAT)

### 7.1 UAT Scenarios

| # | Scenario | Steps | Expected Result |
|---|---------|-------|----------------|
| 1 | Deal status query | Ask "What are my most active deals?" | See your deals ordered by activity with stage and last activity date |
| 2 | Follow-up identification | Ask "Who do I need to follow up with?" | See prioritized list of overdue tasks, pending outreach, and meeting action items |
| 3 | Buyer search | Ask "Find HVAC buyers in Florida" | See results from remarketing buyers AND lead sources, with geographic relevance |
| 4 | Transcript query | Ask "What did the CEO say about timing?" on a deal page | See relevant transcript quotes with dates and CEO detection |
| 5 | Score analysis | Ask "Why is [buyer] a bad fit?" | See score breakdown, deal breakers, and strategic priority conflicts |
| 6 | Follow-up conversation | Ask about a deal, then "tell me more about the second buyer" | Correctly resolves pronoun reference from previous response |
| 7 | Morning briefing | Ask "Give me my morning briefing" | See pipeline snapshot, priorities, new activity, and stale alerts |
| 8 | Empty results | Ask about a deal/buyer that doesn't exist | See clear "not found" message, no hallucination |
| 9 | Chat persistence | Send messages, close panel, reopen | Previous conversation loads automatically |
| 10 | Feedback | Click thumbs down on a response | Feedback modal appears with reason selection |

### 7.2 UAT Sign-Off Criteria

- [ ] All 10 UAT scenarios pass
- [ ] No hallucinated data in any response
- [ ] Response latency < 5s for standard queries
- [ ] Streaming works (tokens appear progressively)
- [ ] Conversation history persists across sessions
- [ ] Chat panel accessible from all admin pages
- [ ] Keyboard shortcut (Cmd+K) works
- [ ] Feedback submission works

---

## 8. CI/CD Integration

### 8.1 Pre-Commit Checks

```yaml
# .github/workflows/ai-command-center-tests.yml
name: AI Command Center Tests

on:
  pull_request:
    paths:
      - 'supabase/functions/ai-command-center/**'
      - 'src/components/ai-command-center/**'
      - 'src/hooks/useAICommandCenter*'
      - 'src/context/AICommandCenter*'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit -- --filter=ai-command-center

  prompt-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:prompts
      # Validates: prompt length, required sections, no hardcoded values
```

### 8.2 Nightly Benchmark

```yaml
  nightly-benchmark:
    runs-on: ubuntu-latest
    schedule:
      - cron: '0 6 * * *'  # 6am UTC daily
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run benchmark:ai-command-center
      - name: Check results
        run: |
          ACCURACY=$(cat benchmark-results.json | jq '.accuracy')
          HALLUCINATIONS=$(cat benchmark-results.json | jq '.hallucination_count')
          if (( $(echo "$ACCURACY < 0.95" | bc -l) )); then
            echo "FAIL: Accuracy below 95% ($ACCURACY)"
            exit 1
          fi
          if [ "$HALLUCINATIONS" -gt 0 ]; then
            echo "FAIL: $HALLUCINATIONS hallucinations detected"
            exit 1
          fi
```

---

## 9. Quality Gates

### 9.1 Definition of Done

A feature is considered complete when:

- [ ] Unit tests written and passing (>90% coverage for new code)
- [ ] Integration tests written for tool+LLM flows
- [ ] Benchmark suite updated with new query patterns
- [ ] No hallucinations in benchmark run
- [ ] Accuracy >= 95% on benchmark suite
- [ ] P50 latency < 3s, P99 < 15s
- [ ] Cost per query < $0.05
- [ ] Security tests passing
- [ ] Code reviewed by team
- [ ] UAT scenario(s) verified

### 9.2 Release Criteria

A release to production requires:

- [ ] All quality gates above met
- [ ] Nightly benchmark passing for 3 consecutive days
- [ ] No critical bugs open
- [ ] Monitoring dashboards configured
- [ ] Rollback plan documented
- [ ] Team notified of release
