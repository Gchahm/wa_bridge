# Feature: Flight Requests (Quotes)

**Priority:** Phase 1 — Sales Pipeline Basics
**Depends on:** Customers (implemented), Passenger Profiles (#1)

## Problem

When a customer messages "I need 2 tickets SAO to MIA in July", the agent has no structured way to track that request. They rely on memory or notes. As volume grows, requests get lost and follow-ups are missed.

## Requirements

### Data Model

Create `public.flight_requests` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `customer_id` | uuid FK → customers NOT NULL | Who made the request |
| `chat_id` | text FK → wa_bridge.chats | Which WhatsApp chat the request came from |
| `status` | text NOT NULL DEFAULT 'new' | CHECK IN ('new', 'quoted', 'accepted', 'booked', 'completed', 'cancelled') |
| `origin` | text | Airport/city code or free text |
| `destination` | text | Airport/city code or free text |
| `departure_date_start` | date | Earliest acceptable departure |
| `departure_date_end` | date | Latest acceptable departure (flexible dates) |
| `return_date_start` | date | Earliest return (NULL = one-way) |
| `return_date_end` | date | Latest return |
| `adults` | integer DEFAULT 1 | |
| `children` | integer DEFAULT 0 | |
| `infants` | integer DEFAULT 0 | |
| `cabin_class` | text DEFAULT 'economy' | CHECK IN ('economy', 'premium_economy', 'business', 'first') |
| `budget_min` | numeric(10,2) | Optional |
| `budget_max` | numeric(10,2) | Optional |
| `budget_currency` | text DEFAULT 'BRL' | |
| `notes` | text | Free-text agent notes |
| `created_at` | timestamp | DEFAULT now() |
| `updated_at` | timestamp | DEFAULT now(), trigger-managed |

Create `public.flight_request_passengers` junction table:

| Column | Type | Notes |
|--------|------|-------|
| `flight_request_id` | uuid FK → flight_requests | Part of composite PK |
| `passenger_id` | uuid FK → passengers | Part of composite PK |

Create `public.quote_options` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `flight_request_id` | uuid FK → flight_requests NOT NULL | |
| `description` | text NOT NULL | Free-text itinerary summary (e.g., "LATAM LA8040 GRU→MIA 15Jul 10:30") |
| `price` | numeric(10,2) | Total price |
| `currency` | text DEFAULT 'BRL' | |
| `is_selected` | boolean DEFAULT false | The option the customer chose |
| `notes` | text | |
| `created_at` | timestamp | DEFAULT now() |

### RLS & Grants

Same pattern as customers:
- `wa_bridge_app`: ALL
- `authenticated`: ALL
- `n8n_app`: SELECT

### Views

No proxy views needed — tables are in `public` and served directly by PostgREST.

Enriched view still required:
- `public.flight_requests_summary` — joins customer name, passenger count, and selected quote price/description

### Frontend

New route: `/requests`

**List page** (`/requests`):
- DataTable with columns: customer name, route (origin → destination), dates, pax count, status (badge), created date
- Filter by status (tab bar or dropdown)
- Sort by date, status
- Row click → edit sheet

**Request Sheet** (create/edit):
- Customer select (from customers list)
- Origin/destination text inputs
- Date range pickers for departure and return
- Passenger count (adults, children, infants)
- Cabin class select
- Budget range (optional)
- Notes textarea
- Status select (only on edit)

**Quote Options** (inside request detail):
- List of quote options for the request
- Add option: description, price
- Mark one as selected
- Simple inline list, not a separate route

### Sidebar

Add "Requests" nav item between "Customers" and future items. Icon: `Plane` from lucide-react.

### UX Flow

1. Customer messages about a trip on WhatsApp
2. Agent opens `/requests`, clicks "New Request"
3. Selects the customer, fills route/dates/pax
4. Saves as status "new"
5. Agent researches options, adds quote options with prices
6. Changes status to "quoted"
7. Customer picks an option → agent marks it selected, status "accepted"
8. Agent books → status "booked"
9. Trip completes → status "completed"

## Out of Scope

- Automated flight search (API integration with Amadeus/Sabre)
- Direct creation from chat messages (see Feature #3)
- Payment tracking (see Feature #6)

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_flight_requests.sql` |
| MODIFY | `wa-sales/src/components/AppSidebar.tsx` (add Requests nav) |
| CREATE | `wa-sales/src/routes/_authenticated/requests.tsx` (layout + loader) |
| CREATE | `wa-sales/src/routes/_authenticated/requests/index.tsx` (list page) |
| CREATE | `wa-sales/src/routes/_authenticated/requests/-components/RequestSheet.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/requests/-components/QuoteOptions.tsx` |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
