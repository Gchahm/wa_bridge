# Feature: Dashboard / Home Page

**Priority:** Phase 1 — Sales Pipeline Basics
**Depends on:** Flight Requests (#2), Customers (implemented)

## Problem

When the agent opens the app, they land on `/chat` with no overview of their work. They have no idea which requests need attention, which customers recently messaged, or what's coming up. The agent needs a starting page that shows what matters right now.

## Requirements

### Frontend

Replace the current `/_authenticated/index.tsx` (which redirects to `/chat`) with a dashboard.

**Dashboard sections:**

1. **Open Requests by Status** — summary cards or a kanban-style view
   - Count of requests in each status: new, quoted, accepted, booked
   - Click a status card → navigates to `/requests?status=X`

2. **Recent Customer Activity** — list of customers who sent messages recently
   - Show: customer name, last message preview, time ago
   - Query: join `customers_with_contact` with `chats_with_preview` via `phone_number` → `chat_id`
   - Click → opens the chat
   - Limit to 10 most recent

3. **Unlinked Contacts** — WhatsApp contacts not yet linked to a customer
   - Query: contacts WHERE phone_number NOT IN (SELECT phone_number FROM customers WHERE phone_number IS NOT NULL)
   - Show: push_name, phone_number, last_seen_at
   - Click → opens customer create form with phone_number pre-filled
   - This helps the agent keep their CRM complete

4. **Upcoming Departures** (only if Bookings #5 is implemented, otherwise skip)
   - Flights departing in the next 7 days
   - Show: customer, route, date, PNR

### Data

No new tables needed. All data comes from existing views:
- `flight_requests` (grouped by status)
- `customers_with_contact` + `chats_with_preview` (recent activity)
- `contacts` + `customers` (unlinked contacts)

A database view `public.unlinked_contacts` could simplify the query:
```sql
SELECT c.phone_number, c.push_name, c.last_seen_at
FROM wa_bridge.contacts c
LEFT JOIN wa_bridge.customers cu ON cu.phone_number = c.phone_number
WHERE cu.id IS NULL
ORDER BY c.last_seen_at DESC NULLS LAST;
```

### Sidebar

Add "Dashboard" nav item as the first item. Icon: `LayoutDashboard` from lucide-react. Route: `/`.

### UX Flow

1. Agent opens app → lands on dashboard
2. Sees 3 new requests, 5 quoted, 2 accepted
3. Sees Maria sent a message 5 minutes ago → clicks to open chat
4. Sees 2 unlinked contacts → clicks to create customers
5. Returns to dashboard to check next task

## Out of Scope

- Drag-and-drop kanban for request status changes
- Real-time updates on dashboard (can use router invalidation for now)
- Analytics/charts (see Feature #14)

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_unlinked_contacts_view.sql` (optional) |
| MODIFY | `wa-sales/src/routes/_authenticated/index.tsx` (replace redirect with dashboard) |
| MODIFY | `wa-sales/src/components/AppSidebar.tsx` (add Dashboard nav item) |
| CREATE | `wa-sales/src/routes/_authenticated/-components/DashboardCard.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/-components/RecentActivity.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/-components/UnlinkedContacts.tsx` |
| REGEN  | `wa-sales/src/lib/database.types.ts` (if view added) |
