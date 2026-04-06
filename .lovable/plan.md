

# Fix: User Deletion Fails Due to Missing FK Cleanup

## Root Cause

The `delete_user_completely` RPC only handles ~12 tables, but **40+ foreign keys** reference `auth.users(id)` without CASCADE or SET NULL. The specific error is `data_room_access_marketplace_user_id_fkey` (ON DELETE RESTRICT), but many others would fail too.

## Strategy

Two-pronged approach via a single migration:

**1. Alter FK constraints** — For admin/audit reference columns (approved_by, granted_by, created_by, etc.), change to `ON DELETE SET NULL`. These are historical records that should survive user deletion but lose the reference. This covers ~35 constraints.

**2. Update the RPC** — For user-owned data tables (data_room_access where marketplace_user_id = target, data_room_audit_log, deal_pipeline where buyer_contact_id links to the user, connection_messages, user_roles, permission_audit_log, etc.), add explicit DELETE statements before the profile/auth delete. This ensures the user's own records are fully purged.

## Tables Requiring DELETE in RPC (user-owned data)

| Table | Column | Reason |
|-------|--------|--------|
| `data_room_access` | `marketplace_user_id` | User's access records — delete |
| `data_room_audit_log` | `user_id` | User's audit trail — delete |
| `connection_messages` | (via connection_requests) | Messages on user's connections — delete |
| `user_roles` | `user_id` | Role assignments — delete |
| `permission_audit_log` | `user_id` | Permission history — delete |
| `ai_command_center_usage` | `user_id` | Usage logs — delete |
| `document_requests` | `user_id` | User's doc requests — delete |
| `contacts` | `marketplace_user_id` | Contact records — archive/delete |
| `deal_pipeline` | `buyer_contact_id` | Pipeline entries — delete |
| `firm_agreements` | (via firm_members) | User's firm membership — delete |
| `firm_members` | `user_id` | Firm membership — delete |

## FK Constraints to Alter to SET NULL (admin references)

All `*_by` columns on connection_requests, data_room_access, firm_agreements, deal_pipeline, document_requests, buyer_introductions, buyer_learning_history, enrichment_jobs, deal_scoring_adjustments, deal_transcripts, deal_outreach_profiles, data_room_documents, buyer_universes, buyer_search_jobs, buyer_transcripts, buyers, contact_lists, contact_discovery_log, etc.

## Files Changed

| File | Change |
|------|--------|
| New migration SQL | 1) ALTER ~35 FK constraints to ON DELETE SET NULL. 2) DROP and recreate `delete_user_completely` with comprehensive table coverage |

No frontend changes needed — the RPC name and interface stay the same.

