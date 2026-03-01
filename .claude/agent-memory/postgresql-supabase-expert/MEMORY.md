# PostgreSQL / Supabase Expert — Persistent Memory

## Project: wa_bridge

Monorepo at `/Users/gchahm/dev/gchahm/wa_bridge`.

### Schema layout (as of 2026-03-01 migration)

- **`wa_bridge`** — WA bridge tables only: `chats`, `contacts`, `messages`, `outgoing_messages`, `reactions`
- **`public`** — App/sales tables (real tables, not views): `customers`, `customer_relationships`, `customer_passengers`, `passengers`, `flight_requests`, `flight_request_passengers`, `quote_options`, `bookings`, `booking_segments`, `booking_passengers`
- **`public` views** — WA pass-through views (`chats`, `contacts`, `messages`, `outgoing_messages`, `reactions`, `chats_with_preview`) + enriched views (`customers_with_contact`, `unlinked_contacts`, `flight_requests_summary`, `bookings_summary`)
- **`wa_meow`** — whatsmeow internal state
- **`n8n`** — n8n workflow tables

### Cross-schema FKs that exist by design

- `public.customers.phone_number → wa_bridge.contacts.phone_number`
- `public.flight_requests.chat_id → wa_bridge.chats.chat_id`

### Key roles

- `wa_bridge_app` — owns wa_bridge schema; full DML on both wa_bridge and public app tables
- `authenticated` — full CRUD on public app tables; SELECT (+ INSERT on outgoing_messages) on wa_bridge tables via views
- `n8n_app` — SELECT only on all app and WA tables

### Trigger functions

- `wa_bridge.set_updated_at()` — reusable updated_at trigger, called by triggers on `public.customers`, `public.passengers`, `public.flight_requests`, `public.bookings`. Trigger functions can live in a different schema than the table — this is fine.

## Critical PostgreSQL Facts

### ALTER TABLE SET SCHEMA behaviour

`ALTER TABLE schema_a.t SET SCHEMA schema_b` carries these objects along automatically:
- Indexes (including PK indexes created via `ADD CONSTRAINT USING INDEX`)
- CHECK and FK constraints
- RLS policies (with their role bindings intact — no recreation needed)
- Triggers (trigger function body stays in its original schema, only the trigger binding moves)

What does NOT transfer automatically:
- **Table-level GRANT privileges** (stored in `pg_class.relacl`) — must be re-issued explicitly on the new schema.table after the move.

### Drop order before SET SCHEMA

`ALTER TABLE SET SCHEMA` fails if any view in another schema depends on the table. Drop all dependent views before the move, then recreate them pointing to the new location.

### Enriched views after schema moves

After moving tables, recreate views explicitly with the new `public.*` references. Use `CREATE OR REPLACE VIEW` when column list hasn't changed; use `DROP VIEW … ; CREATE VIEW` when column list or order changes.
