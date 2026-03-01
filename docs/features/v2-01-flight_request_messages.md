# Feature: Flight Request Message Linking (v2)

**Priority:** Phase 2
**Depends on:** Flight Requests (v1, implemented), Chat-to-Request Linking (#3, partially implemented)
**Follows up on:** `03-chat-to-request-linking.md`

## What was already implemented (v1)

- Plane button in chat header opens `RequestsForCustomerSheet`
- "New Request" creates a flight request pre-filled with `customer_id` and `chat_id`
- `/requests` dashboard with status tabs and DataTable
- Full CRUD for requests, passengers, and quote options

## What remains

### 1. `flight_request_messages` junction table

Create `public.flight_request_messages` to link specific messages to a request, giving the agent a way to bookmark the conversation context that prompted the request.

| Column | Type | Notes |
|--------|------|-------|
| `flight_request_id` | uuid FK → flight_requests | ON DELETE CASCADE |
| `message_id` | text | Part of composite PK |
| `chat_id` | text | Part of composite PK |

- Composite PK `(flight_request_id, message_id, chat_id)`
- Composite FK `(message_id, chat_id)` → `wa_bridge.messages(message_id, chat_id)`
- ON DELETE CASCADE for both FKs
- RLS + grants: same pattern as other app tables (`wa_bridge_app` ALL, `authenticated` ALL, `n8n_app` SELECT)
- No proxy view needed — table is in `public` and served directly by PostgREST

### 2. Message selection mode in chat

When creating or editing a request from the chat, the agent should be able to select specific messages to attach.

**UX:**
1. Agent opens `RequestsForCustomerSheet` via the Plane button
2. Clicks "New Request" or edits an existing request
3. A "Link Messages" button in the RequestSheet enables selection mode in the chat behind the sheet
4. Chat messages show checkboxes; agent ticks relevant messages
5. Agent confirms selection; selected `(message_id, chat_id)` pairs are inserted into `flight_request_messages`
6. Selection mode deactivates

**Implementation considerations:**
- Selection state lives in the chat view (e.g. a `selectingForRequestId` state)
- The RequestSheet needs a callback/ref to communicate with MessageView
- Consider using a TanStack Store or context to share selection state between the sheet and the chat

### 3. Source Messages section in RequestSheet

In edit mode, show a "Source Messages" section (after Passengers and Quote Options) that displays the linked messages.

**UX:**
- Read-only mini chat view showing linked messages in chronological order
- Each message shows sender, timestamp, and content (text only is fine for v1)
- "Unlink" button (X) per message to remove from `flight_request_messages`
- "Link Messages" button to enter selection mode (see above)
- Clicking a message navigates to the full chat at that message's position (stretch goal)

**Data fetching:**
```
supabase
  .from('flight_request_messages')
  .select('message_id, chat_id')
  .eq('flight_request_id', requestId)
```
Then fetch the actual messages from `messages` view using the IDs.

### 4. Chat link from `/requests` dashboard

On the `/requests` DataTable, if a request has a `chat_id`, show a clickable link/icon that navigates to `/chat` with that chat selected.

## Out of Scope

- AI-powered extraction of dates/destinations from selected messages (see Feature #11)
- Auto-detecting when a customer is asking for a flight
- Media content in the mini chat view (text-only is sufficient)

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_flight_request_messages.sql` |
| CREATE | `wa-sales/src/routes/_authenticated/requests/-components/LinkedMessagesList.tsx` |
| MODIFY | `wa-sales/src/routes/_authenticated/requests/-components/RequestSheet.tsx` (add Source Messages section) |
| MODIFY | `wa-sales/src/components/MessageView.tsx` (add message selection mode) |
| MODIFY | `wa-sales/src/routes/_authenticated/requests/index.tsx` (add chat link column) |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
