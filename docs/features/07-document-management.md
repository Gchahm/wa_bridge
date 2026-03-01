# Feature: Document Management

**Priority:** Phase 2 — Booking Management
**Depends on:** Passenger Profiles (#1), Bookings (#5)

## Problem

Customers send passport photos, ID scans, and payment receipts via WhatsApp. These media files are already stored in Supabase Storage (`wa-media` bucket) but there's no way to tag, categorize, or find them later. The agent wastes time scrolling through chat history to find "that passport photo Maria sent last week".

## Requirements

### Data Model

Create `public.documents` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `message_id` | text | FK to messages (nullable — docs can be uploaded directly) |
| `chat_id` | text | FK to messages (nullable, paired with message_id) |
| `passenger_id` | uuid FK → passengers | Optional link |
| `booking_id` | uuid FK → bookings | Optional link |
| `customer_id` | uuid FK → customers | Optional link |
| `document_type` | text NOT NULL | CHECK IN ('passport', 'id_card', 'cpf', 'receipt', 'voucher', 'itinerary', 'other') |
| `label` | text | Free text — e.g. "Maria's passport", "PIX receipt Aug" |
| `storage_path` | text NOT NULL | Path in Supabase Storage (wa-media bucket) |
| `created_at` | timestamp | DEFAULT now() |

- Composite FK `(message_id, chat_id)` → `wa_bridge.messages` with ON DELETE SET NULL
- All entity FKs (passenger, booking, customer) are optional — a document can be linked to any combination

### RLS & Grants

- `wa_bridge_app`: ALL
- `authenticated`: ALL
- `n8n_app`: SELECT

### Views

No proxy views needed — table is in `public` and served directly by PostgREST.

### Frontend

**Tag from chat:**
- In MessageBubble, for image/document media messages, add a "Tag as document" action (icon button or context menu)
- Opens a small form: document_type (select), label (text), link to passenger/booking (optional selects)
- Saves to `documents` table with `message_id`, `chat_id`, and `storage_path` from the message's `media_path`

**Document list on passenger/booking:**
- In PassengerSheet: show documents linked to this passenger
- In BookingSheet: show documents linked to this booking
- Each document: thumbnail (if image), type badge, label, link to view/download

**Standalone document browser** (optional, lower priority):
- Route: `/documents` or within customer detail
- Filter by document_type, customer, passenger
- Grid view with thumbnails

### UX Flow

1. Customer sends a passport photo on WhatsApp
2. Message appears in chat with the image
3. Agent clicks "Tag" on the image → selects "passport", links to passenger "Maria Silva"
4. Later, when creating a booking, agent opens Maria's passenger profile → sees the passport photo tagged and ready
5. Agent can also browse all documents for a customer in one place

## Out of Scope

- OCR/automatic data extraction from passport photos
- Document expiry tracking and reminders
- Direct file upload (outside of WhatsApp) — can be added later
- Document verification/validation

## Technical Notes

- Media files are already in Supabase Storage under `wa-media/{chat_id}/{message_id}.{ext}`
- The `messages` table has `media_path` column with the storage path
- Existing `useMediaUrl` hook handles signed URL generation for display
- The documents table is essentially a metadata/tagging layer on top of existing storage

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_documents.sql` |
| MODIFY | `wa-sales/src/components/MessageBubble.tsx` (add "Tag" action on media messages) |
| CREATE | `wa-sales/src/components/DocumentTagForm.tsx` (small form for tagging) |
| CREATE | `wa-sales/src/components/DocumentList.tsx` (reusable list for passenger/booking views) |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
