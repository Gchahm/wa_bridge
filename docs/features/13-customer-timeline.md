# Feature: Customer Timeline

**Priority:** Phase 4 — Scale & Polish
**Depends on:** Customers (implemented), Flight Requests (#2), Bookings (#5), Payments (#6), Documents (#7)

## Problem

When an agent opens a customer profile, they only see static form fields. There's no history — no sense of when this customer last reached out, what was booked, what was paid. The agent has to jump between chat, requests, bookings, and payments to piece together the full picture. A timeline consolidates everything in one chronological view.

## Requirements

### Data

No new tables needed. The timeline is a read-only aggregation from existing tables.

Create a Postgres function `public.customer_timeline(p_customer_id uuid, p_limit int, p_offset int)` that returns a UNION ALL of:

| Source | Event Type | Title | Timestamp |
|--------|-----------|-------|-----------|
| `messages` (via customer → contact → chat) | `message_sent` / `message_received` | Message preview | message.timestamp |
| `flight_requests` | `request_created` / `request_status_changed` | "Request: GRU → MIA" | created_at / updated_at |
| `bookings` | `booking_created` / `booking_status_changed` | "Booking: PNR ABC123" | created_at / updated_at |
| `payments` | `payment_recorded` / `payment_confirmed` | "Payment: R$ 2,500" | created_at / paid_at |
| `documents` | `document_tagged` | "Document: passport" | created_at |
| `chat_notes` | `note_added` | Note content preview | created_at |

Return type:
```sql
(event_type text, title text, subtitle text, reference_id text, reference_type text, occurred_at timestamp)
```

Ordered by `occurred_at DESC`, paginated with limit/offset.

### Frontend

**Customer detail page** (expand existing customer section or new route):

Add a "Timeline" tab/section to the customer view:
- Vertical timeline layout (newest at top)
- Each event: icon (by type), title, timestamp, subtitle
- Click navigates to the relevant item:
  - Message → chat
  - Request → request detail
  - Booking → booking detail
  - Payment → booking payments section
- Infinite scroll / load more pagination

**Visual design:**
- Left border line connecting events
- Icons per type: `MessageSquare` (message), `Plane` (request), `TicketCheck` (booking), `CreditCard` (payment), `FileText` (document), `StickyNote` (note)
- Date separators between days

### UX Flow

1. Agent opens customer "Maria Silva"
2. Sees timeline: today she sent a message, yesterday a payment was confirmed, last week a booking was created
3. Agent clicks the booking event → goes to the booking detail
4. Agent scrolls down → loads older events

## Out of Scope

- Real-time timeline updates (reload on navigation is fine)
- Timeline for entities other than customers (e.g., per-booking timeline)
- Activity feed across all customers (dashboard feature)
- Audit log (who changed what)

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_customer_timeline_function.sql` |
| CREATE | `wa-sales/src/routes/_authenticated/customers/-components/CustomerTimeline.tsx` |
| MODIFY | `wa-sales/src/routes/_authenticated/customers/-components/CustomerSheet.tsx` (add timeline section) |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
