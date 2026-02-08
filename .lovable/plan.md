

# Editable Company Name on Deal Detail Page

## What Changes
The company name (the big heading) on the deal detail page will become editable inline. Clicking a pencil icon next to it will let you type the real company name, which saves to the `internal_company_name` field in the database.

## How It Works
- A small pencil icon appears next to the company name heading
- Clicking it turns the name into a text input pre-filled with the current name
- You can type the real company name and press Enter or click a checkmark to save
- Press Escape or click away to cancel
- The update saves to `internal_company_name` on the `listings` table
- If the deal came from the marketplace with an anonymous title, the "Listed as:" subtitle continues showing the original anonymous name

## Technical Details

**File: `src/pages/admin/remarketing/ReMarketingDealDetail.tsx`**

1. Add local state for inline editing: `isEditingName`, `editedName`
2. Replace the static `<h1>` at line 365 with a conditional render:
   - **View mode**: Show current `displayName` with a `Pencil` icon button beside it
   - **Edit mode**: Show an `<Input>` with the current name, plus Save (check) and Cancel (X) icon buttons
3. On save, call `supabase.from('listings').update({ internal_company_name: editedName }).eq('id', dealId)` and invalidate the query cache
4. Update `displayName` logic: after saving, the new `internal_company_name` takes priority over the anonymous `title`

No new components or dependencies needed -- reuses existing `Input`, `Button`, `Pencil`/`Check`/`X` icons already imported in the file.
