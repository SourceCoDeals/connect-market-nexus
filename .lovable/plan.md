

# Phase 80-85: Document Signing System — End-to-End Audit & Fixes

## Root Cause: PandaDoc Secrets Missing

The entire document signing pipeline is broken because **none of the required PandaDoc secrets are configured** in the Supabase Edge Function secrets:

| Required Secret | Status |
|----------------|--------|
| `PANDADOC_API_KEY` | **MISSING** |
| `PANDADOC_NDA_TEMPLATE_UUID` | **MISSING** |
| `PANDADOC_FEE_TEMPLATE_UUID` | **MISSING** |
| `PANDADOC_WEBHOOK_KEY` | **MISSING** |

Edge function logs for `get-buyer-nda-embed` and `confirm-agreement-signed` are completely empty — no calls have succeeded. Every signing attempt returns a 500 error ("PandaDoc not configured").

Legacy `DOCUSEAL_*` secrets still exist but the codebase has fully migrated to PandaDoc.

## Architecture (Verified Working Code)

```text
BUYER SIGNING FLOW:
  ListingDetail → NdaGateModal → get-buyer-nda-embed (edge fn)
                                   ├─ resolves firm via resolve_user_firm_id RPC
                                   ├─ self-heals missing firm records
                                   ├─ creates PandaDoc document from template
                                   ├─ creates embedded signing session
                                   └─ returns embedUrl → PandaDocSigningPanel (iframe)

  ProfileDocuments / DealActionCard / AgreementSection
    → AgreementSigningModal → get-buyer-nda-embed / get-buyer-fee-embed
    → PandaDocSigningPanel (iframe)
    → on signed → confirm-agreement-signed (edge fn)
                    ├─ polls PandaDoc API for completion status
                    ├─ updates firm_agreements
                    ├─ sends buyer/admin confirmation emails
                    └─ creates notifications

ADMIN FLOW:
  Connection Request Actions → SendAgreementDialog → create-pandadoc-document (edge fn)
                                                       ├─ creates document from template
                                                       ├─ sends via email or embedded
                                                       ├─ creates buyer notification
                                                       └─ inserts system message

WEBHOOK BACKUP:
  PandaDoc → pandadoc-webhook-handler (edge fn)
              ├─ HMAC-SHA256 signature verification
              ├─ idempotency via pandadoc_webhook_log
              ├─ updates firm_agreements
              └─ admin notifications
```

## Findings Beyond Missing Secrets

### Phase 80: Add PandaDoc secrets (CRITICAL — BLOCKER)
User must add 4 secrets via Supabase dashboard:
- `PANDADOC_API_KEY` — API key from PandaDoc settings
- `PANDADOC_NDA_TEMPLATE_UUID` — template ID for NDA
- `PANDADOC_FEE_TEMPLATE_UUID` — template ID for Fee Agreement
- `PANDADOC_WEBHOOK_KEY` — webhook shared key for HMAC verification

Without these, nothing works. This is a user action — cannot be automated.

### Phase 81: Clean up legacy DocuSeal secrets (LOW)
Remove stale secrets: `DOCUSEAL_API_KEY`, `DOCUSEAL_FEE_TEMPLATE_ID`, `DOCUSEAL_NDA_TEMPLATE_ID`, `DOCUSEAL_WEBHOOK_SECRET`. These reference the old signing provider and create confusion.

### Phase 82: ProfileDocuments uses `as never` type casting for firm_agreements query (MEDIUM)
Line 53 in `ProfileDocuments.tsx`:
```typescript
supabase.from('firm_agreements' as never) as unknown as ReturnType<typeof supabase.from>
```
This suggests `firm_agreements` may be missing from the generated Supabase types. The query selects columns like `nda_pandadoc_signed_url` which may not exist in the schema. If columns are missing, the query silently returns null for those fields but doesn't error. Should verify all referenced columns exist.

### Phase 83: NdaGateModal `onSigned` callback is a no-op (MEDIUM)
In `ListingDetail.tsx` line 165:
```typescript
onSigned={() => {/* NDA signed — component will re-render with updated ndaStatus */}}
```
The comment assumes `ndaStatus` will automatically re-render, but `useBuyerNdaStatus` has `staleTime: 30_000` (30 seconds). After signing, the user would stare at the gate modal for up to 30 seconds before seeing the deal. The `onSigned` callback should call `queryClient.invalidateQueries({ queryKey: ['buyer-nda-status'] })`.

### Phase 84: AgreementSigningModal error UX on missing PandaDoc config (LOW)
When PandaDoc returns 500 ("PandaDoc not configured"), the modal shows a generic "Failed to load signing form" error. The edge function already returns this specific error message — the modal should surface it more clearly and direct the user to contact support with more context.

### Phase 85: Edge functions need redeployment after any code changes (LOW)
Several edge functions in the signing pipeline may have stale deployments. After secrets are added, all signing-related edge functions should be redeployed:
- `get-buyer-nda-embed`
- `get-buyer-fee-embed`
- `confirm-agreement-signed`
- `create-pandadoc-document`
- `get-agreement-document`
- `get-document-download`
- `pandadoc-webhook-handler`

## Implementation Plan

| Phase | Fix | Priority | Type |
|-------|-----|----------|------|
| 80 | Guide user to add PandaDoc secrets | Critical | User action |
| 81 | Remove legacy DocuSeal secrets | Low | User action |
| 82 | Verify firm_agreements schema columns | Medium | Code audit |
| 83 | Fix NdaGateModal onSigned to invalidate queries | Medium | Code fix |
| 84 | Improve error messages for missing config | Low | Code fix |
| 85 | Redeploy all signing edge functions | Low | Deployment |

## Execution

**Phase 80 requires user action first** — without PandaDoc secrets, nothing else matters. I will prompt you to add the secrets.

**Phases 83-84** are code fixes that can be implemented immediately regardless of secrets. Phase 83 is the most impactful — it fixes a 30-second stale gate after signing.

