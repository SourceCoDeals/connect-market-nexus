

# Remove "General Inquiry" from My Deals

## Problem

The `resolve-buyer-message-thread` edge function creates a connection request tied to an internal listing (`00000000-0000-0000-0000-000000000001`) when a buyer messages without an existing thread. This "General Inquiry" request then appears in My Deals as a real deal, which is confusing.

## Fix

Filter out the internal general inquiry listing from the `useUserConnectionRequests` hook so it never appears in My Deals.

### File: `src/hooks/marketplace/use-connections.ts`

Add a `.neq('listing_id', '00000000-0000-0000-0000-000000000001')` filter to the query at line ~312, right after the `.eq('user_id', authUser.id)` filter. This ensures the general inquiry thread is excluded from My Deals while still being available for the messaging system (which has its own separate query).

One line change, surgical fix.

