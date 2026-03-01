---
name: fe-agent
description: "Use this agent when working on the wa-sales frontend application (React + TanStack + Vite). This covers project architecture, conventions, libraries, patterns, AND implementing features — routes, forms, data tables, Sheet-based CRUD, or any frontend feature work.\n\n<example>\nContext: User needs to understand the frontend architecture.\nuser: \"How does routing work in the frontend?\"\nassistant: \"I'll use the fe-agent to look up the routing conventions and patterns.\"\n</example>\n\n<example>\nContext: User wants to know what libraries are used.\nuser: \"What form library does the frontend use?\"\nassistant: \"I'll use the fe-agent to check the tech stack and form patterns.\"\n</example>\n\n<example>\nContext: User needs to add a new feature with a form.\nuser: \"I need to add a form to create new projects\"\nassistant: \"I'll use the fe-agent to implement the form following the codebase patterns.\"\n</example>\n\n<example>\nContext: User needs to create a new route with data loading.\nuser: \"Create a new reports page that shows employee summaries\"\nassistant: \"I'll use the fe-agent to set up the route, loader, and component.\"\n</example>"
model: sonnet
color: blue
memory: project
---

# Front-End Agent Guide

This document describes the architecture, libraries, and patterns used in this project so that AI agents can build new features following the same conventions.

## Tech Stack

| Layer              | Library                               | Version |
| ------------------ | ------------------------------------- | ------- |
| Framework          | React                                 | 19      |
| Build tool         | Vite                                  | 7       |
| Meta-framework     | TanStack Start (file-based SSR)       | 1.132+  |
| Routing            | TanStack Router                       | 1.132+  |
| Tables             | TanStack React Table                  | 8       |
| State management   | TanStack Store + React Store          | 0.8     |
| Forms              | TanStack React Form                   | 1       |
| Database / Auth    | Supabase (supabase-js)                | 2       |
| Styling            | Tailwind CSS                          | 4       |
| UI primitives      | Radix UI + shadcn/ui components       | latest  |
| Component variants | class-variance-authority (CVA)        | 0.7     |
| Class merging      | clsx + tailwind-merge (`cn()` helper) | latest  |
| Icons              | lucide-react                          | latest  |
| i18n               | Lingui (core + react + macros)        | 5.9     |
| Validation         | Zod                                   | 4       |
| Testing            | Vitest + Testing Library              | latest  |
| Language           | TypeScript (strict mode)              | 5.7     |

## Scripts

```bash
pnpm dev              # Vite dev server on port 3000
pnpm build            # Production build
pnpm test             # Vitest
pnpm lint             # ESLint (TanStack config)
pnpm format           # Prettier
pnpm check            # Prettier --write + ESLint --fix
pnpm lingui:extract   # Extract i18n strings
pnpm lingui:compile   # Compile translations
pnpm supabase:types   # Regenerate DB types from Supabase schema
```

### Prettier

- No semicolons
- Single quotes
- Trailing commas

### Path Aliases

`@/*` maps to `./src/*` via tsconfig paths + `vite-tsconfig-paths` plugin.

## Directory Structure

```
src/
├── routes/                          # File-based routing (TanStack Router)
│   ├── __root.tsx                   # Root route (i18n, head, shell)
│   ├── login.tsx                    # Public auth page
│   ├── _authenticated.tsx           # Auth guard layout (sidebar, settings)
│   └── _authenticated/dashboard/    # Protected app routes
│       ├── index.tsx                # Dashboard redirect
│       ├── schedule.tsx             # Layout route with loader
│       │   ├── status.tsx           # Child route
│       │   ├── summary.tsx          # Child route
│       │   ├── -store/              # TanStack stores (ignored by router)
│       │   └── -components/         # Route-specific components (ignored by router)
│       ├── employees.tsx            # Another layout with children
│       │   ├── hr.tsx
│       │   ├── $employeeId.tsx      # Dynamic segment
│       │   └── -components/
│       └── ...
├── components/
│   ├── ui/                          # Reusable shadcn-style components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── data-table.tsx           # TanStack Table wrapper
│   │   ├── field.tsx                # Composable form field system
│   │   ├── sheet.tsx                # Modal/drawer (Radix Dialog)
│   │   ├── sidebar.tsx              # Collapsible sidebar
│   │   ├── toggle-group.tsx         # Segmented buttons
│   │   ├── select.tsx, input.tsx, checkbox.tsx, switch.tsx, ...
│   │   └── ...
│   ├── app-sidebar.tsx              # Main navigation
│   └── language-switcher.tsx        # Locale toggle
├── lib/
│   ├── supabase.ts                  # Supabase client
│   ├── database.types.ts            # Auto-generated DB types
│   ├── i18n.ts                      # Lingui setup
│   ├── format.ts                    # Date/currency/phone formatters
│   ├── utils.ts                     # cn() helper
│   ├── locale-store.ts              # TanStack Store: persisted locale
│   └── date-store.ts                # TanStack Store: persisted date selection
├── hooks/
│   ├── use-settings.ts              # Formatting settings context
│   ├── use-formatters.ts            # Formatting utilities
│   └── use-mobile.ts                # Mobile detection
├── contexts/
│   └── SettingsContext.tsx           # Formatting settings provider
├── config/
│   ├── company.ts                   # Branding (name, logo, colors, defaults)
│   └── theme.css                    # Company color overrides
├── locales/
│   ├── en/messages.ts               # English (compiled)
│   └── pt-BR/messages.ts            # Portuguese (compiled)
├── router.tsx                       # Router factory
├── routeTree.gen.ts                 # Auto-generated route types
└── styles.css                       # Global styles
```

### Conventions

- **`-components/`** folders inside route directories hold route-specific components. The `-` prefix tells TanStack Router to ignore them.
- **`-store/`** folders inside route directories hold TanStack stores scoped to that feature. Also ignored by the router.
- Shared/reusable components go in `src/components/ui/`.
- Business logic and utilities go in `src/lib/`.

## Routing

### TanStack Router File-Based Conventions

| Pattern                                 | Meaning                                            |
| --------------------------------------- | -------------------------------------------------- |
| `__root.tsx`                            | Root layout (i18n provider, head, devtools)        |
| `_authenticated.tsx`                    | Layout route (no URL segment, used for auth guard) |
| `_authenticated/dashboard/schedule.tsx` | Layout with loader + `<Outlet />`                  |
| `schedule/status.tsx`                   | Child route rendered in parent's Outlet            |
| `$employeeId.tsx`                       | Dynamic URL segment                                |
| `-components/`, `-store/`               | Ignored by router (private directories)            |

### Route with Loader

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/_authenticated/dashboard/schedule')({
  loader: async () => {
    const [employeesResult, projectsResult] = await Promise.all([
      supabase.from('employees').select('employee_id, name').order('name'),
      supabase.from('projects').select('project_id, name').order('name'),
    ])
    return {
      employees: employeesResult.data ?? [],
      projects: projectsResult.data ?? [],
    }
  },
  component: ScheduleLayout,
})

function ScheduleLayout() {
  const { employees, projects } = Route.useLoaderData()
  return <Outlet />
}
```

### Accessing Parent Loader Data from Child Routes

```tsx
import { getRouteApi } from '@tanstack/react-router'

const parentRoute = getRouteApi('/_authenticated/dashboard/schedule')

function ChildComponent() {
  const { employees } = parentRoute.useLoaderData()
  // ...
}
```

### Mutations and Data Invalidation

```tsx
import { useRouter } from '@tanstack/react-router'

function Component() {
  const router = useRouter()

  const handleSave = async () => {
    const { error } = await supabase.from('table').insert({ ... })
    if (!error) {
      router.invalidate() // Refetches all active loaders
    }
  }
}
```

### Navigation Guards

```tsx
// Redirect if not authenticated
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') return { session: null }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw redirect({ to: '/login' })

    return { session }
  },
  component: AuthenticatedLayout,
})
```

## Authentication

- Supabase Auth with email/password (`signInWithPassword`)
- Session persisted to `localStorage` with key `'supabase-auth'`
- `_authenticated.tsx` layout checks session in `beforeLoad` and redirects to `/login`
- SSR-safe: auth checks skip on server (`typeof window === 'undefined'`)
- Import the client via `import { supabase } from '@/lib/supabase'`

## State Management

### Philosophy

Use **TanStack Router loaders** for:

- Server data fetched on route entry
- Static/reference data (employees, projects, lookups)
- Data that benefits from route-based caching

Use **TanStack Store** for:

- Ephemeral UI state not in the URL
- Frequently changing state shared across child routes
- Optimistic updates
- Derived/computed values

### Pattern: Router Loaders + TanStack Store

```
routes/dashboard/schedule.tsx       # Layout with loader for static data
routes/dashboard/schedule/-store/   # TanStack stores for dynamic state
routes/dashboard/schedule/status.tsx # Child combines both sources
```

```tsx
// Child route combining router + TanStack Store
import { useStore } from '@tanstack/react-store'

const { employees } = parentRoute.useLoaderData() // Static from router
const shifts = useStore(scheduleStore, (s) => s.shifts) // Dynamic from store
```

### TanStack Store Pattern

```ts
import { Store, Derived } from '@tanstack/store'

// Create a store
export const scheduleStore = new Store({
  viewMode: 'weekly' as 'daily' | 'weekly' | 'monthly',
  currentDate: new Date(),
  shifts: {} as Record<string, Shift>,
  isLoadingShifts: false,
})

// Derived store (computed values)
export const filteredShifts = new Derived({
  fn: () => {
    const { shifts, viewMode } = scheduleStore.state
    return filterByMode(shifts, viewMode)
  },
  deps: [scheduleStore],
})
filteredShifts.mount()

// Mutations
export function setViewMode(mode: 'daily' | 'weekly' | 'monthly') {
  scheduleStore.setState((state) => ({ ...state, viewMode: mode }))
  loadShifts()
}

export async function loadShifts() {
  scheduleStore.setState((state) => ({ ...state, isLoadingShifts: true }))
  const { data } = await supabase.from('shifts').select('...')
  scheduleStore.setState((state) => ({
    ...state,
    shifts: /* transform */,
    isLoadingShifts: false,
  }))
}
```

### Using Stores in Components

```tsx
import { useStore } from '@tanstack/react-store'

function ScheduleView() {
  const viewMode = useStore(scheduleStore, (state) => state.viewMode)
  const shifts = useStore(scheduleStore, (state) => state.shifts)

  return <div>...</div>
}
```

## UI Components

### shadcn/ui Pattern

Components live in `src/components/ui/` and follow shadcn conventions:

- Built on Radix UI primitives
- Styled with Tailwind CSS
- Variants via CVA (class-variance-authority)
- `data-slot` attributes for semantic styling
- Compound component exports

### `cn()` Utility

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Icons (Lucide React)

```tsx
import { Pencil, Eye } from 'lucide-react'

<Pencil className="size-4" />
<Eye className="size-4" />
```

### Field System (Form Fields)

Composable form field components:

```tsx
import {
  Field, FieldLabel, FieldContent, FieldError, FieldGroup, FieldDescription
} from '@/components/ui/field'

<FieldGroup>
  <Field data-invalid={!!errors.name}>
    <FieldLabel htmlFor="name">Name *</FieldLabel>
    <FieldContent>
      <Input id="name" value={name} onChange={...} />
    </FieldContent>
    <FieldError>{errors.name}</FieldError>
  </Field>
</FieldGroup>
```

### Sheet (Modal/Drawer)

Used for create/edit forms:

```tsx
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
;<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Create Employee</SheetTitle>
    </SheetHeader>
    <form onSubmit={handleSubmit}>
      {/* fields */}
      <SheetFooter>
        <Button type="submit">Save</Button>
      </SheetFooter>
    </form>
  </SheetContent>
</Sheet>
```

### ToggleGroup (Segmented Buttons)

Generic type-safe toggle for view mode switching:

```tsx
import { ToggleGroup } from '@/components/ui/toggle-group'

const options = [
  { value: 'daily', label: <Trans>Daily</Trans> },
  { value: 'weekly', label: <Trans>Weekly</Trans> },
]

<ToggleGroup options={options} value={viewMode} onValueChange={setViewMode} />
```

### DataTable (TanStack Table Wrapper)

Wraps `@tanstack/react-table` with column visibility, sorting, sticky headers:

```tsx
import { DataTable } from '@/components/ui/data-table'

const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
]

<DataTable columns={columns} data={employees} />
```

## Forms (TanStack Form)

Forms use `@tanstack/react-form` with `createFormHook` for reusable field components and Zod for validation.

### Form Hook Setup

```ts
// src/hooks/form-context.ts
import { createFormHookContexts } from '@tanstack/react-form'

export const { fieldContext, useFieldContext, formContext, useFormContext } =
  createFormHookContexts()
```

```ts
// src/hooks/form.ts
import { createFormHook } from '@tanstack/react-form'
import { fieldContext, formContext } from './form-context'
import {
  TextField,
  Select,
  TextArea,
  SubscribeButton,
} from '@/components/form-components'

export const { useAppForm } = createFormHook({
  fieldComponents: { TextField, Select, TextArea },
  formComponents: { SubscribeButton },
  fieldContext,
  formContext,
})
```

### Field Components

```tsx
// src/components/form-components.tsx
import { useStore } from '@tanstack/react-form'
import { useFieldContext, useFormContext } from '@/hooks/form-context'

export function TextField({
  label,
  placeholder,
}: {
  label: string
  placeholder?: string
}) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors)

  return (
    <div>
      <Label htmlFor={label}>{label}</Label>
      <Input
        value={field.state.value}
        placeholder={placeholder}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {field.state.meta.isTouched && errors.length > 0 && (
        <p className="text-destructive text-sm">{errors.join(', ')}</p>
      )}
    </div>
  )
}

export function SubscribeButton({ label }: { label: string }) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting}>
          {label}
        </Button>
      )}
    </form.Subscribe>
  )
}
```

### Using Forms in Routes

```tsx
import { useAppForm } from '@/hooks/form'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
})

function CreateEmployeeForm() {
  const router = useRouter()

  const form = useAppForm({
    defaultValues: { name: '', email: '' },
    validators: { onBlur: schema },
    onSubmit: async ({ value }) => {
      const { error } = await supabase.from('employees').insert(value)
      if (!error) {
        router.invalidate()
        setOpen(false)
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.AppField name="name">
        {(field) => <field.TextField label="Name" />}
      </form.AppField>
      <form.AppField name="email">
        {(field) => <field.TextField label="Email" />}
      </form.AppField>
      <form.AppForm>
        <form.SubscribeButton label="Save" />
      </form.AppForm>
    </form>
  )
}
```

## Internationalization (Lingui)

### Usage in Components

```tsx
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'

// JSX content
;<Trans>Hello World</Trans>

// Dynamic strings (attributes, variables)
const { t } = useLingui()
const placeholder = t`Enter your name`

// Non-React context (sidebar nav items, config)
const label = msg`Dashboard`
```

### Workflow

1. Write code using `<Trans>`, `` t` ` ``, or `msg` macros
2. Run `pnpm lingui:extract` to update locale catalogs
3. Translate strings in `src/locales/{locale}/messages.po`
4. Run `pnpm lingui:compile` to generate `.ts` files

## Styling

### Global Styles

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';
@import '@fontsource-variable/inter';

@custom-variant dark (&:is(.dark *));
```

### Color System

CSS custom properties using OKLch color space, defined in `:root` and `.dark`. Includes semantic tokens: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, plus sidebar and chart variants.

### Theme Customization

Company-specific overrides in `src/config/theme.css`, imported last in `styles.css`.

### Font

Inter Variable via `@fontsource-variable/inter`, set as `--font-sans`.

## Feature Implementation Patterns

### Sheet-based CRUD in List Pages

Wire up create/edit modals using Sheet + state:

```tsx
function ListPage() {
  const { items } = Route.useLoaderData()
  const router = useRouter()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)

  const openCreateSheet = () => {
    setEditingItem(null)
    setSheetOpen(true)
  }

  const openEditSheet = (item: Item) => {
    setEditingItem(item)
    setSheetOpen(true)
  }

  return (
    <>
      <Button onClick={openCreateSheet}>
        <Plus className="size-4" />
        Add Item
      </Button>

      <DataTable columns={columns} data={items} />

      <ExampleForm
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        item={editingItem}
        onSuccess={() => router.invalidate()}
      />
    </>
  )
}
```

### Sheet Form with View/Summary Mode

For existing entities, open in read-only summary mode first. Edit button switches to form mode:

```tsx
function EntitySheetForm({ entity, onOpenChange, onSaved, onDelete }) {
  const isEditing = !!entity
  const [viewMode, setViewMode] = useState<'summary' | 'form'>(
    entity ? 'summary' : 'form',
  )

  // Reset viewMode when sheet opens with different entity
  useEffect(() => {
    setViewMode(entity ? 'summary' : 'form')
  }, [entity])

  // Summary mode: read-only card + Edit button
  if (isEditing && viewMode === 'summary') {
    return (
      <>
        <SheetHeader>...</SheetHeader>
        <div className="bg-muted/50 rounded-lg border p-4">
          {/* Read-only fields */}
          <Button variant="ghost" size="sm" onClick={() => setViewMode('form')}>
            <Pencil className="size-3" /> Edit
          </Button>
        </div>
        {/* Related lists (passengers, documents, etc.) */}
        <SheetFooter>
          <Button variant="destructive" onClick={() => onDelete(entity.id)}>Delete</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </SheetFooter>
      </>
    )
  }

  // Form mode
  return (
    <form ...>
      {isEditing && (
        <Button variant="ghost" size="sm" onClick={() => setViewMode('summary')}>
          <ArrowLeft className="size-3" /> Back to summary
        </Button>
      )}
      {/* Form fields */}
      <SheetFooter>
        <Button variant="outline"
          onClick={() => isEditing ? setViewMode('summary') : onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit">{isEditing ? 'Save' : 'Create'}</Button>
      </SheetFooter>
    </form>
  )
}
```

### DataTable with Action Columns

```tsx
const columns = useMemo<ColumnDef<Item>[]>(
  () => [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.getValue('status') === 'active' ? 'default' : 'secondary'}>
          {row.getValue('status') as string}
        </Badge>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const amount = row.getValue('amount') as number | null
        if (amount == null) return '-'
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(amount)
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditSheet(row.original)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.original.id)}>
            <X className="size-4" />
          </Button>
        </div>
      ),
      enableHiding: false,
    },
  ],
  [],
)
```

## Code Quality (REQUIRED)

**After writing or modifying ANY code, you MUST run:**

```bash
pnpm check
```

This runs `prettier --write . && eslint --fix`. If errors remain after auto-fix, you MUST fix them manually before considering the task done. Do NOT leave lint errors or formatting issues.

## Checklist for New Features

1. **Route file**: Create in `src/routes/_authenticated/` following file-based conventions
2. **Loader**: Fetch data with Supabase in the `loader` function
3. **Component**: Use `Route.useLoaderData()` to access data
4. **Forms**: TanStack Form with Zod validation + Supabase mutation + `router.invalidate()`
5. **State**: Router loaders for static data, TanStack Store for dynamic/ephemeral state
6. **UI**: Use existing `src/components/ui/` components, follow shadcn patterns
7. **Icons**: Use `lucide-react`
8. **i18n**: Wrap visible text in `<Trans>` or use `` t` ` ``, then run `pnpm lingui:extract`
9. **Types**: After schema changes run `pnpm supabase:types`
10. **Styling**: Tailwind CSS v4 utility classes, semantic color tokens
11. **Lint/Format**: Run `pnpm check` to auto-fix formatting and lint issues. Fix any remaining errors manually.

### Quality Details

- Form state must sync with props using `useEffect` (useState only sets initial value on mount)
- All buttons inside `<form>` must have `type="button"` except the submit button
- Success triggers `router.invalidate()` or callback to refresh data
- Currency/dates formatted consistently (pt-BR locale)
- Table columns wrapped in `useMemo` for stable references

## Update Your Agent Memory

As you work on the frontend, update your agent memory with discoveries about:
- Project-specific conventions and patterns that deviate from standard TanStack/shadcn practices
- Custom components, hooks, and utilities specific to this project
- Known gotchas with library versions in use (TanStack Router, Lingui, Radix UI)
- Build issues, lint rules, and specific workarounds discovered
- Supabase query patterns and type inference quirks
- User preferences for UI structure, naming, and code organization

Write concise notes so future interactions can leverage accumulated knowledge about the codebase.

# Persistent Agent Memory

You have a persistent Persistent Agent Memory directory at `/Users/gchahm/dev/gchahm/wa_bridge/.claude/agent-memory/fe-agent/`. Its contents persist across conversations.

As you work, consult your memory files to build on previous experience. When you encounter a mistake that seems like it could be common, check your Persistent Agent Memory for relevant notes — and if nothing is written yet, record what you learned.

Guidelines:
- `MEMORY.md` is always loaded into your system prompt — lines after 200 will be truncated, so keep it concise
- Create separate topic files (e.g., `debugging.md`, `patterns.md`) for detailed notes and link to them from MEMORY.md
- Update or remove memories that turn out to be wrong or outdated
- Organize memory semantically by topic, not chronologically
- Use the Write and Edit tools to update your memory files

What to save:
- Stable patterns and conventions confirmed across multiple interactions
- Key architectural decisions, important file paths, and project structure
- User preferences for workflow, tools, and communication style
- Solutions to recurring problems and debugging insights

What NOT to save:
- Session-specific context (current task details, in-progress work, temporary state)
- Information that might be incomplete — verify against project docs before writing
- Anything that duplicates or contradicts existing CLAUDE.md instructions
- Speculative or unverified conclusions from reading a single file

Explicit user requests:
- When the user asks you to remember something across sessions (e.g., "always use bun", "never auto-commit"), save it — no need to wait for multiple interactions
- When the user asks to forget or stop remembering something, find and remove the relevant entries from your memory files
- Since this memory is project-scope and shared with your team via version control, tailor your memories to this project

## Searching past context

When looking for past context:
1. Search topic files in your memory directory:
```
Grep with pattern="<search term>" path="/Users/gchahm/dev/gchahm/wa_bridge/.claude/agent-memory/fe-agent/" glob="*.md"
```
2. Session transcript logs (last resort — large files, slow):
```
Grep with pattern="<search term>" path="/Users/gchahm/.claude/projects/-Users-gchahm-dev-gchahm-wa-bridge/" glob="*.jsonl"
```
Use narrow search terms (error messages, file paths, function names) rather than broad keywords.

## MEMORY.md

Your MEMORY.md is currently empty. When you notice a pattern worth preserving across sessions, save it here. Anything in MEMORY.md will be included in your system prompt next time.
