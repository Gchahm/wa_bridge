# Feature: Automated Notifications (n8n)

**Priority:** Phase 3 — Automation & Intelligence
**Depends on:** Bookings (#5), Payment Tracking (#6), Message Templates (#8)

## Problem

The agent manually sends reminders, confirmations, and follow-ups. These are predictable, repetitive tasks that should happen automatically. The n8n infrastructure is already deployed but only has a minimal audio webhook workflow.

## Requirements

### Notification Triggers

Build n8n workflows that listen for database changes and send WhatsApp messages via the `outgoing_messages` queue.

**Booking confirmation** (trigger: booking status → 'confirmed'):
- Send a summary to the customer's WhatsApp
- Include: route, dates, PNR, passengers
- Use a message template with variable substitution

**Payment reminder** (trigger: scheduled, daily):
- Query payments WHERE status = 'pending' AND due_date <= today + 3 days
- Send a reminder to the customer
- "Hi {{customer_name}}, just a reminder that the payment of {{amount}} for your flight to {{destination}} is due on {{due_date}}."

**Flight reminder** (trigger: scheduled, daily):
- Query booking_segments WHERE departure_at BETWEEN now() AND now() + 24h
- Send to customer: "Your flight {{flight_number}} to {{destination}} departs tomorrow at {{time}}. Have a great trip!"

**Post-trip follow-up** (trigger: scheduled, daily):
- Query bookings WHERE status = 'completed' AND updated_at BETWEEN now() - 2 days AND now() - 1 day
- Send: "Hi {{customer_name}}, how was your trip to {{destination}}? Let me know if you need anything else!"

### Data Model

Create `public.notification_log` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `notification_type` | text NOT NULL | e.g. 'booking_confirmation', 'payment_reminder', 'flight_reminder', 'follow_up' |
| `customer_id` | uuid FK → customers | |
| `booking_id` | uuid FK → bookings | Nullable |
| `outgoing_message_id` | bigint FK → wa_bridge.outgoing_messages | The actual message sent |
| `sent_at` | timestamp DEFAULT now() | |

This prevents duplicate notifications (check log before sending).

### n8n Workflow Design

Each workflow follows the same pattern:

1. **Trigger**: Postgres trigger (via webhook from Go service) or scheduled (cron)
2. **Query**: Fetch relevant data from public/wa_bridge tables (n8n_app has SELECT access)
3. **Check**: Query notification_log to avoid duplicates
4. **Compose**: Build message from template + data
5. **Send**: INSERT into `wa_bridge.outgoing_messages` via n8n Postgres node
6. **Log**: INSERT into `public.notification_log`

### Go Service Changes

Add a new webhook trigger for booking status changes:
- In `store.go`, after updating booking status, call a configurable `BOOKING_WEBHOOK_URL`
- Payload: booking_id, new_status, customer_id, chat_id

Alternatively, use a Postgres trigger + NOTIFY channel that n8n listens to.

### RLS & Grants

- `wa_bridge_app`: ALL on notification_log
- `authenticated`: SELECT on notification_log (read-only in frontend)
- `n8n_app`: SELECT, INSERT on notification_log
- `n8n_app`: INSERT on wa_bridge.outgoing_messages (needs new grant)

### Frontend

- Show notification history in customer detail or booking detail (read-only list)
- "Sent notifications" section showing what was automatically sent

## Out of Scope

- User-configurable notification rules (hardcoded in n8n workflows for now)
- Notification preferences per customer (opt-out)
- Rich media notifications (images, documents)
- Real-time notification triggers (using scheduled cron is simpler for v1)

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_notification_log.sql` |
| CREATE | `n8n/workflows/booking-confirmation.json` |
| CREATE | `n8n/workflows/payment-reminder.json` |
| CREATE | `n8n/workflows/flight-reminder.json` |
| CREATE | `n8n/workflows/post-trip-followup.json` |
| MODIFY | `supabase/migrations/YYYYMMDD_grant_n8n_outgoing.sql` (grant INSERT on outgoing_messages to n8n_app) |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
