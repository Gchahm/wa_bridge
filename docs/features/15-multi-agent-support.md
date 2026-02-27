# Feature: Multi-Agent Support

**Priority:** Phase 4 — Scale & Polish
**Depends on:** All previous features (this is a cross-cutting concern)

## Problem

The system currently assumes a single sales agent. If the business grows — a second agent joins, or an assistant helps with admin tasks — there's no way to separate access, assign chats, or track who did what. This feature adds user roles, chat assignment, and agent-scoped visibility.

## Requirements

### Data Model

Create `wa_bridge.agents` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | References `auth.users(id)` — Supabase auth user |
| `display_name` | text NOT NULL | Agent's name shown in the app |
| `role` | text NOT NULL DEFAULT 'agent' | CHECK IN ('admin', 'agent') |
| `is_active` | boolean DEFAULT true | Soft disable |
| `created_at` | timestamp | DEFAULT now() |

Modify `wa_bridge.chats`:
- Add `assigned_agent_id uuid FK → agents` (nullable)

Create `wa_bridge.internal_notes` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `chat_id` | text FK → chats NOT NULL | |
| `agent_id` | uuid FK → agents NOT NULL | Who wrote the note |
| `content` | text NOT NULL | |
| `created_at` | timestamp | DEFAULT now() |

### RLS Policy Changes

This is the most significant change — RLS policies need to become agent-aware:

**Admin role:**
- Can see all chats, customers, bookings, etc.
- Can assign/reassign chats
- Can manage agents

**Agent role:**
- Can see chats assigned to them + unassigned chats
- Can see all customers (CRM is shared)
- Can see all bookings (needed for cross-reference)
- Can only see internal notes they wrote (or in their assigned chats)

Implementation approach:
- Create a helper function `wa_bridge.current_agent_id()` that returns the agent ID for the current auth user
- Create a helper function `wa_bridge.is_admin()` that checks the current user's role
- Update RLS policies to use these functions

### Frontend

**Agent management** (admin only):
- Route: `/settings/agents`
- List agents, add new (creates Supabase auth user + agent record)
- Assign roles

**Chat assignment:**
- In the chat list, show assignment badge (agent avatar/initials)
- Filter chat list: "My chats", "Unassigned", "All"
- Assign action: dropdown in chat header to assign to an agent

**Internal notes:**
- In the message view, add an "Internal Notes" section (separate from customer-visible messages)
- Only visible to agents, never sent to WhatsApp
- Show agent name and timestamp

**Handoff:**
- Agent clicks "Reassign" → selects another agent
- Optional: add a note explaining context

### Who is the agent?

On first login, if no agent record exists for the Supabase auth user, auto-create one:
- `id` = `auth.uid()`
- `display_name` = email prefix or a setup prompt
- `role` = 'admin' if first user, 'agent' otherwise

### UX Flow

1. Admin logs in, goes to `/settings/agents`, invites a new agent
2. New agent logs in, sees only unassigned chats
3. Agent claims a chat → it becomes "assigned" to them
4. Agent writes an internal note: "Customer wants the cheapest option, will follow up tomorrow"
5. Agent goes on vacation → admin reassigns their chats to another agent
6. New agent sees the internal notes and picks up where the other left off

## Out of Scope

- Granular permissions (read-only, booking-only, etc.)
- Team/department structure
- Agent performance metrics (see Reporting #14 for basic stats)
- Chat routing rules (auto-assignment based on round-robin, availability, etc.)
- Real-time presence (who's online)

## Technical Notes

- This feature touches RLS policies across all tables — it's a significant migration
- Consider implementing as an opt-in feature: if no agents table exists or only one agent, skip all agent-scoped logic
- The `agents` table references `auth.users(id)` which requires a FK to the Supabase auth schema
- Internal notes are never exposed via the public views that n8n reads

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_multi_agent.sql` |
| MODIFY | Multiple RLS policies across existing migrations (or new migration to ALTER) |
| MODIFY | `wa-sales/src/routes/_authenticated.tsx` (agent context provider) |
| MODIFY | `wa-sales/src/components/ChatList.tsx` (assignment filter, badges) |
| MODIFY | `wa-sales/src/components/MessageView.tsx` (internal notes section, assign action) |
| CREATE | `wa-sales/src/routes/_authenticated/settings/agents.tsx` |
| CREATE | `wa-sales/src/components/InternalNotes.tsx` |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
