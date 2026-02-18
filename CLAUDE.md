# Claude Code Guidelines

## Specialized Agents (REQUIRED)

**You MUST use these agents when their domain applies.** Do not attempt to do the work directly - always delegate to the appropriate agent:

- **postgresql-supabase-expert** - Database migrations, schema design, RLS policies
- **supabase-data-layer** - Extracting business logic (calculations, transformations)
- **route-feature-patterns** - Implementing features (routes, forms, tables)
- **shadcn-component-creator** - Creating new custom UI components
- **i18n-patterns** - Translations with Lingui (use after adding new Trans/t`` strings)

## After Database Schema Changes

When modifying database schema (migrations), always follow this workflow:

1. **Apply the migration** to the local database
2. **Regenerate TypeScript types** immediately:
   ```bash
   pnpm supabase:types
   ```
3. **Update all affected queries** - TypeScript will flag mismatches after regenerating types
4. **Check related files** - Search for usages of modified tables:
   ```bash
   # Find files using a specific table
   grep -r "from('table_name')" src/
   ```

## Project Structure

- **Routes**: `src/routes/_authenticated/dashboard/` - File-based routing with TanStack Router
- **UI Components**: `src/components/ui/` - Reusable shadcn-style components
- **Database Types**: `src/lib/database.types.ts` - Auto-generated from Supabase schema
- **Supabase Client**: `src/lib/supabase.ts`

## Key Patterns

### Route Files
- Use `createFileRoute()` with `loader` for data fetching
- Use `Route.useLoaderData()` to access loader data
- Use `getRouteApi()` to access parent route loader data from child routes
- Use `router.invalidate()` after mutations to refresh data

### State Management (TanStack Router + TanStack Store)

**Use TanStack Router loaders for:**
- Server data that should be fetched on route entry
- Static/reference data (lookups, lists)
- Data that benefits from route-based caching

**Use TanStack Store for:**
- Ephemeral UI state that shouldn't be in the URL
- State shared across child routes that changes frequently
- Optimistic updates for better UX
- Derived/computed values

**Example pattern:**
```
routes/dashboard/schedule.tsx       # Layout with loader for static data
routes/dashboard/schedule/-store/   # TanStack Store for dynamic state
routes/dashboard/schedule/status.tsx # Child combines both sources
```

```tsx
// Child route combining router + TanStack Store
import { useStore } from '@tanstack/react-store'

const { employees } = parentRoute.useLoaderData()        // Static from router
const shifts = useStore(scheduleStore, (s) => s.shifts)  // Dynamic from store
```

### Forms (TanStack Form)
- Use `useAppForm` from `@/hooks/form` with Zod schema validation
- Use Sheet component for create/edit modals
- Reusable field components via `createFormHook` context pattern
- Field components in `src/components/form-components.tsx`

### Reusable Components
- `ToggleGroup` - For segmented button toggles (HR/Payroll, Status/Project/Summary)
- `DataTable` - TanStack Table wrapper with column visibility
- `Field`, `FieldLabel`, `FieldError` - Form field components

### Icons
Use `lucide-react` for icons:
```tsx
import { Pencil, Lock, RefreshCw } from 'lucide-react'

<Pencil className="size-4" />
```

## Code Style & Quality (REQUIRED)

**After writing or modifying any code, you MUST run:**
```bash
cd wa-sales && pnpm check
```
This runs `prettier --write . && eslint --fix` to auto-format and fix lint issues.

**Prettier config** (no semicolons, single quotes, trailing commas):
- No semicolons
- Single quotes
- Trailing commas everywhere

**If `pnpm check` reports remaining errors, fix them manually before considering the task done.**

## Scripts

```bash
pnpm dev              # Start dev server (port 3000)
pnpm check            # Format + lint fix (ALWAYS run after code changes)
pnpm lint             # ESLint check only
pnpm format           # Prettier check only
pnpm supabase:types   # Regenerate database types
pnpm lingui:extract   # Extract translation strings
pnpm lingui:compile   # Compile translations
```

