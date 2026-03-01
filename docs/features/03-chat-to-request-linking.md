# Feature: Chat-to-Request Linking

**Priority:** Phase 1 — Sales Pipeline Basics
**Depends on:** Flight Requests (#2)

## Problem

The agent reads a WhatsApp conversation, mentally extracts the trip details, then switches to the Requests page to type them in again. This is slow and error-prone. The agent should be able to create a request directly from the chat, with the relevant messages linked for future reference.

## Requirements

### Data Model

Create `public.flight_request_messages` junction table:

| Column | Type | Notes |
|--------|------|-------|
| `flight_request_id` | uuid FK → flight_requests | Part of composite PK |
| `message_id` | text | Part of composite PK |
| `chat_id` | text | Part of composite PK |

- Composite FK `(message_id, chat_id)` → `wa_bridge.messages`
- ON DELETE CASCADE for both FKs

### Frontend Changes

**MessageView modifications:**
- Add a "Create Request" button in the chat header (or a floating action button)
- When clicked, opens the RequestSheet pre-filled with:
  - `customer_id` — auto-resolved from the chat's linked contact → customer
  - `chat_id` — current chat
- After save, the request is linked to the chat

**Optional message selection (v1 can skip):**
- Checkbox mode: agent selects specific messages
- Selected message IDs stored in `flight_request_messages`
- These messages appear as "context" in the request detail view

**Request detail — linked messages:**
- Show a "Source Messages" section in the request sheet
- Display the linked messages as a mini chat view (read-only)
- Link back to the full chat

### UX Flow

1. Agent is reading chat with customer
2. Customer says "I want to go to Miami on July 15"
3. Agent clicks "Create Request" in the chat header
4. Request form opens, pre-filled with customer and chat
5. Agent fills remaining details, saves
6. Request appears in `/requests` with link back to the chat

## Out of Scope

- AI-powered extraction of dates/destinations from messages (see Feature #11)
- Auto-detecting when a customer is asking for a flight

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_flight_request_messages.sql` |
| MODIFY | `wa-sales/src/components/MessageView.tsx` (add "Create Request" button) |
| MODIFY | `wa-sales/src/routes/_authenticated/requests/-components/RequestSheet.tsx` (accept pre-fill props) |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
