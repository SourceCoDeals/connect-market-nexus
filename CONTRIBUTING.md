# Contributing to Connect Market Nexus

Thank you for your interest in contributing to Connect Market Nexus. This document outlines the development workflow, coding standards, and processes for submitting changes.

---

## Table of Contents

- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Project Conventions](#project-conventions)

---

## Development Setup

1. Follow the [Getting Started](README.md#getting-started) instructions in the README.
2. Ensure your editor has the following extensions:
   - **ESLint** -- For real-time linting feedback
   - **Tailwind CSS IntelliSense** -- For class name autocomplete
   - **TypeScript** -- For type checking (VS Code has this built in)
3. Confirm your environment:
   ```bash
   node --version   # >= 20.x
   npm --version    # >= 10.x
   ```

---

## Development Workflow

1. **Create a branch** from `main` following the [branch naming conventions](#branch-naming-conventions).
2. **Make your changes** in small, focused commits.
3. **Run linting** before committing:
   ```bash
   npm run lint
   ```
4. **Run tests** to confirm nothing is broken:
   ```bash
   npm test
   ```
5. **Build** to verify no compilation errors:
   ```bash
   npm run build
   ```
6. **Push your branch** and open a pull request.

---

## Branch Naming Conventions

Use the following prefixes to categorize your branch:

| Prefix | Purpose | Example |
|---|---|---|
| `feature/` | New features or capabilities | `feature/data-room-access-control` |
| `fix/` | Bug fixes | `fix/login-redirect-loop` |
| `refactor/` | Code restructuring without behavior changes | `refactor/scoring-engine-cleanup` |
| `docs/` | Documentation-only changes | `docs/update-api-reference` |
| `chore/` | Tooling, dependencies, config changes | `chore/upgrade-vite-5` |
| `test/` | Test additions or fixes | `test/add-currency-parser-tests` |
| `hotfix/` | Urgent production fixes | `hotfix/rls-policy-bypass` |

Guidelines:
- Use lowercase with hyphens (kebab-case).
- Keep names descriptive but concise.
- Include a ticket or issue number if applicable: `feature/PROJ-123-buyer-enrichment`.

---

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Formatting, missing semicolons, etc. (no code change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `chore` | Build process, dependency updates, or tooling changes |
| `perf` | Performance improvements |
| `ci` | CI/CD configuration changes |

### Scopes

Common scopes include: `admin`, `marketplace`, `remarketing`, `auth`, `data-room`, `edge-fn`, `scoring`, `db`, `ui`.

### Examples

```
feat(data-room): add three-level access control for documents

fix(auth): resolve session expiration redirect loop

refactor(scoring): extract geography scoring into separate module

docs(api): document new RPC functions for deal distribution

chore(deps): upgrade TanStack Query to v5.56
```

---

## Pull Request Process

### Before Opening a PR

1. Ensure your branch is up to date with `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. Run the full validation suite:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
3. Verify that no `.env` files, credentials, or secrets are included in the diff.

### PR Requirements

- **Title**: Use a clear, concise title following the commit message format (e.g., `feat(marketplace): add advanced filter panel`).
- **Description**: Include:
  - A summary of what the PR does and why.
  - Screenshots or screen recordings for UI changes.
  - A list of any database migrations included.
  - A list of any new or modified edge functions.
  - Testing steps for reviewers.
- **Size**: Keep PRs focused. Aim for fewer than 400 lines of changed code when possible. Split large features into incremental PRs.
- **Labels**: Tag the PR with relevant labels (e.g., `feature`, `bug`, `breaking-change`).

### Review Process

1. At least **one approval** is required before merging.
2. Address all review comments before requesting re-review.
3. Resolve merge conflicts by rebasing on `main` rather than merge commits.
4. Squash commits into a clean history when merging.

### After Merging

- Delete the source branch.
- Verify the deployment succeeded (check production for critical changes).
- Update any related issues or tickets.

---

## Code Style Guidelines

### TypeScript

- Use TypeScript strict mode. Avoid `any` types where possible (the ESLint rule is disabled for pragmatism, but prefer explicit types).
- Use `interface` for object shapes and `type` for unions, intersections, and aliases.
- Use named exports. Default exports are reserved for page components (required by `React.lazy`).
- Prefer `const` over `let`. Never use `var`.

### React Components

- Use functional components with hooks exclusively.
- Co-locate component-specific types, hooks, and utilities in the same directory.
- Use the `@/` path alias for imports (maps to `src/`):
  ```typescript
  import { useAuth } from "@/context/AuthContext";
  ```
- Organize imports in this order:
  1. React and third-party libraries
  2. Internal components (`@/components/`)
  3. Hooks (`@/hooks/`)
  4. Utilities and types (`@/lib/`, `@/types/`)
  5. Styles

### Styling

- Use **Tailwind CSS** utility classes for all styling.
- Use **shadcn/ui** components as the base layer. Do not import Radix primitives directly unless extending a shadcn component.
- Use `cn()` from `@/lib/utils` to merge conditional class names:
  ```typescript
  import { cn } from "@/lib/utils";
  <div className={cn("base-class", isActive && "active-class")} />
  ```
- Use CSS variables for theming (defined in `src/index.css`).

### Hooks

- Prefix custom hooks with `use` (e.g., `useFilterEngine`, `useDealAlerts`).
- Place hooks in `src/hooks/` or in feature-specific subdirectories.
- Use TanStack React Query for all server state. Use React Context for client-only global state.

### File Naming

- React components: `PascalCase.tsx` (e.g., `FilterPanel.tsx`)
- Hooks: `use-kebab-case.ts` or `useCamelCase.ts` (both conventions exist in the codebase)
- Utilities: `kebab-case.ts` (e.g., `financial-parser.ts`)
- Types: `kebab-case.ts` (e.g., `admin-users.ts`)
- Test files: `<source-file>.test.ts` (co-located with the source file)

### Edge Functions

- Each function has its own directory under `supabase/functions/`.
- Share common logic via modules in `supabase/functions/_shared/`.
- Always use the `requireAuth()` or `requireAdmin()` guards from `_shared/auth.ts`.
- Handle CORS using `getCorsHeaders()` from `_shared/cors.ts`.
- Return JSON responses with appropriate HTTP status codes.
- Log errors but never expose internal details in response bodies.

### Database

- All new tables must have Row Level Security (RLS) enabled.
- Create migrations using the Supabase CLI:
  ```bash
  supabase migration new <descriptive-name>
  ```
- Use `IF NOT EXISTS` for table and index creation to ensure idempotency.
- Name RLS policies descriptively (e.g., `"Admins can manage all categories"`).
- Always include `created_at` and `updated_at` columns with appropriate defaults.

---

## Testing Requirements

### When to Write Tests

- **Required**: Changes to scoring algorithms, financial parsers, security utilities, or shared edge function modules.
- **Recommended**: New utility functions in `src/lib/` and complex business logic.
- **Optional**: UI components (prefer visual testing and smoke tests for these).

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Test Conventions

- Place test files next to the source file with a `.test.ts` extension.
- Use descriptive test names that explain the expected behavior:
  ```typescript
  describe("financial-parser", () => {
    it("should parse '$1.5M' as 1500000", () => { ... });
    it("should handle negative EBITDA values", () => { ... });
  });
  ```
- Test edge cases and error conditions, not just the happy path.
- Do not mock Supabase client in unit tests -- test pure logic functions directly.

### Test Coverage

Coverage is configured for:
- `src/lib/**/*.ts` -- Core business logic
- `supabase/functions/_shared/**/*.ts` -- Shared edge function modules

---

## Project Conventions

### React Query Keys

Use the key factories defined in `src/lib/query-keys.ts` for consistent cache management:

```typescript
import { queryKeys } from "@/lib/query-keys";

useQuery({
  queryKey: queryKeys.listings.all,
  queryFn: fetchListings,
});
```

### Error Handling

Use the centralized error handler from `src/lib/error-handler.ts`:

```typescript
import { errorHandler } from "@/lib/error-handler";

try {
  await riskyOperation();
} catch (error) {
  errorHandler(error, { component: "MyComponent", operation: "riskyOperation" });
}
```

### Route Protection

- Use the `<ProtectedRoute>` component for authenticated routes.
- Use `requireApproved={true}` for buyer-facing routes (requires approved `approval_status`).
- Use `requireAdmin={true}` for admin routes.

---

## Questions?

If you have questions about the codebase or contribution process, reach out to the development team or open a GitHub issue for discussion.
