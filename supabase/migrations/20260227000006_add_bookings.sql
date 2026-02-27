-- =============================================================================
-- Migration: add_bookings
-- Purpose:   Add booking management tables (wa_bridge.bookings,
--            wa_bridge.booking_segments, wa_bridge.booking_passengers)
--            with RLS policies, grants, updated_at trigger reuse, and public
--            views for PostgREST access.
--
--            bookings captures confirmed travel reservations linked to a
--            customer and optionally to a flight_request. booking_segments
--            stores individual flight legs (airline, flight number, times).
--            booking_passengers is a junction table linking passenger profiles
--            to a booking with optional ticket numbers.
--
--            Depends on: 20260227000000_add_customers.sql
--                        20260227000002_add_passengers.sql
--                        20260227000004_add_flight_requests.sql
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge.bookings
--
-- One row per confirmed booking. Optionally linked to a flight_request via
-- flight_request_id (ON DELETE SET NULL so the booking survives if the request
-- is pruned). Status tracks the lifecycle from confirmed through to completion
-- or cancellation.
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."bookings" (
    "id"                uuid                        NOT NULL DEFAULT gen_random_uuid(),
    "flight_request_id" uuid,
    "customer_id"       uuid                        NOT NULL,
    "pnr"               text,
    "status"            text                        NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'ticketed', 'completed', 'cancelled', 'no_show')),
    "total_price"       numeric(10, 2),
    "currency"          text                                 DEFAULT 'BRL',
    "booking_source"    text,
    "notes"             text,
    "created_at"        timestamp without time zone          DEFAULT now(),
    "updated_at"        timestamp without time zone          DEFAULT now()
);

ALTER TABLE "wa_bridge"."bookings" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX bookings_pkey ON wa_bridge.bookings USING btree (id);

ALTER TABLE "wa_bridge"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY USING INDEX "bookings_pkey";

-- customer_id is required; deleting the customer removes all their bookings.
ALTER TABLE "wa_bridge"."bookings"
    ADD CONSTRAINT "fk_bookings_customer"
    FOREIGN KEY (customer_id) REFERENCES wa_bridge.customers (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "wa_bridge"."bookings" VALIDATE CONSTRAINT "fk_bookings_customer";

-- flight_request_id links to the originating flight request. Set to NULL if
-- the request is deleted so the booking record is preserved.
ALTER TABLE "wa_bridge"."bookings"
    ADD CONSTRAINT "fk_bookings_flight_request"
    FOREIGN KEY (flight_request_id) REFERENCES wa_bridge.flight_requests (id)
    ON DELETE SET NULL
    NOT VALID;
ALTER TABLE "wa_bridge"."bookings" VALIDATE CONSTRAINT "fk_bookings_flight_request";

-- Support filtering and listing bookings by customer, status, and flight request.
CREATE INDEX idx_bookings_customer_id       ON wa_bridge.bookings (customer_id);
CREATE INDEX idx_bookings_status            ON wa_bridge.bookings (status);
CREATE INDEX idx_bookings_flight_request_id ON wa_bridge.bookings (flight_request_id);

-- -----------------------------------------------------------------------------
-- wa_bridge.booking_segments
--
-- Individual flight legs within a booking, ordered by segment_order. Deleting
-- the booking cascades to remove all segments.
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."booking_segments" (
    "id"            uuid                        NOT NULL DEFAULT gen_random_uuid(),
    "booking_id"    uuid                        NOT NULL,
    "segment_order" integer                     NOT NULL,
    "airline"       text,
    "flight_number" text,
    "origin"        text                        NOT NULL,
    "destination"   text                        NOT NULL,
    "departure_at"  timestamp without time zone,
    "arrival_at"    timestamp without time zone,
    "cabin_class"   text
);

ALTER TABLE "wa_bridge"."booking_segments" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX booking_segments_pkey ON wa_bridge.booking_segments USING btree (id);

ALTER TABLE "wa_bridge"."booking_segments"
    ADD CONSTRAINT "booking_segments_pkey" PRIMARY KEY USING INDEX "booking_segments_pkey";

ALTER TABLE "wa_bridge"."booking_segments"
    ADD CONSTRAINT "fk_booking_segments_booking"
    FOREIGN KEY (booking_id) REFERENCES wa_bridge.bookings (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "wa_bridge"."booking_segments" VALIDATE CONSTRAINT "fk_booking_segments_booking";

CREATE INDEX idx_booking_segments_booking_id ON wa_bridge.booking_segments (booking_id);

-- -----------------------------------------------------------------------------
-- wa_bridge.booking_passengers
--
-- Junction table associating specific passenger profiles with a booking.
-- Includes optional ticket_number for e-ticket tracking. Deleting the booking
-- or the passenger cascades to remove the association row.
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."booking_passengers" (
    "booking_id"    uuid NOT NULL,
    "passenger_id"  uuid NOT NULL,
    "ticket_number" text
);

ALTER TABLE "wa_bridge"."booking_passengers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "wa_bridge"."booking_passengers"
    ADD CONSTRAINT "booking_passengers_pkey"
    PRIMARY KEY (booking_id, passenger_id);

ALTER TABLE "wa_bridge"."booking_passengers"
    ADD CONSTRAINT "fk_booking_passengers_booking"
    FOREIGN KEY (booking_id) REFERENCES wa_bridge.bookings (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "wa_bridge"."booking_passengers"
    VALIDATE CONSTRAINT "fk_booking_passengers_booking";

ALTER TABLE "wa_bridge"."booking_passengers"
    ADD CONSTRAINT "fk_booking_passengers_passenger"
    FOREIGN KEY (passenger_id) REFERENCES wa_bridge.passengers (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "wa_bridge"."booking_passengers"
    VALIDATE CONSTRAINT "fk_booking_passengers_passenger";

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge_app — full access to all three tables (the bridge process owns data)
-- -----------------------------------------------------------------------------

CREATE POLICY "wa_bridge_app_bookings"
    ON "wa_bridge"."bookings"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "wa_bridge_app_booking_segments"
    ON "wa_bridge"."booking_segments"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "wa_bridge_app_booking_passengers"
    ON "wa_bridge"."booking_passengers"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- authenticated — full CRUD on all three tables (users manage booking data)
-- -----------------------------------------------------------------------------

CREATE POLICY "authenticated_bookings"
    ON "wa_bridge"."bookings"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_booking_segments"
    ON "wa_bridge"."booking_segments"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_booking_passengers"
    ON "wa_bridge"."booking_passengers"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- TABLE-LEVEL GRANTS
-- =============================================================================

-- Bridge application needs full DML on all booking tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."bookings"            TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."booking_segments"    TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."booking_passengers"  TO "wa_bridge_app";

-- Authenticated users have full CRUD (booking data is user-managed).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."bookings"            TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."booking_segments"    TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."booking_passengers"  TO "authenticated";

-- n8n workflows can read booking data (n8n_app bypasses RLS via role attribute).
GRANT SELECT ON TABLE "wa_bridge"."bookings"            TO "n8n_app";
GRANT SELECT ON TABLE "wa_bridge"."booking_segments"    TO "n8n_app";
GRANT SELECT ON TABLE "wa_bridge"."booking_passengers"  TO "n8n_app";

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- wa_bridge.set_updated_at() already exists (created in add_customers migration).
-- Register it on bookings so updated_at stays current on every UPDATE.

CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON wa_bridge.bookings
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.set_updated_at();

-- =============================================================================
-- VIEWS (public schema)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.bookings — direct projection of wa_bridge.bookings
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.bookings
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.bookings;

-- -----------------------------------------------------------------------------
-- public.booking_segments — direct projection of wa_bridge.booking_segments
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.booking_segments
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.booking_segments;

-- -----------------------------------------------------------------------------
-- public.booking_passengers — direct projection of wa_bridge.booking_passengers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.booking_passengers
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.booking_passengers;

-- -----------------------------------------------------------------------------
-- public.bookings_summary
--
-- Enriched view joining customer name, route (first origin → last destination),
-- departure date, and passenger count for quick listing UI queries.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.bookings_summary
    WITH (security_invoker = on)
    AS
SELECT
    b.*,
    c.name AS customer_name,
    (SELECT count(*) FROM wa_bridge.booking_passengers bp
     WHERE bp.booking_id = b.id) AS passenger_count,
    first_seg.origin AS route_origin,
    last_seg.destination AS route_destination,
    first_seg.departure_at AS departure_at_display
FROM wa_bridge.bookings b
JOIN wa_bridge.customers c ON c.id = b.customer_id
LEFT JOIN LATERAL (
    SELECT bs.origin, bs.departure_at
    FROM wa_bridge.booking_segments bs
    WHERE bs.booking_id = b.id
    ORDER BY bs.segment_order ASC
    LIMIT 1
) first_seg ON true
LEFT JOIN LATERAL (
    SELECT bs.destination
    FROM wa_bridge.booking_segments bs
    WHERE bs.booking_id = b.id
    ORDER BY bs.segment_order DESC
    LIMIT 1
) last_seg ON true;

-- =============================================================================
-- VIEW GRANTS
-- =============================================================================

-- Pass-through views support full CRUD; security is enforced by the underlying
-- table grants and RLS policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_segments    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_passengers  TO authenticated;

-- Summary view is read-only (joins multiple tables; mutations target base views).
GRANT SELECT ON public.bookings_summary TO authenticated;
