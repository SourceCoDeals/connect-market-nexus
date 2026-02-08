# Regression Test Suite

**Purpose:** Comprehensive test cases for audit fixes and data integrity features.

**Date:** 2026-02-08

**Coverage:** P0/P1 fixes, provenance validation, concurrency control, scoring engine

---

## Test Environment Setup

### Prerequisites
```bash
# 1. Apply all migrations
supabase db reset

# 2. Run migrations in order
supabase migration up

# 3. Seed test data (see Test Data Fixtures section)
psql -h localhost -U postgres -d postgres -f test_fixtures.sql
```

### Test Database State
- Clean buyer records (no contamination)
- Buyers with transcript sources
- Buyers with website sources only
- Buyers with partial data (for NULL score testing)
- Buyers with complete data (for baseline)

---

## 1. Provenance Validation Tests

### Test 1.1: analyze-buyer-notes Cannot Overwrite Transcript Fields
```typescript
describe('Provenance: analyze-buyer-notes', () => {
  it('should NOT overwrite transcript-protected fields', async () => {
    // Setup: Create buyer with transcript source
    const buyer = await createTestBuyer({
      company_name: 'Test PE Firm',
      target_revenue_min: 5000000, // From transcript
      target_revenue_max: 10000000,
      extraction_sources: [{
        type: 'transcript',
        transcript_id: 'test-123',
        extracted_at: '2026-02-08T10:00:00Z',
        fields_extracted: ['target_revenue_min', 'target_revenue_max'],
        confidence: 0.95,
      }],
    });

    // Execute: Analyze notes that suggest different revenue range
    const response = await fetch('/functions/v1/analyze-buyer-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyer_id: buyer.id,
        notes: 'Company is looking for $1-3M revenue deals only',
      }),
    });

    expect(response.status).toBe(200);

    // Verify: Revenue fields unchanged
    const updated = await getBuyer(buyer.id);
    expect(updated.target_revenue_min).toBe(5000000); // ✅ Protected
    expect(updated.target_revenue_max).toBe(10000000); // ✅ Protected

    // Verify: Enrichment event logged the skip
    const event = await getLatestEnrichmentEvent(buyer.id);
    expect(event.fields_skipped).toContain('target_revenue_min');
    expect(event.fields_skipped).toContain('target_revenue_max');
  });

  it('should update non-protected fields from notes', async () => {
    const buyer = await createTestBuyer({
      company_name: 'Test PE Firm',
      hq_state: null, // Not transcript-protected
      extraction_sources: [{
        type: 'transcript',
        fields_extracted: ['target_revenue_min'],
      }],
    });

    await fetch('/functions/v1/analyze-buyer-notes', {
      method: 'POST',
      body: JSON.stringify({
        buyer_id: buyer.id,
        notes: 'Firm is based in Texas',
      }),
    });

    const updated = await getBuyer(buyer.id);
    expect(updated.hq_state).toBe('TX'); // ✅ Updated
  });
});
```

### Test 1.2: bulk-import-remarketing Respects Provenance
```typescript
describe('Provenance: bulk-import-remarketing', () => {
  it('should NOT overwrite transcript-protected fields from CSV', async () => {
    // Setup: Buyer with transcript source
    const buyer = await createTestBuyer({
      company_name: 'Platform Co',
      thesis_summary: 'Focus on high-growth SaaS companies', // From transcript
      extraction_sources: [{
        type: 'transcript',
        fields_extracted: ['thesis_summary'],
      }],
    });

    // Execute: Import CSV with different thesis
    const csvData = {
      buyers: [{
        id: 'csv-1',
        platform_company_name: 'Platform Co',
        thesis_summary: 'CSV says: Focus on value acquisitions', // Should be blocked
        hq_city: 'Austin', // Should be updated
      }],
    };

    const response = await fetch('/functions/v1/bulk-import-remarketing', {
      method: 'POST',
      body: JSON.stringify({ action: 'import', data: csvData }),
    });

    expect(response.status).toBe(200);

    // Verify: Transcript field unchanged, non-protected field updated
    const updated = await getBuyer(buyer.id);
    expect(updated.thesis_summary).toBe('Focus on high-growth SaaS companies'); // ✅ Protected
    expect(updated.hq_city).toBe('Austin'); // ✅ Updated

    // Verify: CSV source tracked what was blocked
    expect(updated.extraction_sources).toContainEqual(
      expect.objectContaining({
        type: 'csv',
        blocked_fields: ['thesis_summary'],
      })
    );
  });

  it('should validate PE→Platform field separation', async () => {
    const csvData = {
      buyers: [{
        id: 'csv-2',
        platform_company_name: 'Platform Co',
        pe_firm_name: 'PE Firm LLC',
        business_summary: 'Platform provides X services', // PE→Platform violation
      }],
    };

    const response = await fetch('/functions/v1/bulk-import-remarketing', {
      method: 'POST',
      body: JSON.stringify({ action: 'import', data: csvData }),
    });

    const result = await response.json();
    expect(result.buyers.errors.length).toBeGreaterThan(0);
    expect(result.buyers.errors[0]).toContain('PROVENANCE VIOLATION');
  });
});
```

### Test 1.3: extract-buyer-transcript Can Override Everything
```typescript
describe('Provenance: extract-buyer-transcript', () => {
  it('should overwrite notes-derived data with transcript data', async () => {
    // Setup: Buyer with notes-derived data
    const buyer = await createTestBuyer({
      company_name: 'Test PE',
      target_revenue_min: 3000000, // From notes
      extraction_sources: [{
        type: 'notes',
        fields_extracted: ['target_revenue_min'],
      }],
    });

    // Execute: Extract transcript with different criteria
    const transcript = await createTestTranscript({
      buyer_id: buyer.id,
      transcript_text: 'We target $10-25M revenue companies...',
    });

    const response = await fetch('/functions/v1/extract-buyer-transcript', {
      method: 'POST',
      body: JSON.stringify({ transcript_id: transcript.id }),
    });

    expect(response.status).toBe(200);

    // Verify: Transcript overwrote notes data
    const updated = await getBuyer(buyer.id);
    expect(updated.target_revenue_min).toBe(10000000); // ✅ Overwritten
    expect(updated.extraction_sources).toContainEqual(
      expect.objectContaining({
        type: 'transcript',
        fields_extracted: expect.arrayContaining(['target_revenue_min']),
      })
    );
  });
});
```

---

## 2. Concurrency Control Tests

### Test 2.1: Enrichment Lock Prevents Concurrent Updates
```typescript
describe('Concurrency: Enrichment Lock', () => {
  it('should prevent concurrent analyze-buyer-notes + enrich-buyer', async () => {
    const buyer = await createTestBuyer({ company_name: 'Test Buyer' });

    // Start enrichment (acquires 60s lock)
    const enrichPromise = fetch('/functions/v1/enrich-buyer', {
      method: 'POST',
      body: JSON.stringify({ buyer_id: buyer.id }),
    });

    // Wait 100ms, then try notes analysis
    await sleep(100);

    const notesResponse = await fetch('/functions/v1/analyze-buyer-notes', {
      method: 'POST',
      body: JSON.stringify({
        buyer_id: buyer.id,
        notes: 'Test notes',
      }),
    });

    // Verify: Notes analysis rejected with 429
    expect(notesResponse.status).toBe(429);
    const notesData = await notesResponse.json();
    expect(notesData.error).toContain('enrichment in progress');

    // Wait for enrichment to complete
    const enrichResponse = await enrichPromise;
    expect(enrichResponse.status).toBe(200);
  });

  it('should allow notes analysis after lock expires', async () => {
    const buyer = await createTestBuyer({ company_name: 'Test Buyer' });

    // Acquire lock by updating data_last_updated
    await supabase
      .from('remarketing_buyers')
      .update({ data_last_updated: new Date().toISOString() })
      .eq('id', buyer.id);

    // Wait 61 seconds (lock expired)
    await sleep(61000);

    // Try notes analysis
    const response = await fetch('/functions/v1/analyze-buyer-notes', {
      method: 'POST',
      body: JSON.stringify({
        buyer_id: buyer.id,
        notes: 'Test notes',
      }),
    });

    // Verify: Allowed
    expect(response.status).toBe(200);
  });
});
```

### Test 2.2: Optimistic Locking Detects Concurrent Edits
```typescript
describe('Concurrency: Optimistic Locking', () => {
  it('should detect version conflicts on concurrent updates', async () => {
    const buyer = await createTestBuyer({
      company_name: 'Test Buyer',
      version: 1,
    });

    // User A reads buyer (version 1)
    const buyerA = await getBuyer(buyer.id);

    // User B updates buyer (version 1 → 2)
    const { error: updateBError } = await supabase
      .from('remarketing_buyers')
      .update({ target_revenue_min: 10000000 })
      .eq('id', buyer.id);

    expect(updateBError).toBeNull();

    // Verify version incremented
    const buyerAfterB = await getBuyer(buyer.id);
    expect(buyerAfterB.version).toBe(2);

    // User A tries to update (still thinks version is 1)
    const { error: updateAError } = await supabase
      .from('remarketing_buyers')
      .update({ target_revenue_min: 5000000 })
      .eq('id', buyer.id)
      .eq('version', buyerA.version); // Stale version

    // Verify: Update rejected (0 rows affected)
    expect(updateAError?.code).toBe('PGRST116'); // No rows returned

    // Verify: User B's update preserved
    const final = await getBuyer(buyer.id);
    expect(final.target_revenue_min).toBe(10000000); // User B's value
    expect(final.version).toBe(2);
  });
});
```

---

## 3. NULL-Aware Scoring Tests

### Test 3.1: NULL Scores for Missing Size Data
```typescript
describe('Scoring: NULL for Missing Data', () => {
  it('should return NULL size score when deal has no financials', async () => {
    const buyer = await createTestBuyer({
      target_revenue_min: 5000000,
      target_revenue_max: 15000000,
    });

    const deal = await createTestDeal({
      revenue: null, // Missing
      ebitda: null, // Missing
    });

    const response = await fetch('/functions/v1/score-buyer-deal', {
      method: 'POST',
      body: JSON.stringify({ buyer_id: buyer.id, listing_id: deal.id }),
    });

    const score = await response.json();
    expect(score.size_score).toBeNull(); // ✅ NULL, not 50
    expect(score.size_data_quality).toBe('missing_deal_financials');
    expect(score.size_suggestion).toContain('Add deal revenue');
  });

  it('should return NULL size score when buyer has no criteria', async () => {
    const buyer = await createTestBuyer({
      target_revenue_min: null, // Missing
      target_ebitda_min: null, // Missing
    });

    const deal = await createTestDeal({
      revenue: 8000000,
      ebitda: 1200000,
    });

    const response = await fetch('/functions/v1/score-buyer-deal', {
      method: 'POST',
      body: JSON.stringify({ buyer_id: buyer.id, listing_id: deal.id }),
    });

    const score = await response.json();
    expect(score.size_score).toBeNull();
    expect(score.size_data_quality).toBe('missing_buyer_criteria');
  });
});
```

### Test 3.2: NULL Composite Score When <3 Dimensions
```typescript
describe('Scoring: Composite Requires 3/4 Dimensions', () => {
  it('should return NULL composite when only 1 dimension', async () => {
    const buyer = await createTestBuyer({
      // Only geography data
      target_geographies: ['TX', 'CA'],
      target_revenue_min: null, // Size missing
      target_services: [], // Service missing
      thesis_summary: null, // Owner goals missing
    });

    const deal = await createTestDeal({
      revenue: 8000000,
      location: 'Texas',
    });

    const score = await scoreBuyerDeal(buyer.id, deal.id);

    expect(score.composite_score).toBeNull();
    expect(score._data_quality_diagnostic.scored_dimensions).toBe(1);
    expect(score._data_quality_diagnostic.missing_dimensions).toContain('size');
    expect(score._data_quality_diagnostic.missing_dimensions).toContain('service');
    expect(score._data_quality_diagnostic.missing_dimensions).toContain('owner_goals');
  });

  it('should return composite score when 3/4 dimensions', async () => {
    const buyer = await createTestBuyer({
      target_revenue_min: 5000000, // Size ✓
      target_services: ['HVAC'], // Service ✓
      target_geographies: ['TX'], // Geography ✓
      thesis_summary: null, // Owner goals ✗
    });

    const deal = await createTestDeal({
      revenue: 8000000,
      location: 'Texas',
      services: ['HVAC Repair'],
    });

    const score = await scoreBuyerDeal(buyer.id, deal.id);

    expect(score.composite_score).not.toBeNull(); // ✅ Has composite
    expect(score._data_quality_diagnostic.scored_dimensions).toBe(3);
  });
});
```

### Test 3.3: No Weight Redistribution
```typescript
describe('Scoring: No Weight Redistribution', () => {
  it('should NOT redistribute weights from missing dimensions', async () => {
    const buyer = await createTestBuyer({
      target_revenue_min: 5000000,
      target_services: ['HVAC'],
      target_geographies: [],  // Geography missing
      thesis_summary: null, // Owner goals missing
    });

    const deal = await createTestDeal({
      revenue: 8000000,
      services: ['HVAC Repair'],
      location: null,
    });

    const score = await scoreBuyerDeal(buyer.id, deal.id);

    // OLD BEHAVIOR (WRONG): Would redistribute geography/owner_goals weights to size/service
    // Size: 25 → 50, Service: 25 → 50
    // Composite: (80*50 + 90*50) / 100 = 85

    // NEW BEHAVIOR (CORRECT): Returns NULL composite when <3 dimensions
    expect(score.composite_score).toBeNull();
    expect(score.fit_reasoning).toContain('Insufficient data');
  });
});
```

---

## 4. Data Completeness Tests

### Test 4.1: Transcript Truncation (50k → 180k)
```typescript
describe('Transcript: Increased Capacity', () => {
  it('should handle transcripts up to 180k chars', async () => {
    const longTranscript = 'A'.repeat(170000); // 170k chars

    const transcript = await createTestTranscript({
      buyer_id: testBuyerId,
      transcript_text: longTranscript,
    });

    const response = await fetch('/functions/v1/extract-buyer-transcript', {
      method: 'POST',
      body: JSON.stringify({ transcript_id: transcript.id }),
    });

    expect(response.status).toBe(200);

    // Verify: No truncation warning
    const updated = await getTranscript(transcript.id);
    expect(updated.processing_status).toBe('completed');
    expect(updated.error_message).toBeNull();
  });

  it('should use smart truncation for transcripts >180k', async () => {
    const veryLongTranscript = 'A'.repeat(250000); // 250k chars

    const transcript = await createTestTranscript({
      buyer_id: testBuyerId,
      transcript_text: veryLongTranscript,
    });

    const response = await fetch('/functions/v1/extract-buyer-transcript', {
      method: 'POST',
      body: JSON.stringify({ transcript_id: transcript.id }),
    });

    expect(response.status).toBe(200);

    // Verify: Truncation warning logged
    const updated = await getTranscript(transcript.id);
    expect(updated.processing_status).toBe('completed_with_warnings');
    expect(updated.error_message).toContain('truncated');
  });
});
```

---

## 5. Error Handling Tests

### Test 5.1: DB Write Failures Are Surfaced
```typescript
describe('Error Handling: DB Writes', () => {
  it('should surface DB write errors in extract-buyer-transcript', async () => {
    const transcript = await createTestTranscript({
      buyer_id: 'non-existent-buyer-id', // Invalid FK
      transcript_text: 'Test transcript',
    });

    const response = await fetch('/functions/v1/extract-buyer-transcript', {
      method: 'POST',
      body: JSON.stringify({ transcript_id: transcript.id }),
    });

    expect(response.status).toBe(500);
    const error = await response.json();
    expect(error.error).toContain('buyer');

    // Verify: Error logged in transcript record
    const updated = await getTranscript(transcript.id);
    expect(updated.processing_status).toBe('completed_with_errors');
    expect(updated.error_message).not.toBeNull();
  });
});
```

---

## 6. Historical Contamination Tests

### Test 6.1: Contamination Detection
```typescript
describe('Contamination: Detection', () => {
  it('should flag PE→Platform field mixing', async () => {
    // Create buyer with contamination pattern
    const buyer = await createTestBuyer({
      company_name: 'Platform Co',
      pe_firm_name: 'PE Firm LLC', // PE firm
      business_summary: 'Provides HVAC services', // Platform field
      extraction_sources: [
        { type: 'pe_firm_website', fields_extracted: ['business_summary'] }
      ],
    });

    // Run contamination detection
    const { data: contaminated } = await supabase
      .rpc('detect_pe_platform_contamination');

    expect(contaminated).toContainEqual(
      expect.objectContaining({
        buyer_id: buyer.id,
        contamination_type: 'pe_to_platform',
        suspicious_fields: expect.arrayContaining(['business_summary']),
      })
    );
  });

  it('should reduce data_completeness for contaminated buyers', async () => {
    const buyer = await createTestBuyer({
      company_name: 'Platform Co',
      pe_firm_name: 'PE Firm',
      business_summary: 'Test',
      data_completeness: 80,
      extraction_sources: [{ type: 'pe_firm_website' }],
    });

    // Run migration to flag contamination
    await supabase.rpc('detect_pe_platform_contamination');

    const updated = await getBuyer(buyer.id);
    expect(updated.data_completeness).toBeLessThanOrEqual(60); // Reduced by 20
    expect(updated.data_quality_flags?.contamination_detected).toBe(true);
  });
});
```

---

## 7. Enrichment Event Logging Tests

### Test 7.1: Events Are Logged
```typescript
describe('Audit Trail: Enrichment Events', () => {
  it('should log successful enrichment with fields updated', async () => {
    const buyer = await createTestBuyer({ company_name: 'Test' });

    await fetch('/functions/v1/analyze-buyer-notes', {
      method: 'POST',
      body: JSON.stringify({
        buyer_id: buyer.id,
        notes: 'Looking for $5-10M revenue',
      }),
    });

    const events = await supabase
      .from('enrichment_event_log')
      .select('*')
      .eq('buyer_id', buyer.id)
      .eq('event_type', 'notes')
      .order('created_at', { ascending: false })
      .limit(1);

    expect(events.data?.length).toBe(1);
    expect(events.data[0].status).toBe('success');
    expect(events.data[0].fields_updated).toContain('target_revenue_min');
  });

  it('should log provenance blocks in events', async () => {
    const buyer = await createTestBuyer({
      company_name: 'Test',
      target_revenue_min: 5000000,
      extraction_sources: [{ type: 'transcript', fields_extracted: ['target_revenue_min'] }],
    });

    await fetch('/functions/v1/analyze-buyer-notes', {
      method: 'POST',
      body: JSON.stringify({
        buyer_id: buyer.id,
        notes: 'Actually looking for $1-3M',
      }),
    });

    const events = await supabase
      .from('enrichment_event_log')
      .select('*')
      .eq('buyer_id', buyer.id)
      .order('created_at', { ascending: false })
      .limit(1);

    expect(events.data[0].fields_skipped).toContain('target_revenue_min');
    expect(events.data[0].status).toBe('partial_success');
  });
});
```

---

## 8. Integration Test Scenarios

### Scenario 1: Complete Buyer Lifecycle
```typescript
describe('Integration: Buyer Lifecycle', () => {
  it('should maintain data integrity through entire lifecycle', async () => {
    // 1. Create buyer from CSV (low quality)
    let buyer = await importBuyerFromCSV({
      company_name: 'Test Platform',
      target_revenue_min: 5000000, // CSV data
    });

    expect(buyer.extraction_sources).toContainEqual(
      expect.objectContaining({ type: 'csv' })
    );

    // 2. Enrich from website (higher quality)
    await enrichBuyerFromWebsite(buyer.id);
    buyer = await getBuyer(buyer.id);

    expect(buyer.business_summary).not.toBeNull(); // Enriched

    // 3. Add transcript (highest quality)
    const transcript = await createTestTranscript({
      buyer_id: buyer.id,
      transcript_text: 'We target $10-25M revenue companies...',
    });

    await extractBuyerTranscript(transcript.id);
    buyer = await getBuyer(buyer.id);

    expect(buyer.target_revenue_min).toBe(10000000); // Transcript overwrote CSV

    // 4. Try to update via notes (should be blocked)
    await analyzeBuyerNotes(buyer.id, 'Looking for $1-3M deals');
    buyer = await getBuyer(buyer.id);

    expect(buyer.target_revenue_min).toBe(10000000); // ✅ Protected

    // 5. Verify enrichment trail
    expect(buyer.extraction_sources.length).toBeGreaterThanOrEqual(3);
    expect(buyer.extraction_sources.map(s => s.type)).toContain('transcript');
  });
});
```

### Scenario 2: Concurrent Operations
```typescript
describe('Integration: Concurrent Operations', () => {
  it('should handle concurrent enrichment + manual edit', async () => {
    const buyer = await createTestBuyer({ company_name: 'Test' });

    // Start long-running enrichment
    const enrichPromise = enrichBuyerFromWebsite(buyer.id);

    // User tries to edit buyer
    await sleep(500);
    const editResponse = await supabase
      .from('remarketing_buyers')
      .update({ hq_city: 'Austin' })
      .eq('id', buyer.id);

    // Wait for both
    await enrichPromise;
    const final = await getBuyer(buyer.id);

    // Verify: Both operations respected locks
    // One should have succeeded, other should have been blocked or retried
    expect(final.hq_city).toBeDefined();
    expect(final.business_summary).toBeDefined(); // Enrichment completed
  });
});
```

---

## 9. Performance Tests

### Test 9.1: Enrichment Event Log Queries
```typescript
describe('Performance: Monitoring Queries', () => {
  it('should run provenance block query in <500ms', async () => {
    // Seed 1000 enrichment events
    await seedEnrichmentEvents(1000);

    const start = Date.now();
    const { data } = await supabase
      .from('enrichment_event_log')
      .select('*')
      .not('fields_blocked', 'eq', '{}')
      .order('created_at', { ascending: false })
      .limit(50);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
    expect(data?.length).toBeGreaterThan(0);
  });

  it('should run contamination detection query in <2s', async () => {
    // Seed 500 buyers
    await seedBuyers(500);

    const start = Date.now();
    const { data } = await supabase.rpc('detect_pe_platform_contamination');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000);
  });
});
```

---

## Test Data Fixtures

```sql
-- test_fixtures.sql

-- Clean slate
TRUNCATE remarketing_buyers CASCADE;
TRUNCATE enrichment_event_log CASCADE;

-- Fixture 1: Buyer with transcript source (transcript-protected)
INSERT INTO remarketing_buyers (
  id, company_name, pe_firm_name, buyer_type,
  target_revenue_min, target_revenue_max, thesis_summary,
  extraction_sources, data_completeness
) VALUES (
  'buyer-transcript-protected',
  'PE Firm A',
  'PE Firm LLC',
  'platform',
  5000000,
  15000000,
  'Focus on high-growth software companies',
  '[{"type": "transcript", "transcript_id": "t1", "extracted_at": "2026-02-01T10:00:00Z", "fields_extracted": ["target_revenue_min", "target_revenue_max", "thesis_summary"], "confidence": 0.95}]'::jsonb,
  85
);

-- Fixture 2: Buyer with notes source only (notes-protected)
INSERT INTO remarketing_buyers (
  id, company_name, pe_firm_name, buyer_type,
  target_revenue_min, hq_city,
  extraction_sources, data_completeness
) VALUES (
  'buyer-notes-only',
  'PE Firm B',
  'Growth Partners',
  'platform',
  3000000,
  'Austin',
  '[{"type": "notes", "extracted_at": "2026-02-05T14:00:00Z", "fields_extracted": ["target_revenue_min"]}]'::jsonb,
  60
);

-- Fixture 3: Buyer with partial data (for NULL score testing)
INSERT INTO remarketing_buyers (
  id, company_name, buyer_type,
  target_geographies, target_revenue_min, target_services,
  data_completeness
) VALUES (
  'buyer-partial-data',
  'Strategic Buyer',
  'strategic',
  ARRAY['TX', 'CA'],
  NULL, -- Size missing
  ARRAY[]::text[], -- Service missing
  30
);

-- Fixture 4: Contaminated buyer (PE→Platform fields)
INSERT INTO remarketing_buyers (
  id, company_name, pe_firm_name, buyer_type,
  business_summary, services_offered,
  extraction_sources, data_completeness
) VALUES (
  'buyer-contaminated',
  'Platform Co',
  'PE Firm XYZ',
  'platform',
  'Provides HVAC and plumbing services', -- Platform field
  ARRAY['HVAC', 'Plumbing'], -- Platform field
  '[{"type": "pe_firm_website", "fields_extracted": ["business_summary", "services_offered"]}]'::jsonb,
  70
);

-- Fixture 5: Clean buyer with complete data
INSERT INTO remarketing_buyers (
  id, company_name, pe_firm_name, buyer_type,
  target_revenue_min, target_revenue_max,
  target_services, target_geographies, thesis_summary,
  extraction_sources, data_completeness
) VALUES (
  'buyer-complete',
  'Complete Buyer',
  'PE Firm Alpha',
  'platform',
  8000000,
  20000000,
  ARRAY['HVAC', 'Plumbing'],
  ARRAY['TX', 'CA', 'FL'],
  'Seeking bolt-on acquisitions in home services',
  '[{"type": "transcript", "fields_extracted": ["target_revenue_min", "target_revenue_max", "target_services", "target_geographies", "thesis_summary"]}]'::jsonb,
  95
);
```

---

## Manual Test Checklist

### Pre-Deployment Verification
- [ ] Run all migrations successfully
- [ ] Verify `version` column exists and trigger works
- [ ] Verify `enrichment_event_log` table exists
- [ ] Verify `data_quality_flags` column exists
- [ ] Seed test fixtures
- [ ] Run automated test suite (all tests pass)

### Functional Testing
- [ ] Update buyer in two tabs → Second tab detects conflict
- [ ] Analyze notes with transcript-protected buyer → Fields unchanged
- [ ] Import CSV with existing buyer → Transcript fields protected
- [ ] Extract transcript → Overwrites notes data
- [ ] Concurrent enrichment + edit → Lock prevents conflict
- [ ] Score buyer with missing size → NULL score returned
- [ ] Score buyer with 2 dimensions → NULL composite
- [ ] View contaminated buyer → Warning banner shown

### Performance Testing
- [ ] Enrichment event log queries < 500ms
- [ ] Contamination detection < 2s
- [ ] Buyer detail page load < 1s

### UI/UX Testing
- [ ] NULL score shows "Insufficient Data" message
- [ ] Data quality warning displayed correctly
- [ ] Source badges show correct icons/colors
- [ ] Optimistic locking error shows friendly message
- [ ] Query invalidation updates UI after mutations

---

## CI/CD Integration

```yaml
# .github/workflows/audit-tests.yml
name: Audit Regression Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase db reset
      - run: npm run test:audit
```

---

## Next Steps

1. **Run test suite** and verify all tests pass
2. **Deploy migrations** to staging environment
3. **Run manual test checklist**
4. **Monitor enrichment event log** for first 24 hours
5. **Review contamination report** and fix high-risk cases
6. **Update frontend** per UI/UX hardening guide
7. **Deploy to production** with rollback plan ready
