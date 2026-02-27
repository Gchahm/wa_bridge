# Feature: Message Templates & Quick Replies

**Priority:** Phase 3 — Automation & Intelligence
**Depends on:** None (standalone, but more useful after Bookings #5)

## Problem

The agent types the same messages repeatedly: "What are your travel dates?", "Here's your itinerary: ...", "Payment confirmed, thank you!". This wastes time and introduces inconsistency. The agent needs reusable templates with variable substitution.

## Requirements

### Data Model

Create `wa_bridge.message_templates` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `name` | text NOT NULL UNIQUE | Short identifier — e.g. "ask_dates", "confirm_payment" |
| `category` | text NOT NULL | CHECK IN ('greeting', 'info_request', 'quote', 'confirmation', 'follow_up', 'other') |
| `content` | text NOT NULL | Message body with `{{variable}}` placeholders |
| `sort_order` | integer DEFAULT 0 | For manual ordering in the UI |
| `created_at` | timestamp | DEFAULT now() |
| `updated_at` | timestamp | DEFAULT now(), trigger-managed |

### Variable Placeholders

Templates support `{{variable}}` syntax. Available variables depend on context:

- `{{customer_name}}` — customer's name
- `{{origin}}` — request origin
- `{{destination}}` — request destination
- `{{departure_date}}` — request departure date
- `{{price}}` — quote/booking price
- `{{pnr}}` — booking PNR
- `{{agent_name}}` — configurable agent display name

Variables are resolved client-side when the template is inserted. Unresolvable variables are left as-is (agent fills them manually).

### RLS & Grants

- `wa_bridge_app`: ALL
- `authenticated`: ALL
- `n8n_app`: SELECT

### Views

- `public.message_templates` — pass-through

### Frontend

**Template management** (settings page or inline):
- Route: `/settings/templates` or a Sheet accessible from the chat
- CRUD for templates: name, category, content (with placeholder hints)
- Preview with sample data

**Quick replies in chat composer:**
- Add a "Templates" button (icon: `Zap` or `FileText`) next to the message input in MessageView
- Click opens a popover/dropdown with template categories and names
- Selecting a template inserts the content into the composer with variables pre-filled from context:
  - If the chat is linked to a customer → fill `{{customer_name}}`
  - If navigated from a request → fill route/date variables
  - If navigated from a booking → fill PNR/price
- Agent can edit the filled text before sending

### UX Flow

1. Agent opens template settings, creates template:
   - Name: "ask_dates"
   - Category: "info_request"
   - Content: "Hi {{customer_name}}! To find the best options for you, could you share your preferred travel dates? Are your dates flexible?"
2. In a chat, agent clicks Templates button
3. Selects "ask_dates"
4. Composer fills with: "Hi Maria! To find the best options for you, could you share your preferred travel dates? Are your dates flexible?"
5. Agent sends

### Seed Data

Include a migration with common templates:
- "greeting" — "Hi {{customer_name}}, how can I help you today?"
- "ask_dates" — "What are your preferred travel dates? Are they flexible?"
- "ask_passengers" — "How many passengers? Please share the full names as on their travel documents."
- "send_quote" — "Here's what I found for {{origin}} → {{destination}}: ..."
- "confirm_booking" — "Your booking is confirmed! PNR: {{pnr}}. Details: ..."
- "payment_received" — "Payment confirmed! Thank you, {{customer_name}}."

## Out of Scope

- WhatsApp Business template messages (those require Meta approval)
- Scheduled sending
- Template analytics (which templates are used most)
- Rich media templates (images, buttons)

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_message_templates.sql` |
| MODIFY | `wa-sales/src/components/MessageView.tsx` (add Templates button to composer) |
| CREATE | `wa-sales/src/components/TemplatePopover.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/settings/templates.tsx` (optional management page) |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
