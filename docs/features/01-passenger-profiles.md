# Feature: Passenger Profiles

**Priority:** Phase 1 — Sales Pipeline Basics
**Depends on:** Customers (already implemented)

## Problem

Customers book flights for people who may not have WhatsApp — spouses, children, elderly parents. The agent needs to store passenger details (legal name, documents, DOB) to submit bookings to airlines. Currently there's no way to track who's actually flying.

## Requirements

### Data Model

Create `public.passengers` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `full_name` | text NOT NULL | Legal name as on travel document |
| `date_of_birth` | date | Required for airline bookings |
| `gender` | text | CHECK IN ('male', 'female') — as required by airlines |
| `nationality` | text | Country code (ISO 3166-1 alpha-2) |
| `document_type` | text | CHECK IN ('cpf', 'rg', 'passport', 'other') |
| `document_number` | text | |
| `frequent_flyer_airline` | text | Optional |
| `frequent_flyer_number` | text | Optional |
| `notes` | text | |
| `created_at` | timestamp | DEFAULT now() |
| `updated_at` | timestamp | DEFAULT now(), trigger-managed |

Create `public.customer_passengers` junction table (many-to-many):

| Column | Type | Notes |
|--------|------|-------|
| `customer_id` | uuid FK → customers | Part of composite PK |
| `passenger_id` | uuid FK → passengers | Part of composite PK |
| `label` | text | Optional — e.g. "self", "wife", "son" |

- A customer can have many passengers.
- A passenger can belong to multiple customers (e.g., a child shared between divorced parents).
- ON DELETE CASCADE for both FKs.

### RLS & Grants

Follow existing patterns from `20260227000000_add_customers.sql`:
- `wa_bridge_app`: ALL on both tables
- `authenticated`: ALL on both tables
- `n8n_app`: SELECT on both tables

### Views

No proxy views needed — tables are in `public` and served directly by PostgREST.

### Frontend

New route: `/customers/$customerId/passengers` or inline within the customer edit sheet.

- List passengers linked to a customer
- Add/edit passenger form (Sheet component, same pattern as CustomerSheet)
- "Add self as passenger" button that pre-fills from customer data (name → full_name, phone → notes)
- Link existing passenger to customer (search by name/document)
- Fields: full_name (required), date_of_birth, gender, nationality, document_type, document_number, frequent_flyer_airline, frequent_flyer_number, notes

### UX Flow

1. Agent opens customer → sees "Passengers" section
2. Clicks "Add Passenger" → form opens
3. Fills legal name, DOB, document info
4. Saves → passenger linked to customer
5. Same passenger can later be linked to another customer

## Out of Scope

- Passenger photo/document image upload (see Feature #7 Document Management)
- Passport expiry validation
- Automatic passenger creation from WhatsApp messages

## Technical Notes

- Use the `wa_bridge.set_updated_at()` trigger function (already exists) for the updated_at column
- Passenger data is PII — keep RLS tight (currently single-user, but plan for multi-agent)
- The junction table pattern allows a passenger like "Maria Silva" to appear under both "João Silva" (husband) and "Ana Costa" (mother) customers

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_passengers.sql` |
| MODIFY | `wa-sales/src/routes/_authenticated/customers/-components/CustomerSheet.tsx` (add passengers section) |
| CREATE | `wa-sales/src/routes/_authenticated/customers/-components/PassengerSheet.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/customers/-components/PassengerList.tsx` |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
