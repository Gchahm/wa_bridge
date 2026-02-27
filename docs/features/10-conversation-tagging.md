# Feature: Conversation Tagging & Notes

**Priority:** Phase 3 — Automation & Intelligence
**Depends on:** None (standalone)

## Problem

The agent juggles dozens of conversations and needs a way to quickly classify and filter them. "This customer is waiting for documents", "This one needs a follow-up tomorrow", "This is urgent". Currently the chat list has no categorization — it's just sorted by last message time.

## Requirements

### Data Model

Create `wa_bridge.tags` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `name` | text NOT NULL UNIQUE | e.g. "waiting_docs", "follow_up", "urgent" |
| `color` | text | Hex color for badge display, e.g. "#ef4444" |
| `sort_order` | integer DEFAULT 0 | |

Create `wa_bridge.chat_tags` junction table:

| Column | Type | Notes |
|--------|------|-------|
| `chat_id` | text FK → chats | Part of composite PK |
| `tag_id` | uuid FK → tags | Part of composite PK |
| `created_at` | timestamp DEFAULT now() | |

Create `wa_bridge.chat_notes` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `chat_id` | text FK → chats NOT NULL | |
| `content` | text NOT NULL | |
| `is_pinned` | boolean DEFAULT false | Pinned notes show in the chat header |
| `created_at` | timestamp | DEFAULT now() |
| `updated_at` | timestamp | DEFAULT now(), trigger-managed |

### RLS & Grants

- `wa_bridge_app`: ALL on all three tables
- `authenticated`: ALL on all three tables
- `n8n_app`: SELECT on all three tables

### Views

- `public.tags`, `public.chat_tags`, `public.chat_notes` — pass-through
- Modify `public.chats_with_preview` to include tags (array aggregate) — or create a new view `public.chats_with_tags`

### Frontend

**Tag management:**
- Settings page or inline popover for creating/editing tags
- Predefined seed tags: "Urgent" (red), "Follow Up" (yellow), "Waiting for Docs" (blue), "Price Check" (green), "New Lead" (purple)

**Chat list integration:**
- Show tag badges next to chat names in ChatList/ChatItem
- Filter chat list by tag (multi-select filter above the list)
- Add/remove tags via a popover on the chat item (right-click or tag icon)

**Chat header:**
- Show pinned notes in the chat header area (below the contact name)
- "Add note" button in chat header
- Small expandable section showing all notes for the chat

**Tag from chat:**
- Quick-tag action in the chat header (tag icon → multi-select popover)
- Tags persist across sessions

### UX Flow

1. Agent receives a message from a customer asking about prices
2. Agent tags the chat "Price Check"
3. Next day, agent filters chat list by "Price Check" → sees all chats awaiting price research
4. Agent resolves the price, removes the tag, adds "Follow Up" tag
5. Agent pins a note: "Quoted R$3,200 for GRU-MIA Jul 15-22, awaiting customer reply"
6. Next time agent opens the chat, the pinned note is visible at the top

## Out of Scope

- Auto-tagging based on message content (see Feature #11)
- Tag-based automation (e.g., auto-send follow-up after 3 days of "Follow Up" tag)
- Tags on messages (only on chats)
- Reminders / due dates on tags

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_chat_tags_and_notes.sql` |
| MODIFY | `wa-sales/src/components/ChatItem.tsx` (show tag badges) |
| MODIFY | `wa-sales/src/components/ChatList.tsx` (add tag filter) |
| MODIFY | `wa-sales/src/components/MessageView.tsx` (show pinned notes, tag action in header) |
| CREATE | `wa-sales/src/components/TagPopover.tsx` |
| CREATE | `wa-sales/src/components/ChatNotes.tsx` |
| MODIFY | `wa-sales/src/routes/_authenticated/chat.tsx` (update loader to include tags) |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
