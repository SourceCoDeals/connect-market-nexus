

# Fix M&A Guide: Word Count, References, and Prompt Improvements

## Current State Analysis

### Information Flow
The guide generation pulls information through this chain:

```text
User Input (Industry Name + Clarification Context)
    ↓
buildClarificationContext() - Lines 137-172
    - industry_overview
    - segments
    - example_companies
    - geography_focus
    - revenue_range
    - Custom answers
    ↓
getPhasePrompts(industryName) - Lines 819-1061
    - 13 separate prompts (1a-4b)
    - Each prompt is industry-specific
    - Previous content (last 8000 chars) passed as context
    ↓
generatePhaseContentWithModel() - Lines 714-815
    - Calls Claude API with system prompt + phase prompt
    - max_tokens: 4000 (critical) / 3500 (standard)
    ↓
Content returned and concatenated
```

### Current Phase Structure (13 Phases)

| Phase | Name | Focus | Token Limit |
|-------|------|-------|-------------|
| 1a | Industry Definition | NAICS codes, market size, segmentation | 3,500 |
| 1b | Terminology & Business Models | Glossary, revenue models | 3,500 |
| 1c | Industry Economics | P&L benchmarks, unit economics | 3,500 |
| 1d | Ecosystem & Competitive Landscape | Customers, suppliers, acquirers | 3,500 |
| 1e | Target Buyer Profiles | Buyer types with buy boxes - CRITICAL | 4,000 |
| 2a | Financial Attractiveness | EBITDA categories, margins | 3,500 |
| 2b | Operational Attractiveness | KPIs, management, technology | 3,500 |
| 2c | Strategic & Geographic | Market tiers, geography preferences | 3,500 |
| 3a | Seller Evaluation Scorecards | Scoring matrix, rubrics | 3,500 |
| 3b | Buyer Fit Criteria Summary | Size/Service/Geography - CRITICAL | 4,000 |
| 3c | Example Evaluation | Worked example with scoring | 3,500 |
| 4a | Structured Criteria Output | Machine-parseable format - CRITICAL | 4,000 |
| 4b | Quality Validation | Completeness check | 3,500 |

### Current Issues

1. **Token Bottleneck**: At 3,500-4,000 max_tokens, Claude outputs ~1,000-1,500 words per phase, not the "2,000-3,000 words" requested in the system prompt
2. **No References Phase**: No phase generates citations, data sources, or bibliography
3. **Validation Threshold Mismatch**: validateQuality() expects 17,500+ words (line 105), but actual output is ~6,500-10,000 words
4. **Missing Markdown Enforcement**: System prompt mentions Markdown but some phases still generate HTML

---

## Proposed Changes

### 1. Increase Token Limits

**File:** `supabase/functions/generate-ma-guide/index.ts`
**Location:** Line 760

| Phase Type | Current | New | Expected Output |
|------------|---------|-----|-----------------|
| Standard | 3,500 | 6,000 | ~1,800-2,200 words |
| Critical (1e, 3b, 4a) | 4,000 | 8,000 | ~2,500-3,000 words |

```typescript
// Line 760: Change from
max_tokens: CRITICAL_PHASES.includes(phase.id) ? 4000 : 3500

// To
max_tokens: CRITICAL_PHASES.includes(phase.id) ? 8000 : 6000
```

### 2. Add References Phase (5a)

**Add to GENERATION_PHASES array (after 4b):**

```typescript
{ id: '5a', name: 'References & Sources', focus: 'Industry sources, data citations, research references' }
```

**Add to getPhasePrompts():**

```typescript
'5a': `## PHASE 5A: REFERENCES & SOURCES

Compile a comprehensive references section for this ${industryName} M&A guide. This provides credibility and allows readers to verify information.

### INDUSTRY DATA SOURCES
List specific sources for market data cited in this guide:
- Market research firms (IBISWorld, Statista, etc.)
- Industry associations and their publications
- Government sources (BLS, Census Bureau, SBA)
- Trade publications specific to ${industryName}

### TRANSACTION DATA REFERENCES
Sources for M&A activity and valuations:
- M&A databases (PitchBook, CapIQ, GF Data)
- Deal announcement sources
- Valuation multiple benchmarks
- Industry transaction reports

### REGULATORY & COMPLIANCE SOURCES
- Federal agency guidelines relevant to ${industryName}
- State licensing requirements
- Industry-specific compliance standards
- Environmental/safety regulations

### PROFESSIONAL RESOURCES
- Certification bodies and requirements
- Industry training programs
- Professional associations
- Key industry conferences

### RECOMMENDED READING
- Books on ${industryName} M&A
- Industry thought leaders
- Relevant white papers and case studies

Format as a structured bibliography with brief descriptions of each source's relevance.`
```

### 3. Update Critical Phases List

Add References phase to critical phases for higher token limit:

```typescript
// Line 648
const CRITICAL_PHASES = ['1e', '3b', '4a', '5a'];
```

### 4. Update Total Phases Count

Update any phase count references:
- GENERATION_PHASES will now have 14 items
- totalBatches calculation adjusts automatically

### 5. Adjust Validation Thresholds

**Update validateQuality() (Lines 88-134):**

```typescript
// Line 105: Change from
if (wordCount < 17500) missingElements.push('Word count below 17,500 target');

// To
if (wordCount < 7500) missingElements.push('Word count below 7,500 minimum');

// Line 114: Adjust scoring
score += Math.min(40, (wordCount / 15000) * 40); // Target 15k words for full score
```

### 6. Strengthen Markdown Enforcement

**Update system prompt (Lines 724-730):**

```typescript
const systemPrompt = `You are an expert M&A advisor creating comprehensive industry research guides.
Generate detailed, actionable content for the specified phase of an M&A guide.

FORMATTING REQUIREMENTS (CRITICAL):
- Use ONLY pure Markdown syntax
- Headings: ## H2, ### H3, #### H4
- Tables: | Column1 | Column2 | format with | separators
- Lists: - bullet items or 1. numbered items
- Bold: **text**, Italic: *text*
- NEVER use HTML tags (<h2>, <table>, <tr>, <td>, <dl>, <dt>, etc.)

Include specific numbers, ranges, and concrete examples wherever possible.
Target 2,000-3,000 words per phase.
Do NOT use placeholders like [X] or TBD - use realistic example values.${contextStr}`;
```

---

## Summary of Changes

| Item | Before | After |
|------|--------|-------|
| Phases | 13 | 14 (+ References) |
| Standard max_tokens | 3,500 | 6,000 |
| Critical max_tokens | 4,000 | 8,000 |
| Word count minimum | 17,500 | 7,500 |
| Word count target | 21,000 | 15,000 |
| References section | None | Full bibliography |
| Markdown enforcement | Weak | Explicit rules |

## Expected Outcome

After regeneration:
- **Word Count**: 12,000-20,000 words (14 phases × 1,500-2,000 avg words)
- **References**: Dedicated section with industry sources, transaction databases, regulatory citations
- **Formatting**: Clean Markdown without HTML contamination
- **Validation**: Accurate pass/fail based on realistic 7,500+ word minimum

## Files to Modify

1. `supabase/functions/generate-ma-guide/index.ts`
   - Add Phase 5a to GENERATION_PHASES array
   - Add Phase 5a prompt to getPhasePrompts()
   - Add '5a' to CRITICAL_PHASES
   - Increase max_tokens from 3500/4000 to 6000/8000
   - Update validateQuality() thresholds
   - Strengthen Markdown rules in system prompt

