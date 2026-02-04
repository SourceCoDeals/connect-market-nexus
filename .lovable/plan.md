

## Plan: Add "Extract Buyer Fit Criteria" Button

### Overview
Add a prominent button to extract structured buyer fit criteria from the completed M&A Research Guide using the `extract-buyer-criteria` edge function. This will allow users to convert the 30,000+ word guide into actionable, structured criteria (Size, Geography, Service, and Buyer Types) with a single click.

### Current State Analysis
- **M&A Guide Generation**: The `AIResearchSection` component generates comprehensive industry research guides
- **Criteria Extraction**: The `extract-buyer-criteria` edge function exists and uses Claude 3.5 Sonnet to transform guides into structured JSON criteria with confidence scores
- **Existing CriteriaExtractionPanel**: A full panel exists for extraction from multiple sources (guide, documents, transcripts), but it's hidden in a collapsible section lower on the page

### Implementation Approach

#### Option A: Add Button to AIResearchSection Header (Recommended)
Add an "Extract Criteria" button directly in the AIResearchSection card header, visible when a guide exists. This places the action right next to the guide content.

**Placement**: Next to the existing "View Guide" / "Run AI Research" button in the header

**Button States**:
- Hidden when no guide exists
- "Extract Criteria" with Sparkles icon when guide is available
- "Extracting..." with loading spinner during extraction
- Success toast with confidence score on completion

#### Files to Modify

**1. `src/components/remarketing/AIResearchSection.tsx`**
- Add state for extraction: `isExtracting`, `extractionComplete`
- Add `handleExtractCriteria` function that:
  - Validates guide content exists (minimum 1000 characters)
  - Calls the `extract-buyer-criteria` edge function
  - Updates the parent component with extracted criteria via `onGuideGenerated` callback
  - Shows success/error toasts with confidence scores
- Add new button in the header section (lines 911-937) next to existing buttons
- Pass `universeId` and `universeName` (already available as props)

**2. Props Update** (if needed)
The component already has the required props:
- `universeId` - for the extraction request
- `universeName` - for source naming
- `existingContent` - the guide content to extract from
- `onGuideGenerated` - callback to pass extracted criteria

### Button Design

```text
Header layout (when guide exists and collapsed):
┌─────────────────────────────────────────────────────────────┐
│ 📖 M&A Research Guide                                       │
│ "32,000 word industry research guide"                       │
│                                                             │
│                    [Extract Criteria] [View Guide] [▼]      │
└─────────────────────────────────────────────────────────────┘
```

### Extraction Flow

1. User clicks "Extract Criteria" button
2. Button shows loading state: "Extracting..."
3. Edge function processes guide content (~30 seconds)
4. On success:
   - Toast: "Criteria extracted successfully (85% confidence)"
   - Criteria applied to universe via existing callback
   - Button changes to "Re-extract" or shows checkmark badge
5. On error:
   - Toast with error message
   - Button returns to default state

### Technical Details

**Edge Function Call**:
```typescript
const { data, error } = await supabase.functions.invoke('extract-buyer-criteria', {
  body: {
    universe_id: universeId,
    guide_content: existingContent || content,
    source_name: `${universeName} M&A Guide`,
    industry_name: universeName
  }
});
```

**Response Handling**:
- The function returns structured criteria with confidence scores (0-100)
- Map extracted data to the component's `ExtractedCriteria` interface
- Call `onGuideGenerated(content, mappedCriteria, buyerTypes)` to update parent state

### Edge Cases
- **No Guide Content**: Button hidden or disabled with tooltip
- **Guide Too Short**: Show toast "Guide must have at least 1000 characters"
- **Extraction Fails**: Show error toast with retry option
- **Rate Limited (429)**: Show toast with wait message
- **Credits Depleted (402)**: Show toast directing to Settings

### Estimated Changes
- ~60 lines added to `AIResearchSection.tsx`
- No new files required
- No edge function changes (already deployed and working)

