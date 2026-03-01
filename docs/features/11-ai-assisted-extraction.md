# Feature: AI-Assisted Extraction (n8n + LLM)

**Priority:** Phase 3 — Automation & Intelligence
**Depends on:** Flight Requests (#2), Chat-to-Request Linking (#3)

## Problem

Customers describe trips in natural language: "Preciso de 2 passagens de São Paulo pra Miami, ida dia 15 de julho e volta dia 22, classe econômica". The agent reads this, mentally parses it, and manually fills in a structured form. An LLM can extract this structured data automatically, pre-filling the form and saving the agent time.

## Requirements

### Extraction Pipeline

Use the existing webhook infrastructure (Go service → n8n) to process inbound messages:

1. **Go service** already forwards messages to `MESSAGE_WEBHOOK_URL`
2. **n8n workflow** receives the message, sends it to an LLM API
3. **LLM** extracts structured data (origin, destination, dates, pax, class)
4. **n8n** writes the extracted data back to the database
5. **Frontend** shows a "suggested request" that the agent can confirm or dismiss

### Data Model

Create `public.extracted_requests` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `message_id` | text NOT NULL | |
| `chat_id` | text NOT NULL | |
| `customer_id` | uuid FK → customers | Resolved from chat → contact → customer |
| `origin` | text | Extracted origin |
| `destination` | text | Extracted destination |
| `departure_date` | text | Raw extracted text (may be vague: "mid-July") |
| `return_date` | text | |
| `adults` | integer | |
| `children` | integer | |
| `infants` | integer | |
| `cabin_class` | text | |
| `raw_text` | text | The original message text |
| `confidence` | numeric(3,2) | 0.00–1.00, LLM's confidence in the extraction |
| `status` | text DEFAULT 'pending' | CHECK IN ('pending', 'accepted', 'dismissed') |
| `flight_request_id` | uuid FK → flight_requests | Set when accepted and converted to a real request |
| `created_at` | timestamp | DEFAULT now() |

### LLM Prompt Design

System prompt for the extraction:
```
You are a flight booking assistant. Extract structured travel request data from the customer message below.
The customer is writing in Portuguese (Brazilian).

Return a JSON object with these fields (use null if not mentioned):
- origin: airport code or city name
- destination: airport code or city name
- departure_date: ISO date or descriptive text
- return_date: ISO date or descriptive text (null if one-way)
- adults: number (default 1)
- children: number (default 0)
- infants: number (default 0)
- cabin_class: "economy", "premium_economy", "business", or "first"
- confidence: 0.0 to 1.0, how confident you are this is a flight request

If the message is NOT a flight request (e.g., "bom dia", "obrigado"), return {"confidence": 0.0}.
```

### n8n Workflow

1. Trigger: webhook from Go service (MESSAGE_WEBHOOK_URL)
2. Filter: skip group messages, skip from-me messages
3. LLM call: send message text with extraction prompt
4. Filter: skip if confidence < 0.5
5. Resolve customer: query customers by phone_number matching sender_id
6. Write: INSERT into `public.extracted_requests`
7. Optional: send a Supabase Realtime broadcast to notify the frontend

### Frontend

**Notification in chat:**
- When viewing a chat that has pending extracted_requests, show a banner:
  "AI detected a flight request: GRU → MIA, Jul 15-22, 2 adults. [Create Request] [Dismiss]"
- "Create Request" opens RequestSheet pre-filled with extracted data
- "Dismiss" sets status = 'dismissed'

**Conversation summary** (optional, lower priority):
- "Summarize" button in chat header
- Sends last N messages to LLM via n8n
- Returns a summary shown in a popover

### RLS & Grants

- `wa_bridge_app`: ALL
- `authenticated`: ALL
- `n8n_app`: SELECT, INSERT, UPDATE

### Configuration

- LLM API key stored as n8n credential (not in env vars)
- Model: configurable (Claude, GPT-4, etc.)
- Rate limiting: process at most 1 message per second to control costs
- Only process messages from 1:1 chats with known customers

## Out of Scope

- Real-time extraction (async via n8n is fine, delay of seconds is acceptable)
- Auto-creating requests without agent confirmation
- Training custom models
- Multi-turn conversation understanding (extract from single messages only for v1)

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_extracted_requests.sql` |
| CREATE | `n8n/workflows/ai-extraction.json` |
| CREATE | `wa-sales/src/components/ExtractedRequestBanner.tsx` |
| MODIFY | `wa-sales/src/components/MessageView.tsx` (show banner when pending extractions exist) |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
