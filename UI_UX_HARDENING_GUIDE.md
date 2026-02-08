# UI/UX Hardening Guide

**Purpose:** Frontend integration guide for audit fixes and data integrity features.

**Date:** 2026-02-08

**Status:** Implementation Required

---

## Overview

The backend audit fixes have added several data integrity features that require frontend integration:

1. **Optimistic Locking** - Prevent concurrent edit conflicts
2. **NULL Score Handling** - Display missing data appropriately
3. **Data Quality Warnings** - Show contamination flags
4. **Query Invalidation** - Ensure fresh data after updates
5. **Provenance Indicators** - Show data source confidence

---

## 1. Optimistic Locking (Concurrent Edit Detection)

### Backend Change
- Added `version` column to `remarketing_buyers` (auto-increments on UPDATE)
- Trigger: `buyer_version_trigger` automatically bumps version

### Frontend Implementation

#### Reading Buyer Data
```typescript
// Fetch buyer with version
const { data: buyer } = await supabase
  .from('remarketing_buyers')
  .select('id, company_name, target_revenue_min, version, ...')
  .eq('id', buyerId)
  .single();

// Store version in component state
const [currentVersion, setCurrentVersion] = useState(buyer.version);
```

#### Updating Buyer Data
```typescript
// Include version in UPDATE and check for conflicts
const { error } = await supabase
  .from('remarketing_buyers')
  .update({
    target_revenue_min: newValue,
    // Do NOT manually increment version - trigger handles it
  })
  .eq('id', buyerId)
  .eq('version', currentVersion); // ✅ Optimistic lock

if (error) {
  if (error.code === 'PGRST116') {
    // Version mismatch = concurrent edit detected
    toast.error('This buyer was modified by another process. Refreshing...');
    // Reload fresh data
    refetch();
  } else {
    toast.error(`Update failed: ${error.message}`);
  }
} else {
  // Success - increment local version
  setCurrentVersion(currentVersion + 1);
  toast.success('Buyer updated successfully');
}
```

#### React Hook (Reusable)
```typescript
function useOptimisticBuyerUpdate(buyerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ updates, version }: { updates: Partial<Buyer>, version: number }) => {
      const { data, error } = await supabase
        .from('remarketing_buyers')
        .update(updates)
        .eq('id', buyerId)
        .eq('version', version)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onError: (error: any) => {
      if (error.code === 'PGRST116') {
        toast.error('Concurrent edit detected. Please refresh and try again.');
        queryClient.invalidateQueries(['buyer', buyerId]);
      } else {
        toast.error(`Update failed: ${error.message}`);
      }
    },
    onSuccess: () => {
      toast.success('Buyer updated successfully');
      queryClient.invalidateQueries(['buyer', buyerId]);
    },
  });
}

// Usage:
const updateBuyer = useOptimisticBuyerUpdate(buyerId);
updateBuyer.mutate({ updates: { target_revenue_min: 5000000 }, version: buyer.version });
```

---

## 2. NULL Score Handling

### Backend Change
- Scoring function now returns `NULL` for insufficient data (not 50/55/60)
- Returns `missing_fields` array and `data_quality_diagnostic` object

### Frontend Implementation

#### Fetching Scores
```typescript
interface BuyerScore {
  composite_score: number | null; // ⚠️ Can be NULL
  geography_score: number | null;
  size_score: number | null;
  service_score: number | null;
  owner_goals_score: number | null;
  tier: 'A' | 'B' | 'C' | 'D' | 'unknown';
  missing_fields?: string[];
  _data_quality_diagnostic?: {
    scored_dimensions: number;
    missing_dimensions: string[];
    scored_dimension_names: string[];
  };
}
```

#### Score Display Component
```tsx
function ScoreCard({ score }: { score: BuyerScore }) {
  if (score.composite_score === null) {
    return (
      <div className="score-card score-insufficient-data">
        <div className="score-icon">⚠️</div>
        <div className="score-value">Insufficient Data</div>
        <div className="score-explanation">
          Missing: {score.missing_fields?.join(', ') || 'multiple dimensions'}
        </div>
        <button onClick={() => showDataCompletionModal()}>
          Add Missing Data
        </button>
      </div>
    );
  }

  return (
    <div className={`score-card score-tier-${score.tier}`}>
      <div className="score-value">{score.composite_score}</div>
      <div className="score-tier">Tier {score.tier}</div>
      <div className="score-breakdown">
        {score.size_score !== null && <span>Size: {score.size_score}</span>}
        {score.service_score !== null && <span>Service: {score.service_score}</span>}
        {score.geography_score !== null && <span>Geo: {score.geography_score}</span>}
        {score.owner_goals_score !== null && <span>Goals: {score.owner_goals_score}</span>}
      </div>
    </div>
  );
}
```

#### Dimension Score Display
```tsx
function DimensionScore({ score, dimension }: { score: number | null, dimension: string }) {
  if (score === null) {
    return (
      <div className="dimension-score dimension-missing">
        <span className="dimension-name">{dimension}</span>
        <span className="dimension-value">—</span>
        <span className="dimension-label">Missing Data</span>
      </div>
    );
  }

  const tier = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';

  return (
    <div className={`dimension-score dimension-${tier}`}>
      <span className="dimension-name">{dimension}</span>
      <span className="dimension-value">{score}</span>
      <span className="dimension-label">{tier}</span>
    </div>
  );
}
```

#### Data Completion Prompt
```tsx
function DataCompletionPrompt({ buyer, score }: { buyer: Buyer, score: BuyerScore }) {
  const missingDimensions = score._data_quality_diagnostic?.missing_dimensions || [];

  if (missingDimensions.length === 0) return null;

  const getMissingFieldsForDimension = (dimension: string) => {
    switch (dimension) {
      case 'size':
        return ['target_revenue_min', 'target_ebitda_min'];
      case 'service':
        return ['target_services', 'thesis_summary'];
      case 'geography':
        return ['target_geographies', 'geographic_footprint'];
      case 'owner_goals':
        return ['deal_preferences', 'strategic_priorities'];
      default:
        return [];
    }
  };

  return (
    <div className="data-completion-prompt">
      <h4>⚠️ Cannot Score This Buyer</h4>
      <p>This buyer is missing data for {missingDimensions.length} dimension(s):</p>
      <ul>
        {missingDimensions.map(dim => (
          <li key={dim}>
            <strong>{dim}</strong>: Add {getMissingFieldsForDimension(dim).join(' or ')}
          </li>
        ))}
      </ul>
      <button onClick={() => navigateToEditForm(buyer.id)}>
        Add Missing Data
      </button>
    </div>
  );
}
```

---

## 3. Data Quality Warnings

### Backend Change
- Added `data_quality_flags` JSONB column
- Historical contamination detection sets `contamination_detected: true`

### Frontend Implementation

#### Buyer Detail Page - Show Warnings
```tsx
function BuyerQualityWarnings({ buyer }: { buyer: Buyer }) {
  const flags = buyer.data_quality_flags;

  if (!flags?.contamination_detected) return null;

  const riskColor = {
    high: 'red',
    medium: 'orange',
    low: 'yellow',
  }[flags.risk_level || 'low'];

  return (
    <div className={`quality-warning quality-warning-${riskColor}`}>
      <div className="warning-icon">⚠️</div>
      <div className="warning-content">
        <h4>Data Quality Issue Detected</h4>
        <p><strong>Risk Level:</strong> {flags.risk_level?.toUpperCase()}</p>
        <p><strong>Issue:</strong> {flags.reason}</p>
        <p><strong>Affected Fields:</strong> {flags.suspicious_fields?.join(', ')}</p>
        <p><strong>Action Required:</strong> {flags.suggestion}</p>
        <div className="warning-actions">
          <button onClick={() => showContaminationReviewModal(buyer)}>
            Review & Fix
          </button>
          <button onClick={() => dismissWarning(buyer.id)}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### Buyer List - Show Warning Badge
```tsx
function BuyerListItem({ buyer }: { buyer: Buyer }) {
  const hasWarning = buyer.data_quality_flags?.contamination_detected;

  return (
    <div className="buyer-list-item">
      <div className="buyer-name">
        {buyer.company_name}
        {hasWarning && (
          <span className="warning-badge" title="Data quality issue">
            ⚠️
          </span>
        )}
      </div>
      {/* ... rest of item */}
    </div>
  );
}
```

#### Contamination Review Modal
```tsx
function ContaminationReviewModal({ buyer, onClose }: { buyer: Buyer, onClose: () => void }) {
  const flags = buyer.data_quality_flags;
  const suspiciousFields = flags?.suspicious_fields || [];

  return (
    <Modal onClose={onClose}>
      <h3>Data Quality Review: {buyer.company_name}</h3>

      <section>
        <h4>Issue Summary</h4>
        <p>{flags?.reason}</p>
      </section>

      <section>
        <h4>Suspicious Fields</h4>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Current Value</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {suspiciousFields.map((field: string) => (
              <tr key={field}>
                <td>{field}</td>
                <td>{buyer[field as keyof Buyer] as string}</td>
                <td>
                  <button onClick={() => clearField(buyer.id, field)}>
                    Clear
                  </button>
                  <button onClick={() => editField(buyer.id, field)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h4>Recommended Action</h4>
        <p>{flags?.suggestion}</p>
      </section>

      <div className="modal-actions">
        <button onClick={() => markAsReviewed(buyer.id)}>
          Mark as Reviewed
        </button>
        <button onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
```

---

## 4. Query Invalidation Strategy

### Problem
After enrichment operations (notes analysis, transcript extraction), the UI may show stale data.

### Solution: Invalidate Queries After Updates

#### React Query Example
```typescript
// In your mutation hooks:
const analyzeNotes = useMutation({
  mutationFn: async ({ buyerId, notes }: { buyerId: string, notes: string }) => {
    const response = await fetch('/api/analyze-buyer-notes', {
      method: 'POST',
      body: JSON.stringify({ buyer_id: buyerId, notes }),
    });
    return response.json();
  },
  onSuccess: (data, variables) => {
    // ✅ Invalidate buyer queries to force refetch
    queryClient.invalidateQueries(['buyer', variables.buyerId]);
    queryClient.invalidateQueries(['buyers']); // If list view affected

    // Show success
    toast.success('Notes analyzed and buyer updated');
  },
});

// Usage:
analyzeNotes.mutate({ buyerId: '123', notes: 'Looking for $5-10M revenue...' });
```

#### SWR Example
```typescript
import useSWR, { mutate } from 'swr';

async function analyzeNotes(buyerId: string, notes: string) {
  const response = await fetch('/api/analyze-buyer-notes', {
    method: 'POST',
    body: JSON.stringify({ buyer_id: buyerId, notes }),
  });

  if (!response.ok) throw new Error('Analysis failed');

  // ✅ Invalidate cache to force refetch
  mutate(`/api/buyers/${buyerId}`);
  mutate('/api/buyers'); // If list affected

  return response.json();
}
```

#### Polling for Background Operations
```typescript
// For long-running operations (transcript extraction), poll for completion:
function useTranscriptStatus(transcriptId: string) {
  return useQuery(
    ['transcript-status', transcriptId],
    async () => {
      const { data } = await supabase
        .from('buyer_transcripts')
        .select('processing_status, buyer_id')
        .eq('id', transcriptId)
        .single();
      return data;
    },
    {
      refetchInterval: (data) => {
        // Poll every 3 seconds until completed
        if (data?.processing_status === 'completed') {
          return false; // Stop polling
        }
        return 3000;
      },
      onSuccess: (data) => {
        if (data?.processing_status === 'completed') {
          // Invalidate buyer query when extraction completes
          queryClient.invalidateQueries(['buyer', data.buyer_id]);
          toast.success('Transcript extraction completed');
        }
      },
    }
  );
}
```

---

## 5. Provenance Indicators

### Backend Change
- All enrichment operations add to `extraction_sources` array
- Each source has: `{ type, extracted_at, fields_extracted, confidence }`

### Frontend Implementation

#### Show Data Source Confidence
```tsx
function DataSourceBadge({ buyer, field }: { buyer: Buyer, field: string }) {
  const sources = buyer.extraction_sources || [];

  // Find most recent source that extracted this field
  const fieldSource = sources
    .filter((src: any) => src.fields_extracted?.includes(field))
    .sort((a: any, b: any) => new Date(b.extracted_at).getTime() - new Date(a.extracted_at).getTime())[0];

  if (!fieldSource) {
    return <span className="source-badge source-manual">Manual Entry</span>;
  }

  const sourceLabels = {
    transcript: { label: 'Transcript', color: 'green', icon: '🎙️' },
    buyer_transcript: { label: 'Buyer Call', color: 'green', icon: '📞' },
    platform_website: { label: 'Platform Website', color: 'blue', icon: '🌐' },
    pe_firm_website: { label: 'PE Firm Website', color: 'purple', icon: '🏢' },
    notes: { label: 'Notes Analysis', color: 'orange', icon: '📝' },
    csv: { label: 'CSV Import', color: 'gray', icon: '📄' },
  };

  const sourceConfig = sourceLabels[fieldSource.type as keyof typeof sourceLabels] || { label: 'Unknown', color: 'gray', icon: '❓' };

  return (
    <span className={`source-badge source-${sourceConfig.color}`} title={`Extracted: ${new Date(fieldSource.extracted_at).toLocaleDateString()}`}>
      {sourceConfig.icon} {sourceConfig.label}
      {fieldSource.confidence && ` (${Math.round(fieldSource.confidence * 100)}%)`}
    </span>
  );
}

// Usage in form:
<div className="form-field">
  <label>Target Revenue Min</label>
  <input
    type="number"
    value={buyer.target_revenue_min || ''}
    onChange={(e) => updateField('target_revenue_min', e.target.value)}
  />
  <DataSourceBadge buyer={buyer} field="target_revenue_min" />
</div>
```

#### Transcript-Protected Field Indicator
```tsx
function FieldEditWarning({ buyer, field }: { buyer: Buyer, field: string }) {
  // Check if field is protected by transcript
  const TRANSCRIPT_PROTECTED = [
    'thesis_summary', 'target_revenue_min', 'target_revenue_max',
    'target_ebitda_min', 'target_ebitda_max', 'strategic_priorities',
    'deal_breakers', 'target_geographies', 'target_services',
  ];

  if (!TRANSCRIPT_PROTECTED.includes(field)) return null;

  const hasTranscriptSource = buyer.extraction_sources?.some(
    (src: any) => src.type === 'transcript' || src.type === 'buyer_transcript'
  );

  if (!hasTranscriptSource) return null;

  return (
    <div className="field-warning field-protected">
      <span className="warning-icon">🔒</span>
      <span className="warning-text">
        This field is protected by transcript data. Manual edits may be overridden by future transcript updates.
      </span>
    </div>
  );
}
```

---

## 6. Error Handling

### Enrichment API Errors
```typescript
try {
  const response = await fetch('/api/analyze-buyer-notes', {
    method: 'POST',
    body: JSON.stringify({ buyer_id: buyerId, notes }),
  });

  const data = await response.json();

  if (response.status === 429) {
    // Lock conflict - enrichment in progress
    toast.warning('Buyer is being enriched by another process. Please try again in 1 minute.');
    return;
  }

  if (response.status === 409) {
    // Concurrent edit detected
    toast.error('Another user just updated this buyer. Refreshing...');
    refetch();
    return;
  }

  if (!response.ok) {
    toast.error(`Enrichment failed: ${data.error || 'Unknown error'}`);
    return;
  }

  toast.success('Buyer enriched successfully');
} catch (error) {
  toast.error('Network error. Please try again.');
}
```

---

## 7. Testing Checklist

### Optimistic Locking
- [ ] Update buyer in two tabs simultaneously - second tab should see conflict
- [ ] Update buyer while enrichment running - should get 429 error
- [ ] Verify version increments after each successful update

### NULL Scores
- [ ] Buyer with only 1 dimension → Shows "Insufficient Data"
- [ ] Buyer with 2 dimensions → Shows "Insufficient Data"
- [ ] Buyer with 3 dimensions → Shows composite score
- [ ] Deal with no revenue/EBITDA → Size dimension shows NULL
- [ ] Missing data prompt guides user to correct fields

### Data Quality Warnings
- [ ] Contaminated buyer shows warning badge in list
- [ ] Warning banner appears in buyer detail page
- [ ] Review modal shows suspicious fields
- [ ] Clear field action removes contamination flag

### Query Invalidation
- [ ] After notes analysis, buyer detail page updates
- [ ] After transcript extraction, buyer list updates
- [ ] Background operations show loading state
- [ ] Completed operations show success toast

---

## 8. CSS Styling Examples

```css
/* Score Card - Insufficient Data */
.score-card.score-insufficient-data {
  background: #fff3cd;
  border: 2px solid #ffc107;
  padding: 20px;
  border-radius: 8px;
}

.score-card.score-insufficient-data .score-icon {
  font-size: 48px;
  text-align: center;
}

.score-card.score-insufficient-data .score-value {
  font-size: 18px;
  font-weight: bold;
  color: #856404;
  text-align: center;
}

/* Data Quality Warning */
.quality-warning {
  border-left: 4px solid #ffc107;
  background: #fff3cd;
  padding: 16px;
  margin-bottom: 20px;
  border-radius: 4px;
}

.quality-warning-red {
  border-left-color: #dc3545;
  background: #f8d7da;
}

.quality-warning-orange {
  border-left-color: #fd7e14;
  background: #ffe5d0;
}

/* Source Badge */
.source-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  margin-left: 8px;
}

.source-badge.source-green {
  background: #d4edda;
  color: #155724;
}

.source-badge.source-blue {
  background: #d1ecf1;
  color: #0c5460;
}

.source-badge.source-purple {
  background: #e2d9f3;
  color: #563d7c;
}

/* Field Protected Warning */
.field-protected {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #e7f3ff;
  border: 1px solid #b3d7ff;
  border-radius: 4px;
  font-size: 13px;
  color: #004085;
  margin-top: 4px;
}
```

---

## Next Steps

1. **Frontend Team**: Implement optimistic locking in all buyer edit forms
2. **Frontend Team**: Update score display components to handle NULL scores
3. **Frontend Team**: Add data quality warning UI to buyer detail pages
4. **Frontend Team**: Implement query invalidation after all mutations
5. **Design Team**: Review and refine warning/badge designs
6. **QA Team**: Test all scenarios in testing checklist
