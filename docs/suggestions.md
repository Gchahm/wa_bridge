# Feature Suggestions

## Context

The user is a flight sales agent. Customers reach out via WhatsApp to book flights for themselves and their passengers (family, friends, etc.). The system should help the agent manage conversations, track requests, build quotes, and close bookings efficiently.

What exists today: WhatsApp chat viewer with realtime sync, basic customer CRUD linked to WhatsApp contacts, customer relationships, outbound messaging, media storage, n8n automation (ready but minimal), and monitoring (Grafana/Loki).

---

## Phase 1 — Sales Pipeline Basics

These features turn the app from a chat viewer into an actual work tool for the agent.

### 1. Passenger Profiles

Customers book flights for people who may not be on WhatsApp — a wife, a child, an elderly parent. The system needs a `passengers` table linked to customers.

- Fields: full legal name, date of birth, document type + number (CPF, passport), nationality, gender, frequent flyer numbers
- A customer can have many passengers (including themselves)
- Passengers can be shared across customers (e.g., a child whose parents both book for them)
- Quick-fill from customer data ("add self as passenger")

### 2. Flight Requests (Quotes)

When a customer asks "I need 2 tickets SAO-MIA in July", the agent needs to capture and track that request.

- Fields: customer, origin, destination, departure date range, return date range, number of passengers, cabin class, flexible dates flag, budget range, notes
- Status workflow: `new` → `quoted` → `accepted` → `booked` → `completed` / `cancelled`
- Link to the WhatsApp chat for context
- Multiple quote options per request (the agent might offer 3 different itineraries)

### 3. Chat-to-Request Linking

The agent should be able to open a chat, select messages, and create a flight request from them. This bridges the conversation with the structured data.

- "Create request from chat" button in the message view
- Pre-fill origin/destination/dates if parseable from selected messages
- Link back to the original messages for reference

### 4. Dashboard / Home Page

Replace the current redirect-to-chat index with a dashboard showing:

- Open requests by status (kanban or summary cards)
- Recent customer activity (new messages from known customers)
- Unlinked chats (WhatsApp contacts not yet associated with a customer)
- Today's departures or upcoming bookings

---

## Phase 2 — Booking Management

Once the agent can track requests, the next step is tracking what actually gets booked.

### 5. Bookings & Itineraries

A booking is the confirmed result of a flight request.

- Fields: airline, flight number(s), PNR/locator, departure/arrival datetime, route segments, passengers, total price, payment status, booking source
- Multiple segments per booking (connections)
- Link to the originating request
- Status: `confirmed` → `ticketed` → `completed` / `cancelled` / `no-show`

### 6. Payment Tracking

Simple financial tracking per booking.

- Amount, payment method, installments, due dates
- Status: `pending` → `partial` → `paid` → `refunded`
- Commission tracking (agent's cut)
- No need for a full accounting system — just enough to know what's owed

### 7. Document Management

Customers send passports, IDs, and receipts via WhatsApp. The agent needs to find them later.

- Tag media messages as "document" with type (passport, ID, receipt, voucher)
- Link documents to passengers or bookings
- Quick access from passenger/booking views
- Already partially supported — media is stored in Supabase Storage, just needs metadata and UI

---

## Phase 3 — Automation & Intelligence

These features leverage the n8n infrastructure and make the agent faster.

### 8. Message Templates & Quick Replies

The agent sends similar messages repeatedly: "What dates?", "Here's your itinerary", "Payment confirmed".

- Predefined message templates with variable placeholders (customer name, flight details, price)
- Quick-reply buttons in the chat composer
- Template categories: greeting, info request, quote, confirmation, follow-up

### 9. Automated Notifications (n8n)

Use n8n workflows to send proactive messages.

- Booking confirmation summary after status change
- Payment reminders for upcoming due dates
- Flight reminders (24h before departure)
- Follow-up after trip completion ("How was your flight?")
- Triggered by database changes (Postgres LISTEN/NOTIFY or Supabase webhooks)

### 10. Conversation Tagging & Notes

Let the agent annotate conversations without structured data.

- Tags on chats: "waiting for docs", "price check", "urgent", "follow-up"
- Pinned notes on a chat (visible in the chat header)
- Filter chat list by tags

### 11. AI-Assisted Extraction (n8n + LLM)

Use the existing webhook infrastructure to pipe messages through an LLM.

- Extract structured data from natural language: "I want to fly from Sao Paulo to Miami on July 15, returning July 22, 2 adults and 1 child"
- Suggest pre-filled flight request forms
- Summarize long conversations into key points
- Start with n8n workflow → LLM API → write back to database

---

## Phase 4 — Scale & Polish

For when the core workflow is solid and the agent wants efficiency gains.

### 12. Search Across Everything

Global search that finds customers, passengers, bookings, and messages in one query.

- Full-text search on messages (Postgres `tsvector`)
- Unified search bar in the header
- Results grouped by type with quick navigation

### 13. Customer Timeline

A unified view per customer showing all activity chronologically:

- Messages sent/received
- Requests created/updated
- Bookings made
- Payments received
- Documents uploaded

### 14. Reporting

Basic business intelligence for the agent.

- Bookings per month, revenue per month
- Top customers by booking volume
- Conversion rate (requests → bookings)
- Average response time
- Popular routes

### 15. Multi-Agent Support

If the business grows beyond one agent:

- User roles (admin, agent)
- Chat assignment (which agent handles which customer)
- Internal notes visible only to agents
- Handoff between agents

---

## Suggested Implementation Order

The order above roughly follows priority, but here's a tighter recommendation for maximum early value:

1. **Passenger Profiles** — unlocks the ability to track who's flying
2. **Flight Requests** — the core workflow the agent needs daily
3. **Dashboard** — gives the agent a starting point instead of a blank chat list
4. **Bookings** — tracks outcomes
5. **Message Templates** — saves time on repetitive typing
6. **Automated Notifications** — reduces manual follow-up
7. Everything else as needed

The guiding principle: **make the most common daily task faster first**, then expand outward.
