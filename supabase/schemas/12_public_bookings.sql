-- =============================================================================
-- public.bookings, public.booking_segments, public.booking_passengers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.bookings
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."bookings" (
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

ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (id);
ALTER TABLE "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY USING INDEX "bookings_pkey";

ALTER TABLE "public"."bookings"
    ADD CONSTRAINT "fk_bookings_customer"
    FOREIGN KEY (customer_id) REFERENCES public.customers (id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."bookings" VALIDATE CONSTRAINT "fk_bookings_customer";

ALTER TABLE "public"."bookings"
    ADD CONSTRAINT "fk_bookings_flight_request"
    FOREIGN KEY (flight_request_id) REFERENCES public.flight_requests (id)
    ON DELETE SET NULL NOT VALID;
ALTER TABLE "public"."bookings" VALIDATE CONSTRAINT "fk_bookings_flight_request";

CREATE INDEX idx_bookings_customer_id       ON public.bookings (customer_id);
CREATE INDEX idx_bookings_status            ON public.bookings (status);
CREATE INDEX idx_bookings_flight_request_id ON public.bookings (flight_request_id);

-- -----------------------------------------------------------------------------
-- public.booking_segments
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."booking_segments" (
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

ALTER TABLE "public"."booking_segments" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX booking_segments_pkey ON public.booking_segments USING btree (id);
ALTER TABLE "public"."booking_segments"
    ADD CONSTRAINT "booking_segments_pkey" PRIMARY KEY USING INDEX "booking_segments_pkey";

ALTER TABLE "public"."booking_segments"
    ADD CONSTRAINT "fk_booking_segments_booking"
    FOREIGN KEY (booking_id) REFERENCES public.bookings (id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."booking_segments" VALIDATE CONSTRAINT "fk_booking_segments_booking";

CREATE INDEX idx_booking_segments_booking_id ON public.booking_segments (booking_id);

-- -----------------------------------------------------------------------------
-- public.booking_passengers
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."booking_passengers" (
    "booking_id"    uuid NOT NULL,
    "passenger_id"  uuid NOT NULL,
    "ticket_number" text
);

ALTER TABLE "public"."booking_passengers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."booking_passengers"
    ADD CONSTRAINT "booking_passengers_pkey"
    PRIMARY KEY (booking_id, passenger_id);

ALTER TABLE "public"."booking_passengers"
    ADD CONSTRAINT "fk_booking_passengers_booking"
    FOREIGN KEY (booking_id) REFERENCES public.bookings (id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."booking_passengers"
    VALIDATE CONSTRAINT "fk_booking_passengers_booking";

ALTER TABLE "public"."booking_passengers"
    ADD CONSTRAINT "fk_booking_passengers_passenger"
    FOREIGN KEY (passenger_id) REFERENCES public.passengers (id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."booking_passengers"
    VALIDATE CONSTRAINT "fk_booking_passengers_passenger";

-- =============================================================================
-- RLS
-- =============================================================================

CREATE POLICY "wa_bridge_app_bookings"
    ON "public"."bookings" AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);
CREATE POLICY "wa_bridge_app_booking_segments"
    ON "public"."booking_segments" AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);
CREATE POLICY "wa_bridge_app_booking_passengers"
    ON "public"."booking_passengers" AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_bookings"
    ON "public"."bookings" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_booking_segments"
    ON "public"."booking_segments" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_booking_passengers"
    ON "public"."booking_passengers" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."bookings"            TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."booking_segments"    TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."booking_passengers"  TO "wa_bridge_app";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."bookings"            TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."booking_segments"    TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."booking_passengers"  TO "authenticated";

GRANT SELECT ON TABLE "public"."bookings"            TO "n8n_app";
GRANT SELECT ON TABLE "public"."booking_segments"    TO "n8n_app";
GRANT SELECT ON TABLE "public"."booking_passengers"  TO "n8n_app";

-- =============================================================================
-- Triggers
-- =============================================================================

CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.set_updated_at();

-- =============================================================================
-- Views
-- =============================================================================

CREATE OR REPLACE VIEW public.bookings_summary
    WITH (security_invoker = on)
    AS
SELECT
    b.*,
    c.name AS customer_name,
    (SELECT count(*) FROM public.booking_passengers bp
     WHERE bp.booking_id = b.id) AS passenger_count,
    first_seg.origin AS route_origin,
    last_seg.destination AS route_destination,
    first_seg.departure_at AS departure_at_display
FROM public.bookings b
JOIN public.customers c ON c.id = b.customer_id
LEFT JOIN LATERAL (
    SELECT bs.origin, bs.departure_at
    FROM public.booking_segments bs
    WHERE bs.booking_id = b.id
    ORDER BY bs.segment_order ASC
    LIMIT 1
) first_seg ON true
LEFT JOIN LATERAL (
    SELECT bs.destination
    FROM public.booking_segments bs
    WHERE bs.booking_id = b.id
    ORDER BY bs.segment_order DESC
    LIMIT 1
) last_seg ON true;

GRANT SELECT ON public.bookings_summary TO authenticated;
