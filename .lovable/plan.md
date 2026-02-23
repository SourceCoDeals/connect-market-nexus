

## Add Primary Contact Info to Expandable Section

### What Changes
When the chevron is expanded on a BuyerMatchCard, the section will now show the primary contact's details (name, email, phone, LinkedIn) alongside the existing investment thesis. If no primary contact is flagged, the first contact in the array will be used.

### Layout
The expanded section will show a "Primary Contact" block above the thesis:

```text
---------------------------------------
| Primary Contact                      |
| John Smith  -  Managing Director     |
| john@firm.com  |  (555) 123-4567     |
| LinkedIn (link)                      |
---------------------------------------
| Investment Thesis                    |
| "We look for companies..."          |
---------------------------------------
```

- Name and role on one line
- Email (clickable mailto) and phone (clickable tel) on the next line
- LinkedIn as a small linked icon/text if available
- All fields shown conditionally (only if data exists)

### Technical Details

**File: `src/components/remarketing/BuyerMatchCard.tsx`**

1. Add `Linkedin`, `Phone` icons to the lucide imports
2. Inside the `<CollapsibleContent>` (line ~721), before the thesis section, add a contact info block:
   - Find the primary contact: `buyer?.contacts?.find(c => c.is_primary) || buyer?.contacts?.[0]`
   - Render name + role, email (mailto link), phone (tel link), LinkedIn (external link)
   - Styled consistently with the existing card (text-xs/text-sm, muted-foreground tokens)
3. No new data fetching needed -- contacts are already loaded on the `buyer` object
