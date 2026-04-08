

## Problem

The build is failing because `ClientPreviewDialog.tsx` imports `untypedFrom` from a non-existent module `@/integrations/supabase/untyped-from`. The function actually lives in `@/integrations/supabase/client`.

This also causes cascading type errors (lines 148, 196, 214, 220, 229, 260, 261) because the file can't compile.

## Fix

**File: `src/components/remarketing/deal-detail/ClientPreviewDialog.tsx`**

1. Change line 27 from:
   ```ts
   import { untypedFrom } from '@/integrations/supabase/untyped-from';
   ```
   to:
   ```ts
   import { untypedFrom } from '@/integrations/supabase/client';
   ```

2. Fix the type error on line 148: the `portalPush` variable (from a query) can be `undefined`, but the `PortalPreview` component expects `Record<string, unknown> | null`. Add `?? null` to coerce `undefined` to `null`.

3. Fix `unknown` → `ReactNode` errors on lines 196, 214, 220, 229, 260, 261: these are values from the `push` object (typed as `Record<string, unknown>`) being rendered as JSX children. They're already wrapped in `String()` or conditional checks — the fix is to ensure all rendered values go through `String()` casts, which the code mostly already does. The root cause is that the file couldn't compile at all due to the bad import, so these are secondary. Once the import is fixed and `push` prop type is correct, the remaining `unknown` issues just need explicit `String()` wrapping where missing.

This is a single-file, single-line import fix that will unblock the build.

