# Feature: Bookings & Itineraries

**Priority:** Phase 2 — Booking Management
**Depends on:** Flight Requests (#2), Passenger Profiles (#1)

## Problem

After a customer accepts a quote and the agent books the flight, there's nowhere to record the actual booking details — PNR, flight numbers, times, airline. The agent needs to track confirmed bookings to answer customer questions and manage upcoming trips.

## Requirements

### Data Model

Create `public.bookings` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `flight_request_id` | uuid FK → flight_requests | Optional — link to originating request |
| `customer_id` | uuid FK → customers NOT NULL | Who the booking is for |
| `pnr` | text | Airline PNR / record locator |
| `status` | text NOT NULL DEFAULT 'confirmed' | CHECK IN ('confirmed', 'ticketed', 'completed', 'cancelled', 'no_show') |
| `total_price` | numeric(10,2) | |
| `currency` | text DEFAULT 'BRL' | |
| `booking_source` | text | Free text — e.g. "LATAM direct", "Decolar", "Consolidator X" |
| `notes` | text | |
| `created_at` | timestamp | DEFAULT now() |
| `updated_at` | timestamp | DEFAULT now(), trigger-managed |

Create `public.booking_segments` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `booking_id` | uuid FK → bookings NOT NULL | ON DELETE CASCADE |
| `segment_order` | integer NOT NULL | 1, 2, 3... for multi-leg trips |
| `airline` | text | Airline code (e.g., "LA", "AA") |
| `flight_number` | text | e.g. "LA8040" |
| `origin` | text NOT NULL | Airport code |
| `destination` | text NOT NULL | Airport code |
| `departure_at` | timestamp | |
| `arrival_at` | timestamp | |
| `cabin_class` | text | |

Create `public.booking_passengers` junction table:

| Column | Type | Notes |
|--------|------|-------|
| `booking_id` | uuid FK → bookings | Part of composite PK |
| `passenger_id` | uuid FK → passengers | Part of composite PK |
| `ticket_number` | text | Optional e-ticket number |

### RLS & Grants

Same pattern as other tables:
- `wa_bridge_app`: ALL
- `authenticated`: ALL
- `n8n_app`: SELECT

### Views

No proxy views needed — tables are in `public` and served directly by PostgREST.

Enriched view still required:
- `public.bookings_summary` — joins customer name, route (first origin → last destination), departure date, passenger count, and status

### Frontend

New route: `/bookings`

**List page:**
- DataTable: customer, route, departure date, PNR, status (badge), price
- Filter by status
- Row click → edit sheet

**Booking Sheet** (create/edit):
- Customer select
- Link to flight request (optional)
- PNR, booking source
- Status select
- Price + currency
- Notes

**Segments section** (inside booking detail):
- Ordered list of flight segments
- Add/edit/remove segments inline
- Fields: airline, flight number, origin, destination, departure, arrival, cabin

**Passengers section** (inside booking detail):
- Select passengers from customer's passenger list
- Optional ticket number per passenger

### Sidebar

Add "Bookings" nav item. Icon: `TicketCheck` from lucide-react.

### Status Workflow

```
confirmed → ticketed → completed
    ↓                     ↓
 cancelled            no_show
```

When a booking is created from a flight request, the request status should auto-update to "booked".

## Out of Scope

- GDS/airline API integration for automatic PNR import
- Seat selection
- Baggage tracking
- E-ticket PDF generation

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_bookings.sql` |
| MODIFY | `wa-sales/src/components/AppSidebar.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/bookings.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/bookings/index.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/bookings/-components/BookingSheet.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/bookings/-components/SegmentList.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/bookings/-components/BookingPassengers.tsx` |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
