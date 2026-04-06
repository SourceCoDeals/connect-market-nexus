

# Audit: Plan Implementation Status + Bank-Grade Data Room Enhancements

## Implementation Status

| Plan Item | Status | Notes |
|-----------|--------|-------|
| Issue 1: `handleAccept` queries DB directly | DONE | Lines 149-163 use `resolve_user_firm_id` RPC + fresh `firm_agreements` query |
| Issue 2: `AccessMatrixSection` uses fresh firm data | DONE | `hasFeeAgreement` (line 78) derives from `useConnectionRequestFirm` which queries `firm_agreements` and checks both boolean + status columns |
| Issue 3: Premium Data Room redesign | PARTIALLY DONE | Purple gradients removed, clean rows implemented, but it's "clean minimal" not "bank-grade vault" |
| Migration: fix existing access record | DONE | Migration applied |
| `DataRoomOrientation` removed from BuyerDataRoom | DONE | Component still exists but is no longer imported |

## What's Missing: Bank-Grade Vault Experience

The current redesign is clean and minimal but reads like a generic file list. For PE/M&A buyers who handle $5M-$50M deals, the data room needs to communicate **security, exclusivity, and institutional trust**. Think: what a Goldman Sachs or J.P. Morgan virtual data room feels like.

### Design Enhancements

**1. Vault Header with Security Signal**
Replace the plain "Data Room" label with a contained header block:
- Dark background (`#0E101A`) with subtle border
- Shield icon (not just Lock) with "Secure Data Room" title
- Subtle "End-to-end encrypted" or "256-bit encrypted" badge in muted text
- Session indicator: "Access granted [date]" in small muted text

**2. Document Rows: Elevated Treatment**
- Each document row gets a subtle left border accent on hover (emerald for accessible, muted for restricted)
- File type icons with monochrome treatment (no colored icons; use opacity for hierarchy)
- "View" and "Download" buttons become subtle outlined pill buttons with icons, not bare ghost buttons
- Add a micro-animation on hover (slight translate-x on the row)

**3. Access Level Indicator**
- At the top, show the buyer's current access tier: "Full Access" (emerald dot) or "Teaser Access" (amber dot)
- If they have Teaser but not Full Memo/Data Room, show a subtle upgrade prompt: "Sign Fee Agreement to unlock all documents"

**4. Security Footer**
- After the document list, a hairline divider followed by small muted text: "Documents are shared under NDA. Unauthorized distribution is prohibited."
- This reinforces the gravity of the materials

**5. Empty State**
- Instead of plain text, show a shield icon with "Your data room is being prepared" and a subtle progress indicator

### Functionality Enhancements

**6. Document Preview Inline**
- For PDFs, show a small thumbnail/preview icon so buyers can identify documents visually before clicking

**7. Last Accessed Timestamp**
- Show "Last viewed: 2 hours ago" on documents the buyer has previously opened (requires tracking, deferred)

## Files to Change

| File | Change |
|------|--------|
| `src/components/marketplace/BuyerDataRoom.tsx` | Vault header, security badge, access tier indicator, elevated document rows, security footer, improved empty state |

Single file change. No database or backend changes needed.

## Design Tokens

- Header background: `#0E101A` (dark vault header)
- Security text: `text-muted-foreground/50` at `text-[10px]`
- Shield icon: `lucide-react` `ShieldCheck`
- Access tier dot: emerald for full, amber for partial
- Document row hover: `hover:bg-muted/20` with `transition-all duration-150`
- Action buttons: `border border-border/40 rounded-full px-3 h-7` ghost pills
- Footer divider: `border-border/20`

