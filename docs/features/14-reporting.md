# Feature: Reporting

**Priority:** Phase 4 — Scale & Polish
**Depends on:** Bookings (#5), Payments (#6), Flight Requests (#2)

## Problem

The agent has no visibility into business performance. How many bookings this month? What's the total revenue? Which routes are most popular? Which customers book the most? The agent needs basic metrics to understand their business without exporting data to spreadsheets.

## Requirements

### Data

No new tables needed. All reports are read-only aggregations.

Create Postgres views or functions:

**`public.report_monthly_bookings`:**
- Columns: month (date), total_bookings, total_revenue, total_commission, avg_booking_value
- Groups bookings by month with SUM/COUNT/AVG

**`public.report_top_customers`:**
- Columns: customer_id, customer_name, total_bookings, total_revenue, last_booking_date
- Groups bookings by customer, ordered by total_bookings DESC
- Parameterized by date range (use a function instead of view)

**`public.report_popular_routes`:**
- Columns: origin, destination, booking_count, avg_price
- Groups booking_segments by origin-destination pair
- Parameterized by date range

**`public.report_conversion_funnel`:**
- Columns: month, new_requests, quoted, accepted, booked, cancelled
- Groups flight_requests by status and month

**`public.report_response_time`** (optional):
- Average time between customer's first message and agent's first reply
- Requires more complex query on messages table

### Frontend

New route: `/reports`

**Layout:**
- Date range picker at the top (default: current month)
- Grid of report cards/sections

**Sections:**

1. **Summary Cards** (top row):
   - Total bookings this period
   - Total revenue this period
   - Total commission this period
   - Conversion rate (requests → bookings)

2. **Monthly Trend** (simple table, not charts for v1):
   - Table: month, bookings, revenue, commission
   - Last 12 months

3. **Top Customers** (table):
   - Top 10 customers by booking count
   - Columns: name, bookings, total spent, last booking

4. **Popular Routes** (table):
   - Top 10 routes by booking frequency
   - Columns: origin → destination, count, avg price

5. **Conversion Funnel** (horizontal bar or table):
   - Requests by status for the selected period

### Sidebar

Add "Reports" nav item. Icon: `BarChart3` from lucide-react.

### UX Flow

1. Agent opens `/reports`
2. Sees this month: 15 bookings, R$ 45,000 revenue, R$ 4,500 commission
3. Checks top customers → Maria Silva has 5 bookings this month
4. Checks popular routes → GRU-MIA is the most booked route
5. Adjusts date range to Q1 → sees quarterly trends

## Out of Scope

- Charts/graphs (tables are sufficient for v1; can add chart library later)
- Export to PDF/Excel
- Real-time dashboards
- Comparison periods ("vs. last month")
- Revenue forecasting

## Technical Notes

- Use Postgres views for simple aggregations, functions for parameterized reports
- Call functions via Supabase `.rpc()` with date range parameters
- Consider materialized views if performance is an issue with large datasets

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/YYYYMMDD_add_report_views.sql` |
| MODIFY | `wa-sales/src/components/AppSidebar.tsx` (add Reports nav) |
| CREATE | `wa-sales/src/routes/_authenticated/reports.tsx` (layout + loader) |
| CREATE | `wa-sales/src/routes/_authenticated/reports/index.tsx` (report page) |
| CREATE | `wa-sales/src/routes/_authenticated/reports/-components/SummaryCards.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/reports/-components/TopCustomers.tsx` |
| CREATE | `wa-sales/src/routes/_authenticated/reports/-components/PopularRoutes.tsx` |
| REGEN  | `wa-sales/src/lib/database.types.ts` |
