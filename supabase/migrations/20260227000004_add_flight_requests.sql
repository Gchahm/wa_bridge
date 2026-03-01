-- =============================================================================
-- Migration: add_flight_requests
-- Purpose:   Add flight request management tables (public.flight_requests,
--            public.flight_request_passengers, public.quote_options)
--            with RLS policies, grants, updated_at trigger reuse, and an
--            enriched summary view for PostgREST access.
--
--            flight_requests captures a customer's travel intent (origin,
--            destination, dates, pax counts, cabin class, budget). The
--            flight_request_passengers junction table links specific passenger
--            profiles to a request. quote_options stores one or more priced
--            alternatives presented to the customer, with a flag indicating
--            which option the customer accepted.
--
--            Depends on: 20260227000000_add_customers.sql
--                        20260227000002_add_passengers.sql
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.flight_requests
--
-- One row per travel enquiry from a customer. Optionally linked to the
-- originating WhatsApp chat via chat_id (ON DELETE SET NULL so the request
-- survives if the chat is pruned). Status tracks the lifecycle from initial
-- enquiry through to completion or cancellation.
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."flight_requests" (
    "id"                   uuid                        NOT NULL DEFAULT gen_random_uuid(),
    "customer_id"          uuid                        NOT NULL,
    "chat_id"              text,
    "status"               text                        NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new', 'quoted', 'accepted', 'booked', 'completed', 'cancelled')),
    "origin"               text,
    "destination"          text,
    "departure_date_start" date,
    "departure_date_end"   date,
    "return_date_start"    date,
    "return_date_end"      date,
    "adults"               integer                              DEFAULT 1,
    "children"             integer                              DEFAULT 0,
    "infants"              integer                              DEFAULT 0,
    "cabin_class"          text                                 DEFAULT 'economy'
                           CHECK (cabin_class IN ('economy', 'premium_economy', 'business', 'first')),
    "budget_min"           numeric(10, 2),
    "budget_max"           numeric(10, 2),
    "budget_currency"      text                                 DEFAULT 'BRL',
    "notes"                text,
    "created_at"           timestamp without time zone          DEFAULT now(),
    "updated_at"           timestamp without time zone          DEFAULT now()
);

ALTER TABLE "public"."flight_requests" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX flight_requests_pkey ON public.flight_requests USING btree (id);

ALTER TABLE "public"."flight_requests"
    ADD CONSTRAINT "flight_requests_pkey" PRIMARY KEY USING INDEX "flight_requests_pkey";

-- customer_id is required; deleting the customer removes all their requests.
ALTER TABLE "public"."flight_requests"
    ADD CONSTRAINT "fk_flight_requests_customer"
    FOREIGN KEY (customer_id) REFERENCES public.customers (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "public"."flight_requests" VALIDATE CONSTRAINT "fk_flight_requests_customer";

-- chat_id links to the originating WhatsApp chat. Set to NULL if the chat is
-- deleted so the flight request record is preserved.
ALTER TABLE "public"."flight_requests"
    ADD CONSTRAINT "fk_flight_requests_chat"
    FOREIGN KEY (chat_id) REFERENCES wa_bridge.chats (chat_id)
    ON DELETE SET NULL
    NOT VALID;
ALTER TABLE "public"."flight_requests" VALIDATE CONSTRAINT "fk_flight_requests_chat";

-- Support filtering and listing requests by customer and by status.
CREATE INDEX idx_flight_requests_customer_id ON public.flight_requests (customer_id);
CREATE INDEX idx_flight_requests_status      ON public.flight_requests (status);

-- -----------------------------------------------------------------------------
-- public.flight_request_passengers
--
-- Junction table associating specific passenger profiles with a flight request.
-- Deleting the request or the passenger cascades to remove the association row.
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."flight_request_passengers" (
    "flight_request_id" uuid NOT NULL,
    "passenger_id"      uuid NOT NULL
);

ALTER TABLE "public"."flight_request_passengers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."flight_request_passengers"
    ADD CONSTRAINT "flight_request_passengers_pkey"
    PRIMARY KEY (flight_request_id, passenger_id);

ALTER TABLE "public"."flight_request_passengers"
    ADD CONSTRAINT "fk_flight_request_passengers_request"
    FOREIGN KEY (flight_request_id) REFERENCES public.flight_requests (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "public"."flight_request_passengers"
    VALIDATE CONSTRAINT "fk_flight_request_passengers_request";

ALTER TABLE "public"."flight_request_passengers"
    ADD CONSTRAINT "fk_flight_request_passengers_passenger"
    FOREIGN KEY (passenger_id) REFERENCES public.passengers (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "public"."flight_request_passengers"
    VALIDATE CONSTRAINT "fk_flight_request_passengers_passenger";

-- -----------------------------------------------------------------------------
-- public.quote_options
--
-- One or more priced alternatives per flight request. is_selected marks the
-- option the customer accepted; only one option per request should be selected
-- at a time (enforced at the application layer). Deleting the request cascades
-- to remove all associated quotes.
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."quote_options" (
    "id"                uuid                        NOT NULL DEFAULT gen_random_uuid(),
    "flight_request_id" uuid                        NOT NULL,
    "description"       text                        NOT NULL,
    "price"             numeric(10, 2),
    "currency"          text                                 DEFAULT 'BRL',
    "is_selected"       boolean                              DEFAULT false,
    "notes"             text,
    "created_at"        timestamp without time zone          DEFAULT now()
);

ALTER TABLE "public"."quote_options" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX quote_options_pkey ON public.quote_options USING btree (id);

ALTER TABLE "public"."quote_options"
    ADD CONSTRAINT "quote_options_pkey" PRIMARY KEY USING INDEX "quote_options_pkey";

ALTER TABLE "public"."quote_options"
    ADD CONSTRAINT "fk_quote_options_flight_request"
    FOREIGN KEY (flight_request_id) REFERENCES public.flight_requests (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "public"."quote_options" VALIDATE CONSTRAINT "fk_quote_options_flight_request";

-- Support fetching all quotes for a given request efficiently.
CREATE INDEX idx_quote_options_flight_request_id ON public.quote_options (flight_request_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge_app — full access to all three tables (the bridge process owns data)
-- -----------------------------------------------------------------------------

CREATE POLICY "wa_bridge_app_flight_requests"
    ON "public"."flight_requests"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "wa_bridge_app_flight_request_passengers"
    ON "public"."flight_request_passengers"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "wa_bridge_app_quote_options"
    ON "public"."quote_options"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- authenticated — full CRUD on all three tables (users manage flight data)
-- -----------------------------------------------------------------------------

CREATE POLICY "authenticated_flight_requests"
    ON "public"."flight_requests"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_flight_request_passengers"
    ON "public"."flight_request_passengers"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_quote_options"
    ON "public"."quote_options"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- TABLE-LEVEL GRANTS
-- =============================================================================

-- Bridge application needs full DML on all flight-request tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."flight_requests"           TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."flight_request_passengers" TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."quote_options"             TO "wa_bridge_app";

-- Authenticated users have full CRUD (flight data is user-managed).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."flight_requests"           TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."flight_request_passengers" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."quote_options"             TO "authenticated";

-- n8n workflows can read flight data (n8n_app bypasses RLS via role attribute).
GRANT SELECT ON TABLE "public"."flight_requests"           TO "n8n_app";
GRANT SELECT ON TABLE "public"."flight_request_passengers" TO "n8n_app";
GRANT SELECT ON TABLE "public"."quote_options"             TO "n8n_app";

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- wa_bridge.set_updated_at() already exists (created in add_customers migration).
-- Register it on flight_requests so updated_at stays current on every UPDATE.
-- quote_options has no updated_at column so no trigger is needed there.

CREATE TRIGGER trg_flight_requests_updated_at
    BEFORE UPDATE ON public.flight_requests
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.set_updated_at();

-- =============================================================================
-- ENRICHED VIEW (public schema)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.flight_requests_summary
--
-- Enriched view joining customer name, live passenger count, and the single
-- selected quote's price/currency/description for quick listing UI queries.
-- Rows without a selected quote still appear (LEFT JOIN) with NULL for the
-- selected_quote_* columns.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.flight_requests_summary
    WITH (security_invoker = on)
    AS
SELECT
    fr.*,
    c.name                                                                              AS customer_name,
    (SELECT count(*) FROM public.flight_request_passengers frp
     WHERE frp.flight_request_id = fr.id)                                              AS passenger_count,
    sq.price                                                                            AS selected_quote_price,
    sq.currency                                                                         AS selected_quote_currency,
    sq.description                                                                      AS selected_quote_description
FROM public.flight_requests fr
JOIN  public.customers     c  ON c.id = fr.customer_id
LEFT JOIN public.quote_options sq ON sq.flight_request_id = fr.id AND sq.is_selected = true;

-- =============================================================================
-- VIEW GRANTS
-- =============================================================================

-- Summary view is read-only (joins multiple tables; mutations target base tables directly).
GRANT SELECT ON public.flight_requests_summary TO authenticated;
