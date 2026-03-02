

## Problems Identified

### 1. Signing forms fail ("Failed to load signing form")
The edge functions `get-buyer-nda-embed` and `get-buyer-fee-embed` are booting but producing no output. The test user (FD) likely doesn't have a `firm_members` record or `firm_agreements` entry, so the function returns an error response that the modal interprets as failure. The modal error handling is also overly generic -- it doesn't distinguish between "no firm" vs "DocuSeal error" to give the user actionable feedback.

### 2. Download Draft fails ("Could not retrieve document")
The `useDownloadDocument` hook calls `supabase.functions.invoke('get-document-download?document_type=nda')`. However, `supabase.functions.invoke()` sends a **POST request**, and the query parameter gets appended to the function name, not the URL path. The edge function reads `document_type` from `url.searchParams`, which will be empty. Fix: pass `document_type` in the POST body instead.

### 3. Document questions don't appear in the conversation
When a user sends a "Redlines / Questions?" message via `DocumentDialog`, it uses `useSendDocumentQuestion` which inserts into `connection_messages`. However, the General Inquiry chat (`GeneralChatView`) maintains its own local `sentMessages` state and doesn't refetch immediately. Also, the message body uses a generic format that doesn't visually distinguish it as related to a specific document in the conversation thread.

### 4. Messages not prominent enough in navbar
The Messages link is present but blends in with other nav items. It needs visual emphasis to stand out.

---

## Solution

### Fix 1: Download edge function -- pass document_type in body
**File: `supabase/functions/get-document-download/index.ts`**
- Read `document_type` from both query params AND request body (POST JSON), preferring body
- This ensures compatibility with `supabase.functions.invoke()`

**File: `src/pages/BuyerMessages/useMessagesActions.ts`**
- Change invoke call from `get-document-download?document_type=...` to passing `document_type` in the body: `supabase.functions.invoke('get-document-download', { body: { document_type: documentType } })`

### Fix 2: Signing modal -- better error messages
**File: `src/components/docuseal/AgreementSigningModal.tsx`**
- When the edge function returns `hasFirm: false`, show a specific message: "Your account hasn't been set up for signing yet. Please contact our team."
- When it returns a generic error, show the current message
- Add a "Contact Us" button linking to `/messages?deal=general`

### Fix 3: Document questions appear in conversation
**File: `src/pages/BuyerMessages/DocumentDialog.tsx`**
- After successfully sending a document question, navigate to the General Inquiry view (`/messages?deal=general`) so the user sees their question in context
- Add a visual tag/prefix in the message body to clearly mark it as NDA/Fee Agreement related (already uses a document emoji, but enhance with a label like `[NDA Question]` or `[Fee Agreement Redline]`)

**File: `src/pages/BuyerMessages/GeneralChatView.tsx`**  
- After sending, invalidate queries to ensure messages refresh immediately

### Fix 4: Messages prominence in navbar
**File: `src/components/navbar/DesktopNavItems.tsx`**
- Add subtle visual differentiation to the Messages nav item (e.g., a distinct icon treatment or border/highlight when there are unread messages) so it stands out more
- Ensure the unread badge is always visible even with 0 unreads (show the icon differently)

---

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/get-document-download/index.ts` | Read `document_type` from request body as fallback when query param is empty |
| `src/pages/BuyerMessages/useMessagesActions.ts` | Pass `document_type` in invoke body instead of query string |
| `src/components/docuseal/AgreementSigningModal.tsx` | Better error messages for "no firm" case, add contact link |
| `src/pages/BuyerMessages/DocumentDialog.tsx` | After send, navigate to general chat; enhance message format |
| `src/components/navbar/DesktopNavItems.tsx` | Make Messages nav item more prominent with visual emphasis |

### Technical Details

**Download fix (root cause):** `supabase.functions.invoke('get-document-download?document_type=nda')` treats the entire string as the function name. The `?document_type=nda` never reaches the URL search params. The edge function needs to also parse POST body for the document_type parameter.

**Signing fix:** The edge functions are working correctly -- they return structured JSON with `hasFirm: false` when no firm exists. The modal just needs to handle this response properly instead of showing a generic error.

**Message threading:** The `useSendDocumentQuestion` mutation already inserts into `connection_messages` and invalidates queries. The issue is that `GeneralChatView` uses local `sentMessages` state as a fallback when there's no `activeRequest`. After sending a document question, the view should be directed to the general chat where the query invalidation will pick up the new message.

