# Claude Code Guidelines

## Monorepo Overview

This is a WhatsApp bridge monorepo with three main components:

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `whatsapp-api/` | Go (whatsmeow) | WhatsApp bridge service — syncs messages, contacts, and chats from WhatsApp into the database via whatsmeow. Listens for outbound messages via Postgres LISTEN/NOTIFY. |
| `wa-sales/` | React + TanStack + Vite | Frontend app — chat history viewer (more features planned). Uses Supabase client for data + realtime. |
| `supabase/` | Supabase (Postgres) | Shared database — migrations, schemas, seeds. Hosts all persistent state. |
| `docker-compose.yml` | Docker | Runs the Go bridge + n8n (AI automation workflows). Both use `network_mode: host`. |

### Database Schemas

- **`wa_bridge`** — Core tables: `chats`, `contacts`, `messages`, `outgoing_messages`. Owned by `wa_bridge_app` role. RLS-enabled with policies for both `wa_bridge_app` (full access) and `authenticated` (read + insert outgoing).
- **`wa_meow`** — whatsmeow internal state (device keys, sessions). Used directly by the Go service.
- **`n8n`** — n8n's own tables, managed by `n8n_app` role. Has read access to `wa_bridge` tables.
- **`public`** — Views (`chats`, `contacts`, `messages`, `outgoing_messages`, `chats_with_preview`) that expose `wa_bridge` tables via `security_invoker = on` for PostgREST/Supabase client access.

### Key Integrations

- **Supabase Realtime** — Broadcast triggers on `wa_bridge.chats` and `wa_bridge.messages` push live updates to the frontend.
- **Supabase Storage** — `wa-media` bucket stores message media (images, audio, video, documents). Private, requires auth.
- **LISTEN/NOTIFY** — `new_outgoing_message` channel triggers the Go bridge to send queued messages.

### Communication Architecture

**The Go service (`whatsapp-api/`) has NO public-facing API.** Its HTTP endpoints (QR code, health) are only reachable locally by n8n and Docker-internal services.

**Frontend ↔ Go service communication is always via the database:**
- **Frontend → Go service**: Frontend inserts rows into a table (e.g., `outgoing_messages`). A Postgres trigger fires `pg_notify()` on a LISTEN/NOTIFY channel. The Go service listens on that channel, claims the row (status: pending → processing), executes the action, and updates the row with the result (sent/failed + error details).
- **Go service → Frontend**: The Go service writes to `wa_bridge` tables (messages, chats, contacts). Supabase Realtime broadcast triggers push changes to the frontend.

This pattern ensures all communication goes through Postgres, keeping the Go service off the public network. New features requiring frontend-to-bridge interaction (e.g., requesting chat history) should follow this same table + LISTEN/NOTIFY pattern.

## Specialized Agents (REQUIRED)

**You MUST use these agents when their domain applies.** Do not attempt to do the work directly - always delegate to the appropriate agent:

- **fe-agent** — **ALL work inside `wa-sales/`** goes through this agent. This includes ANY file reading, editing, creating, deleting, or refactoring under the `wa-sales/` directory. Whether it's a simple one-line change, removing buttons, adding features, fixing bugs, or restructuring code — if the file is in `wa-sales/`, delegate to fe-agent. No exceptions.
- **go-app-architect** — Go service changes (`whatsapp-api/`): handlers, store, config, messaging
- **postgresql-supabase-expert** — Database migrations, schema design, RLS policies
- **supabase-data-layer** — Extracting business logic (calculations, transformations)
### Slash Commands

- `/shadcn` — Guide for creating new shadcn/ui components (CVA variants, Radix primitives, accessibility)
- `/i18n` — Guide for Lingui translation patterns (`<Trans>`, `t` template, extraction workflow)

## After Database Schema Changes

When modifying database schema (migrations), always follow this workflow:

1. **Apply the migration** to the local database
2. **Regenerate TypeScript types** immediately:
   ```bash
   cd wa-sales && pnpm supabase:types
   ```
3. **Update all affected queries** — TypeScript will flag mismatches after regenerating types
4. **Check related files** — Search for usages of modified tables:
   ```bash
   grep -r "from('table_name')" wa-sales/src/
   ```
5. **Check Go service** — If the change affects tables the bridge reads/writes:
   ```bash
   grep -r "table_name" whatsapp-api/internal/
   ```

## Frontend (`wa-sales/`)

### Project Structure

- **Routes**: `src/routes/_authenticated/chat/` — File-based routing with TanStack Router
- **UI Components**: `src/components/ui/` — Reusable shadcn-style components
- **Database Types**: `src/lib/database.types.ts` — Auto-generated from Supabase schema
- **Supabase Client**: `src/lib/supabase.ts`

### Key Patterns

#### Route Files
- Use `createFileRoute()` with `loader` for data fetching
- Use `Route.useLoaderData()` to access loader data
- Use `getRouteApi()` to access parent route loader data from child routes
- Use `router.invalidate()` after mutations to refresh data

#### State Management (TanStack Router + TanStack Store)

**Use TanStack Router loaders for:**
- Server data that should be fetched on route entry
- Static/reference data (lookups, lists)
- Data that benefits from route-based caching

**Use TanStack Store for:**
- Ephemeral UI state that shouldn't be in the URL
- State shared across child routes that changes frequently
- Optimistic updates for better UX
- Derived/computed values

#### Forms (TanStack Form)
- Use `useAppForm` from `@/hooks/form` with Zod schema validation
- Use Sheet component for create/edit modals
- Reusable field components via `createFormHook` context pattern
- Field components in `src/components/form-components.tsx`

#### Icons
Use `lucide-react` for icons:
```tsx
import { Pencil, Lock, RefreshCw } from 'lucide-react'
<Pencil className="size-4" />
```

### Code Style & Quality (REQUIRED)

**After writing or modifying any frontend code, you MUST run:**
```bash
cd wa-sales && pnpm check && cd /Users/gchahm/dev/gchahm/wa_bridge
```
**IMPORTANT: If you `cd` into a subdirectory (e.g. `wa-sales/`), always `cd` back to the repo root (`/Users/gchahm/dev/gchahm/wa_bridge`) when done.** The shell working directory persists between commands and affects the `@` file picker in the chat interface.
This runs `prettier --write . && eslint --fix` to auto-format and fix lint issues.

**Prettier config**: no semicolons, single quotes, trailing commas everywhere.

**If `pnpm check` reports remaining errors, fix them manually before considering the task done.**

### Frontend Scripts (run from `wa-sales/`)

```bash
pnpm dev              # Start dev server (port 3000)
pnpm check            # Format + lint fix (ALWAYS run after code changes)
pnpm lint             # ESLint check only
pnpm format           # Prettier check only
pnpm supabase:types   # Regenerate database types
pnpm lingui:extract   # Extract translation strings
pnpm lingui:compile   # Compile translations
```

## Go Service (`whatsapp-api/`)

### Structure

```
internal/
  config/      # Environment-based configuration
  media/       # Media download and upload (Supabase Storage)
  messaging/   # WhatsApp message event handlers → database writes
  outbox/      # LISTEN/NOTIFY consumer → sends queued outgoing messages
  server/      # HTTP server (QR code endpoint, health checks)
  store/       # Database access layer (Postgres via lib/pq)
  waclient/    # whatsmeow client setup, QR login flow
  webhook/     # Forwards events to external webhook URLs
```

### Environment Variables (Go service)
- `DATABASE_URL` — Postgres connection string (connects as `wa_bridge_app`)
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — For Supabase Storage uploads
- `MESSAGE_WEBHOOK_URL` / `VOICE_WEBHOOK_URL` / `IMAGE_WEBHOOK_URL` — External webhook endpoints
- `LISTEN_ADDR` — HTTP listen address
