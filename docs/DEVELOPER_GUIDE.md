# Connect Market Nexus - Developer Onboarding Guide

## Welcome

This guide will get you up and running with the Connect Market Nexus codebase. It covers the project structure, local development setup, key architectural patterns, and how to add new features.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Project Structure](#2-project-structure)
3. [Frontend Development](#3-frontend-development)
4. [Edge Function Development](#4-edge-function-development)
5. [Database & Migrations](#5-database--migrations)
6. [AI Integration Patterns](#6-ai-integration-patterns)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Key Workflows](#8-key-workflows)
9. [Testing](#9-testing)
10. [Deployment](#10-deployment)
11. [Common Tasks](#11-common-tasks)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Quick Start

### Prerequisites

- Node.js 18+ (install via [nvm](https://github.com/nvm-sh/nvm))
- npm 9+
- Supabase CLI (for edge function development): `npm install -g supabase`
- Git

### Local Setup

```bash
# Clone the repository
git clone <repository-url>
cd connect-market-nexus

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be running at `http://localhost:5173`.

### Environment

The Supabase client is configured in `src/integrations/supabase/client.ts` with the production project URL and anon key. For local development, the frontend connects directly to the production Supabase instance.

### Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

---

## 2. Project Structure

```
connect-market-nexus/
├── src/                          # Frontend source code
│   ├── pages/                    # Route-level page components
│   │   ├── admin/                # Admin-only pages
│   │   │   ├── remarketing/      # ReMarketing module
│   │   │   └── ma-intelligence/  # M&A Intelligence module
│   │   └── auth/                 # Auth pages
│   ├── components/               # Reusable components
│   │   ├── ui/                   # shadcn/ui primitives (buttons, dialogs, etc.)
│   │   ├── remarketing/          # ReMarketing-specific components
│   │   ├── ma-intelligence/      # M&A Intelligence components
│   │   ├── admin/                # Admin panel components
│   │   └── shared/               # Cross-module components
│   ├── hooks/                    # Custom React hooks (80+ hooks)
│   │   ├── remarketing/          # ReMarketing data hooks
│   │   ├── ma-intelligence/      # M&A Intelligence hooks
│   │   └── use-*.ts              # General-purpose hooks
│   ├── context/                  # React Context providers
│   ├── contexts/                 # Additional context providers
│   ├── integrations/supabase/    # Supabase client & auto-generated types
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions
│   ├── config/                   # App configuration
│   ├── constants/                # Shared constants
│   └── lib/                      # Library configs (shadcn utils)
├── supabase/
│   ├── functions/                # Edge functions (89 functions)
│   │   ├── _shared/              # Shared modules across functions
│   │   │   ├── ai-client.ts      # Unified AI provider interface
│   │   │   ├── ai-providers.ts   # AI API configs & model mappings
│   │   │   ├── security.ts       # Rate limiting, SSRF protection
│   │   │   ├── validation.ts     # Anti-hallucination guards
│   │   │   └── ...               # Other shared modules
│   │   ├── enrich-buyer/         # Each function in its own directory
│   │   │   └── index.ts
│   │   └── .../                  # 88 more function directories
│   └── migrations/               # SQL migration files (100+)
├── docs/                         # Documentation (you are here)
├── public/                       # Static assets
└── package.json
```

### Module Overview

| Module | Location | Purpose |
|--------|----------|---------|
| **Marketplace** | `src/pages/Marketplace.tsx` | Public deal browsing |
| **Admin Dashboard** | `src/pages/admin/Admin*.tsx` | Deal pipeline, users, notifications |
| **ReMarketing** | `src/pages/admin/remarketing/` | AI buyer-deal matching engine |
| **M&A Intelligence** | `src/pages/admin/ma-intelligence/` | Industry tracking & analysis |
| **Auth** | `src/context/AuthContext.tsx` | Authentication state management |

---

## 3. Frontend Development

### Component Patterns

**Page components** live in `src/pages/` and are connected to routes in `App.tsx`:

```typescript
// src/pages/admin/remarketing/ReMarketingBuyers.tsx
export default function ReMarketingBuyers() {
  const { data: buyers } = useQuery({ ... });
  return <div>...</div>;
}
```

**Feature components** live in `src/components/<module>/` and encapsulate specific UI sections:

```typescript
// src/components/remarketing/AIResearchSection.tsx
export function AIResearchSection({ universeId }: Props) {
  // Handles M&A guide generation UI, progress tracking, etc.
}
```

### Data Fetching with React Query

All server state uses TanStack React Query:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fetching data
const { data, isLoading, error } = useQuery({
  queryKey: ['remarketing-buyers', universeId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('remarketing_buyers')
      .select('*')
      .eq('universe_id', universeId);
    if (error) throw error;
    return data;
  },
});

// Mutating data
const queryClient = useQueryClient();
const updateBuyer = useMutation({
  mutationFn: async (updates) => {
    const { error } = await supabase
      .from('remarketing_buyers')
      .update(updates)
      .eq('id', buyerId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['remarketing-buyers'] });
  },
});
```

### Calling Edge Functions

```typescript
const { data, error } = await supabase.functions.invoke('enrich-buyer', {
  body: { buyerId, universeId },
});
```

For SSE streaming (M&A guide generation):

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/generate-ma-guide`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ universeId, industry }),
  }
);

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE events from chunk
}
```

### UI Components

The project uses **shadcn/ui** built on Radix primitives. All base components are in `src/components/ui/`:

```typescript
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
```

### Styling

- **Tailwind CSS** for utility-first styling
- **CSS variables** for theming (defined in `src/index.css`)
- **tailwind-merge** via `cn()` utility for conditional classes:

```typescript
import { cn } from '@/lib/utils';

<div className={cn('p-4 rounded', isActive && 'bg-primary text-white')} />
```

---

## 4. Edge Function Development

### Anatomy of an Edge Function

Each edge function lives in `supabase/functions/<function-name>/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Parse request
    const { buyerId, universeId } = await req.json();

    // 2. Create Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // 3. Verify authentication (optional)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Business logic here...

    // 5. Return response
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### Using Shared Modules

Import shared code from the `_shared` directory:

```typescript
import { callAI, AIProvider } from "../_shared/ai-client.ts";
import { validateExtraction } from "../_shared/validation.ts";
import { normalizeState } from "../_shared/geography.ts";

// Call AI with unified interface
const result = await callAI({
  provider: AIProvider.GEMINI,
  messages: [
    { role: "system", content: "You are an M&A analyst." },
    { role: "user", content: `Analyze: ${companyData}` },
  ],
  temperature: 0.3,
});

// Validate AI-extracted data (anti-hallucination)
const { valid, cleaned, errors } = validateExtraction(extractedData, "enrich-buyer");
```

### Creating a Service Role Client

For admin/background operations that need to bypass RLS:

```typescript
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
```

### Background Processing Pattern

For operations that may exceed the ~150s edge function timeout:

```typescript
serve(async (req) => {
  const { universeId } = await req.json();

  // Create tracking record
  const { data: tracking } = await supabaseAdmin
    .from("ma_guide_generations")
    .insert({
      universe_id: universeId,
      status: "processing",
      current_phase: 0,
      total_phases: 13,
    })
    .select()
    .single();

  // Return 202 immediately
  const response = new Response(
    JSON.stringify({ success: true, generationId: tracking.id }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  // Process in background (continues after response is sent)
  EdgeRuntime.waitUntil(async () => {
    try {
      for (let phase = 1; phase <= 13; phase++) {
        const content = await generatePhase(phase);
        await supabaseAdmin
          .from("ma_guide_generations")
          .update({ current_phase: phase, content })
          .eq("id", tracking.id);
      }
      await supabaseAdmin
        .from("ma_guide_generations")
        .update({ status: "completed" })
        .eq("id", tracking.id);
    } catch (error) {
      await supabaseAdmin
        .from("ma_guide_generations")
        .update({ status: "failed", error: error.message })
        .eq("id", tracking.id);
    }
  });

  return response;
});
```

### Deploying Edge Functions

Edge functions are deployed via the Supabase CLI or through Lovable:

```bash
# Deploy a single function
supabase functions deploy enrich-buyer

# Deploy all functions
supabase functions deploy
```

Or via Lovable deployment prompts in the Lovable UI.

---

## 5. Database & Migrations

### Database Access

The database is accessed through the Supabase client. Types are auto-generated in `src/integrations/supabase/types.ts`.

```typescript
import { supabase } from '@/integrations/supabase/client';

// Query with type safety
const { data } = await supabase
  .from('remarketing_buyers')
  .select('id, name, website, revenue')
  .eq('universe_id', universeId)
  .order('name');
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `deals` | Core deal records (50+ fields) |
| `buyers` | Buyer/acquirer records |
| `remarketing_buyers` | Buyers within universes |
| `remarketing_buyer_universes` | Industry-specific buyer groups |
| `remarketing_scores` | AI scoring results |
| `buyer_deal_scores` | Buyer-deal fit scores |
| `buyer_criteria_extractions` | Extracted criteria from guides |
| `ma_guide_generations` | Guide generation tracking |
| `enrichment_queue` | Deal enrichment queue |
| `buyer_enrichment_queue` | Buyer enrichment queue |
| `profiles` | User profiles |
| `user_roles` | Role assignments |
| `connection_requests` | Buyer-seller connections |
| `listings` | Public marketplace listings |
| `admin_notifications` | In-app admin notifications |

### Creating Migrations

Migrations are SQL files in `supabase/migrations/`:

```sql
-- supabase/migrations/20260205_add_new_table.sql

CREATE TABLE IF NOT EXISTS public.my_new_table (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Always add RLS
ALTER TABLE public.my_new_table ENABLE ROW LEVEL SECURITY;

-- Create appropriate policies
CREATE POLICY "Admins can manage" ON public.my_new_table
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### Row Level Security

Every table has RLS enabled. Common policy patterns:

```sql
-- Admin-only access
CREATE POLICY "Admin access" ON table_name
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- User sees own data
CREATE POLICY "Users see own" ON table_name
  FOR SELECT USING (user_id = auth.uid());

-- Service role bypasses RLS (used by edge functions with service role key)
```

---

## 6. AI Integration Patterns

### Unified AI Client

All AI calls should go through the shared `ai-client.ts`:

```typescript
import { callAI, AIProvider } from "../_shared/ai-client.ts";

// Simple text completion
const response = await callAI({
  provider: AIProvider.GEMINI,
  messages: [
    { role: "system", content: "You are an M&A analyst." },
    { role: "user", content: "Analyze this company..." },
  ],
  maxTokens: 2000,
  temperature: 0.3,
});

// With tool/function calling
const response = await callAI({
  provider: AIProvider.GEMINI,
  messages: [...],
  tools: [{
    type: "function",
    function: {
      name: "extract_company_data",
      description: "Extract structured company data",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          revenue: { type: "number" },
        },
      },
    },
  }],
  toolChoice: { type: "function", function: { name: "extract_company_data" } },
});
```

### Anti-Hallucination Validation

Always validate AI-extracted data before storing:

```typescript
import { validateExtraction } from "../_shared/validation.ts";

const extracted = parseAIResponse(response);
const { valid, cleaned, errors } = validateExtraction(extracted, "my-function");

if (errors.length > 0) {
  console.log(`Rejected ${errors.length} fields:`, errors);
}

// Use cleaned data (invalid fields removed)
await supabase.from('my_table').update(cleaned).eq('id', recordId);
```

### Choosing an AI Provider

| Use Case | Provider | Model | Reason |
|----------|----------|-------|--------|
| General extraction/enrichment | Gemini | gemini-2.0-flash | Fast, cost-effective |
| Complex analysis/scoring | Gemini | gemini-2.0-flash | Good reasoning |
| M&A guide generation | Gemini | gemini-2.0-pro-exp | Highest quality |
| Buyer criteria extraction | Claude | claude-sonnet-4 | Best structured output |
| Quick classification | Claude | claude-3-5-haiku | Fast, cheap |

---

## 7. Authentication & Authorization

### Frontend Auth

The `AuthContext` provides authentication state:

```typescript
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { user, session, isAdmin, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;
}
```

### Protected Routes

Routes are protected using the `ProtectedRoute` component:

```typescript
<Route
  path="/admin/remarketing"
  element={
    <ProtectedRoute requiredRole="admin">
      <ReMarketingDashboard />
    </ProtectedRoute>
  }
/>
```

### Edge Function Auth

```typescript
// Get the user from the JWT
const { data: { user }, error } = await supabase.auth.getUser();

// Check admin role
const { data: roles } = await supabaseAdmin
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

const isAdmin = roles?.some(r => r.role === 'admin');
```

### Roles

| Role | Access |
|------|--------|
| `admin` | Full platform access, all admin features |
| `user` | Marketplace, saved listings, connection requests |
| `pending_approval` | Limited access until admin approves |

---

## 8. Key Workflows

### Adding a New Edge Function

1. Create the directory and file:
   ```bash
   mkdir supabase/functions/my-new-function
   touch supabase/functions/my-new-function/index.ts
   ```

2. Use the standard boilerplate (see [Edge Function Development](#4-edge-function-development))

3. Import shared modules as needed from `../_shared/`

4. Deploy:
   ```bash
   supabase functions deploy my-new-function
   ```

### Adding a New Page

1. Create the page component in `src/pages/`
2. Add the route in `App.tsx`
3. Wrap with `ProtectedRoute` if auth is needed
4. Create feature components in `src/components/<module>/`
5. Create data hooks in `src/hooks/<module>/`

### Adding a New Database Table

1. Create a migration file in `supabase/migrations/`
2. Enable RLS and create policies
3. Regenerate types: the types in `src/integrations/supabase/types.ts` are auto-generated by Lovable

---

## 9. Testing

### Build Verification

```bash
npm run build
```

The build must complete without TypeScript errors. This is the primary quality gate.

### Lint

```bash
npm run lint
```

### Manual Testing Checklist

For ReMarketing features:
- [ ] Create a universe and verify it appears in the list
- [ ] Generate an M&A guide (background) and verify progress updates
- [ ] Import buyers via CSV and verify mapping
- [ ] Trigger buyer enrichment and verify data population
- [ ] Run buyer criteria extraction and verify confidence scores
- [ ] Score buyers against a deal and verify score display
- [ ] Rank deals via drag-and-drop and verify persistence

---

## 10. Deployment

### Frontend Deployment

The frontend is deployed via **Lovable**:

1. Push changes to the repository
2. Open the [Lovable project](https://lovable.dev/projects/8df57f00-890e-4371-9d16-50cee978b26f)
3. Click **Share → Publish**

### Edge Function Deployment

Edge functions are deployed either:

1. **Via Supabase CLI**: `supabase functions deploy <function-name>`
2. **Via Lovable**: Use deployment prompts that call `supabase functions deploy`

### Database Migrations

Migrations are applied automatically by Lovable or manually via:

```bash
supabase db push
```

---

## 11. Common Tasks

### Add a buyer to a universe

```typescript
await supabase.from('remarketing_buyers').insert({
  universe_id: universeId,
  name: 'Acme Corp',
  website: 'https://acme.com',
  buyer_type: 'pe_firm',
});
```

### Trigger enrichment for a buyer

```typescript
await supabase.functions.invoke('enrich-buyer', {
  body: { buyerId, universeId },
});
```

### Score a buyer against a deal

```typescript
await supabase.functions.invoke('score-buyer-deal', {
  body: { buyerId, dealId, universeId },
});
```

### Generate an M&A guide (background)

```typescript
const { data } = await supabase.functions.invoke('generate-ma-guide-background', {
  body: { universeId, industry: 'restoration services' },
});

// Poll for progress
const pollInterval = setInterval(async () => {
  const { data: gen } = await supabase
    .from('ma_guide_generations')
    .select('*')
    .eq('id', data.generationId)
    .single();

  if (gen.status === 'completed' || gen.status === 'failed') {
    clearInterval(pollInterval);
  }
}, 2000);
```

---

## 12. Troubleshooting

### Edge function timeout

**Symptom**: Function returns 504 or no response after ~150 seconds.

**Fix**: Use the background processing pattern (see Section 4). Create a tracking table, return 202 immediately, and process asynchronously.

### AI extraction returns 0% confidence

**Symptom**: Buyer criteria extraction returns very low confidence scores.

**Cause**: The M&A guide may use qualitative language that doesn't match strict numeric criteria.

**Fix**: The extraction logic has been updated to:
- Make schema fields optional for partial extraction
- Use relaxed scoring for qualitative guides
- Retry with simplified prompts on low confidence
- Apply inference rules for common industry terms

### Rate limiting errors

**Symptom**: 429 status codes from edge functions.

**Note**: Rate limits are currently set to 999999 (effectively unlimited) per user request. If you see rate limit errors, check the `security.ts` shared module.

### CORS errors

**Symptom**: Browser console shows CORS errors when calling edge functions.

**Fix**: Ensure the function handles `OPTIONS` preflight requests and includes the `corsHeaders` in all responses.

### Database permission errors

**Symptom**: `Row level security policy violation` errors.

**Fix**: Check that:
1. The user has the correct role in `user_roles`
2. The RLS policy exists for the operation (SELECT, INSERT, UPDATE, DELETE)
3. For service-to-service calls, use the service role key

### Build TypeScript errors

**Symptom**: `npm run build` fails with type errors.

**Fix**: Check `src/integrations/supabase/types.ts` is up to date with the database schema. If a new column was added to a table, the types file needs to be regenerated by Lovable.

---

## Further Reading

- [Architecture Overview](./ARCHITECTURE.md) — Full system architecture documentation
- [API Reference](./API_REFERENCE.md) — Complete edge function API documentation
- [Supabase Docs](https://supabase.com/docs) — Supabase platform documentation
- [shadcn/ui](https://ui.shadcn.com/) — Component library documentation
- [TanStack React Query](https://tanstack.com/query/latest) — Data fetching library
