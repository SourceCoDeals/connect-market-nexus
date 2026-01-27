
# Fix Plan: Buyer Enrichment Not Populating PE Firm and Description Fields

## Problem Summary

The buyer enrichment process is completing successfully (websites are scraped, `data_completeness` is set to `high`, `extraction_sources` is recorded) but **no actual data is being extracted** from the AI calls. The `fields_extracted` array is empty for all recent enrichments.

## Root Cause Analysis

After extensive investigation, I identified **three interconnected issues**:

### Issue 1: Silent AI Failures (Critical)
The `callAI()` function at lines 391-450 returns `{ data: null }` without adequate logging when:
- The AI response doesn't include a tool call
- JSON parsing fails
- The response format is unexpected

There's no visibility into what the AI is actually returning, making debugging impossible.

### Issue 2: Incorrect Data Completeness Calculation (High)
At lines 689-692:
```typescript
const filledFields = keyFields.filter(f => extractedData[f] || buyer[f]);
```

This counts **existing buyer data** (`buyer[f]`), not just the newly extracted data. So even when extraction fails completely, buyers are marked as `data_completeness: high` if they already had data from import.

### Issue 3: Evidence Recording Without Validation (Medium)
Evidence records are added even when no data is extracted:
```typescript
evidenceRecords.push({
  type: 'website',
  url: platformWebsite!,
  extracted_at: new Date().toISOString(),
  fields_extracted: Object.keys(extractedData)  // Empty if extraction failed
});
```

This makes the system appear to work when it's actually failing silently.

## Implementation Plan

### Step 1: Add Comprehensive Logging to AI Calls
**File**: `supabase/functions/enrich-buyer/index.ts`

Modify the `callAI()` function to:
1. Log the full AI response body for debugging
2. Log the model's actual response message content
3. Capture and log any JSON parsing errors with the raw string
4. Add more specific error codes for different failure modes

```typescript
async function callAI(...) {
  try {
    const response = await fetch(...);
    
    // Existing error handling...
    
    const responseText = await response.text();
    console.log(`AI Response status: ${response.status}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText.substring(0, 500));
      return { data: null };
    }
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      // Log what we actually received for debugging
      console.warn('No tool call in response. Message content:', 
        JSON.stringify(data.choices?.[0]?.message || 'no message'));
      return { data: null };
    }
    
    try {
      return { data: JSON.parse(toolCall.function.arguments) };
    } catch (argParseError) {
      console.error('Failed to parse tool arguments:', toolCall.function.arguments);
      return { data: null };
    }
  } catch (error) {
    console.error('AI extraction error:', error);
    return { data: null };
  }
}
```

### Step 2: Fix Data Completeness Calculation
**File**: `supabase/functions/enrich-buyer/index.ts`

Change the calculation to only count newly extracted fields:

```typescript
// Calculate data completeness based on EXTRACTED data, not existing buyer data
const keyFields = ['thesis_summary', 'target_services', 'target_geographies', 'geographic_footprint', 'hq_state', 'pe_firm_name', 'business_summary'];
const extractedFields = keyFields.filter(f => extractedData[f]);
const existingFields = keyFields.filter(f => buyer[f]);
const totalFilledFields = new Set([...extractedFields, ...existingFields.map(f => f)]).size;

// Only upgrade completeness if we actually extracted something
if (extractedFields.length >= 4) {
  updateData.data_completeness = 'high';
} else if (extractedFields.length >= 2 || totalFilledFields >= 4) {
  updateData.data_completeness = 'medium';
} else if (extractedFields.length === 0 && existingFields.length === 0) {
  updateData.data_completeness = 'low';
}
// If no extraction happened, don't change existing completeness
else if (extractedFields.length === 0) {
  // Don't set data_completeness - leave it as-is
  delete updateData.data_completeness;
}
```

### Step 3: Only Record Evidence When Data is Extracted
**File**: `supabase/functions/enrich-buyer/index.ts`

Only add evidence records when we actually extracted something:

```typescript
// Only add evidence if we extracted at least one field
const platformExtractedFields = Object.keys(extractedData);
if (platformExtractedFields.length > 0) {
  evidenceRecords.push({
    type: 'website',
    url: platformWebsite!,
    extracted_at: new Date().toISOString(),
    fields_extracted: platformExtractedFields
  });
}
```

### Step 4: Add Retry Logic with Exponential Backoff
**File**: `supabase/functions/enrich-buyer/index.ts`

Sometimes AI calls fail transiently. Add retry logic:

```typescript
async function callAIWithRetry(
  systemPrompt: string, 
  userPrompt: string, 
  tool: any, 
  apiKey: string,
  maxRetries = 2
): Promise<{ data: any | null; error?: { code: string; message: string } }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await callAI(systemPrompt, userPrompt, tool, apiKey);
    
    if (result.data !== null || result.error) {
      return result;  // Success or billing error - don't retry
    }
    
    if (attempt < maxRetries) {
      console.log(`Attempt ${attempt} failed, retrying in ${attempt * 1000}ms...`);
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
  
  return { data: null };
}
```

### Step 5: Improve Error Surfacing to Frontend
**File**: `supabase/functions/enrich-buyer/index.ts`

Return more detailed information about extraction failures:

```typescript
return new Response(
  JSON.stringify({
    success: true,
    data: {
      buyerId,
      fieldsUpdated,
      fieldsExtracted: Object.keys(extractedData),
      dataCompleteness: updateData.data_completeness || buyer.data_completeness || 'low',
      extractedData,
      scraped: {
        platform: !!platformContent,
        peFirm: !!peFirmContent
      },
      extractionDetails: {
        platformScraped: !!platformContent,
        platformContentLength: platformContent?.length || 0,
        peFirmScraped: !!peFirmContent,
        peFirmContentLength: peFirmContent?.length || 0,
        promptsRun: 6,
        promptsSuccessful: Object.keys(extractedData).length > 0 ? 'at least 1' : 0
      }
    },
    warning: warnings.length > 0 ? warnings.join('; ') : undefined
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

### Step 6: Update Frontend to Display Extraction Warnings
**File**: `src/hooks/useBuyerEnrichment.ts`

Show more specific feedback when enrichment succeeds but extracts no data:

```typescript
if (result.status === 'fulfilled') {
  const enrichResult = result.value;
  
  // Check if enrichment succeeded but extracted no data
  if (enrichResult.data?.fieldsExtracted?.length === 0) {
    warnings++;
    updateStatus(buyer.id, { 
      buyerId: buyer.id, 
      status: 'success',
      error: 'No data extracted from website'
    });
  } else {
    successful++;
    updateStatus(buyer.id, { buyerId: buyer.id, status: 'success' });
  }
}
```

## Testing Plan

After implementing these fixes:

1. **Deploy the updated edge function**
2. **Run enrichment on a single buyer** and check logs for detailed output
3. **Verify AI is returning tool calls** - if not, the logs will show what's being returned
4. **Confirm fields are populated** in the database after successful extraction
5. **Check UI shows correct status** - "Enriched" with data vs "Enriched" without data

## Technical Details

### Files to Modify
| File | Changes |
|------|---------|
| `supabase/functions/enrich-buyer/index.ts` | Add logging, fix data completeness, add retry logic |
| `src/hooks/useBuyerEnrichment.ts` | Add warning detection for empty extractions |

### Database Impact
- No schema changes required
- Existing `data_completeness: high` records with no data will remain until re-enriched

### Edge Cases to Handle
- Websites that block scrapers (Firecrawl returns minimal content)
- AI model returning text instead of tool calls
- Rate limiting mid-batch (already handled with fail-fast)
- Empty PE firm websites (no thesis available)

## Rollback Plan

If issues persist after deployment:
1. Check edge function logs for the specific error
2. Temporarily revert to previous version
3. Test AI gateway directly using curl to isolate the issue
