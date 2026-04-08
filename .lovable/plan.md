

# Add Tooltip to "Lead-Only" Badge

## What

Add an info icon (ℹ) with a tooltip to every "Lead-Only" badge explaining that this lead submitted via the website and does not have a marketplace account.

## Changes

**`src/components/admin/ConnectionRequestRow.tsx`** — 3 locations:

1. **Line 510-512** (collapsed row header badge): Wrap the `<Badge>` in a `<Tooltip>` with an `Info` icon appended inside. Tooltip text: *"This request came from a website form submission. The lead is not a registered marketplace user."*

2. **Line 310-312** (expanded detail "Lead-Only Request" badge): Same treatment.

3. Any other "Lead-Only" badge instance in the file gets the same wrapper.

Uses existing `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` from `@/components/ui/tooltip` and `Info` icon from `lucide-react` (both already imported/available in the project).

