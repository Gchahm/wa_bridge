# Feature: Search Across Everything

**Priority:** Phase 4 — Scale & Polish
**Depends on:** Customers (implemented), Passengers (#1), Bookings (#5), Flight Requests (#2)

## Problem

The agent needs to quickly find information scattered across the system: "What was the PNR for Maria's Miami trip?", "Which customer has passport number X?", "Find the message where João sent his dates". Currently each section has its own local search, but there's no way to search across everything at once.

## Requirements

### Full-Text Search Setup

Add Postgres full-text search using `tsvector` columns and GIN indexes:

**Messages** (WA table — stays in `wa_bridge`):
```sql
ALTER TABLE wa_bridge.messages ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(content, ''))) STORED;
CREATE INDEX idx_messages_search ON wa_bridge.messages USING GIN (search_vector);
```

**Customers:**
```sql
ALTER TABLE public.customers ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese',
    coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(notes, '')
  )) STORED;
CREATE INDEX idx_customers_search ON public.customers USING GIN (search_vector);
```

**Passengers:**
```sql
ALTER TABLE public.passengers ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese',
    coalesce(full_name, '') || ' ' || coalesce(document_number, '') || ' ' || coalesce(notes, '')
  )) STORED;
CREATE INDEX idx_passengers_search ON public.passengers USING GIN (search_vector);
```

**Bookings:**
```sql
ALTER TABLE public.bookings ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese',
    coalesce(pnr, '') || ' ' || coalesce(booking_source, '') || ' ' || coalesce(notes, '')
  )) STORED;
CREATE INDEX idx_bookings_search ON public.bookings USING GIN (search_vector);
```

### Search API

Create a Postgres function for unified search:

```sql
CREATE FUNCTION public.global_search(query text, result_limit int DEFAULT 20)
RETURNS TABLE (
  result_type text,
  result_id text,
  title text,
  subtitle text,
  rank real
)
```

This function runs `plainto_tsquery('portuguese', query)` against all four search vectors, UNION ALLs the results, and returns them sorted by rank.

### Frontend

**Global search bar:**
- Add a search input in the app header/toolbar (always visible)
- Keyboard shortcut: `Cmd+K` or `/` to focus
- Debounced input (300ms) calls the search function via Supabase RPC

**Results display:**
- Grouped by type: Customers, Passengers, Messages, Bookings
- Each result shows: title, subtitle (context snippet), type badge
- Click navigates to the relevant page:
  - Customer → `/customers` with edit sheet open
  - Passenger → customer's passenger list
  - Message → `/chat?chatId=X` scrolled to the message
  - Booking → `/bookings` with edit sheet open

### UX Flow

1. Agent presses `Cmd+K`
2. Types "Maria passport"
3. Results show: Maria Silva (customer), Maria's passport document, messages containing "passport" in Maria's chat
4. Agent clicks the passenger result → opens Maria's passenger profile with passport details

## Out of Scope

- Fuzzy matching / typo tolerance (Postgres FTS handles stemming for Portuguese)
- Search suggestions / autocomplete
- Search history
- Federated search across external systems

## Technical Notes

- Use `portuguese` text search config for proper stemming of Brazilian Portuguese
- Generated columns with `tsvector` auto-update when the row changes — no triggers needed
- GIN indexes make search fast even with large message volumes
- The `global_search` function is called via Supabase `.rpc('global_search', { query, result_limit })`

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_full_text_search.sql` |
| CREATE | `wa-sales/src/components/GlobalSearch.tsx` (search bar + results popover) |
| MODIFY | `wa-sales/src/routes/__root.tsx` or layout (add search bar to header) |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
