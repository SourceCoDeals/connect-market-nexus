

# Move Analyst Notes Outside Preview Modal into Collapsible Dropdown

## Problem

Analyst notes are currently rendered inside the `DraftPreview` component (lines 950-968), which appears inside the preview modal. This makes them feel like part of the investor-facing memo. The user wants them placed outside the modal, directly in the main memo card UI as a collapsible dropdown that auto-opens once after generation.

## Changes

### File: `src/components/admin/data-room/MemosTab.tsx`

**1. Remove analyst notes from `DraftPreview`** (lines 950-968)
Delete the entire `{(() => { ... })()}` block that renders the amber analyst notes panel inside the preview.

**2. Add collapsible analyst notes dropdown in `MemoSlot`** (after line 642, right after the draft action buttons div closes)
- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible`
- Import `ChevronDown` from lucide
- Add state: `const [notesOpen, setNotesOpen] = useState(false)` and a ref `const prevDraftId = useRef<string | null>(null)` to track when a new draft arrives
- Add a `useEffect` that detects when `draft?.id` changes (new generation), auto-opens the collapsible once, then records the id so it doesn't re-open on subsequent renders
- Render a `<Collapsible>` block between the draft buttons (line 642) and the `<Separator />` (line 667):

```text
+------------------------------------------+
| [▼ Analyst Notes]     (collapsible trigger)
|   For internal review only               |
|   - Headcount conflict: ...              |
|   - Revenue figure: ...                  |
+------------------------------------------+
```

- Trigger: small button-like row with `ChevronDown` (rotates on open), amber icon, "Analyst Notes" label, and a subtle "internal only" badge
- Content: the same amber-bordered panel content that was previously in `DraftPreview`, but now outside the modal
- Only renders when `draft?.content?.analyst_notes` exists and is non-empty

**3. Auto-open behavior**
- `useEffect` watches `draft?.id`: when it changes to a new value (memo just generated), set `notesOpen = true`
- On subsequent visits or re-renders with the same draft, it stays in whatever state the admin left it

## No other files change

The preview modal stays clean (investor-ready document only). PDF and DOCX exports are unaffected since they only use the `sections` array.

