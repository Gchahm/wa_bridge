# Feature: Payment Tracking

**Priority:** Phase 2 — Booking Management
**Depends on:** Bookings & Itineraries (#5)

## Problem

The agent needs to know which bookings are paid, which are pending, and how much commission they've earned. Currently there's no financial tracking — the agent relies on spreadsheets or memory.

## Requirements

### Data Model

Create `public.payments` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `booking_id` | uuid FK → bookings NOT NULL | ON DELETE CASCADE |
| `amount` | numeric(10,2) NOT NULL | |
| `currency` | text DEFAULT 'BRL' | |
| `payment_method` | text | CHECK IN ('pix', 'credit_card', 'debit_card', 'bank_transfer', 'cash', 'other') |
| `installments` | integer DEFAULT 1 | Number of installments (1 = full payment) |
| `status` | text NOT NULL DEFAULT 'pending' | CHECK IN ('pending', 'confirmed', 'refunded') |
| `due_date` | date | When payment is expected |
| `paid_at` | timestamp | When payment was actually received |
| `reference` | text | Transaction ID, receipt number, etc. |
| `notes` | text | |
| `created_at` | timestamp | DEFAULT now() |
| `updated_at` | timestamp | DEFAULT now(), trigger-managed |

Create `public.commissions` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `booking_id` | uuid FK → bookings NOT NULL | ON DELETE CASCADE |
| `amount` | numeric(10,2) NOT NULL | Commission amount |
| `currency` | text DEFAULT 'BRL' | |
| `status` | text NOT NULL DEFAULT 'pending' | CHECK IN ('pending', 'received') |
| `received_at` | timestamp | |
| `notes` | text | |
| `created_at` | timestamp | DEFAULT now() |

### RLS & Grants

- `wa_bridge_app`: ALL
- `authenticated`: ALL
- `n8n_app`: SELECT

### Views

No proxy views needed — tables are in `public` and served directly by PostgREST.

Enriched view still required:
- `public.booking_payment_summary` — per-booking: total_paid, total_pending, total_refunded, commission_amount

### Frontend

**Within Booking Sheet** (not a separate route):

Payments section:
- List of payments for the booking
- Add payment: amount, method, installments, due_date, status, reference
- Mark as confirmed/refunded
- Show total paid vs. booking price (progress indicator)

Commission section:
- Single commission record per booking (simple)
- Amount, status (pending/received)

**Dashboard integration** (Feature #4):
- "Pending Payments" card showing payments with due_date approaching and status = 'pending'

### UX Flow

1. Agent creates booking with total_price = R$ 5,000
2. Customer pays R$ 2,500 via PIX → agent adds payment (confirmed)
3. Customer will pay remaining R$ 2,500 next month → agent adds payment (pending, due_date)
4. Booking detail shows "R$ 2,500 / R$ 5,000 paid"
5. Agent records commission of R$ 500 (pending)

## Out of Scope

- Payment gateway integration (Stripe, PagSeguro)
- Invoice/receipt PDF generation
- Tax calculation
- Full accounting/ledger system

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_payments.sql` |
| MODIFY | `wa-sales/src/routes/_authenticated/bookings/-components/BookingSheet.tsx` (add payments section) |
| CREATE | `wa-sales/src/routes/_authenticated/bookings/-components/PaymentList.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/bookings/-components/CommissionSection.tsx` |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
