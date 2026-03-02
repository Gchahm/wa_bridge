-- =============================================================================
-- public.flight_requests, public.flight_request_passengers, public.quote_options
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.flight_requests
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

ALTER TABLE "public"."flight_requests"
    ADD CONSTRAINT "fk_flight_requests_customer"
    FOREIGN KEY (customer_id) REFERENCES public.customers (id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."flight_requests" VALIDATE CONSTRAINT "fk_flight_requests_customer";

ALTER TABLE "public"."flight_requests"
    ADD CONSTRAINT "fk_flight_requests_chat"
    FOREIGN KEY (chat_id) REFERENCES wa_bridge.chats (chat_id)
    ON DELETE SET NULL NOT VALID;
ALTER TABLE "public"."flight_requests" VALIDATE CONSTRAINT "fk_flight_requests_chat";

CREATE INDEX idx_flight_requests_customer_id ON public.flight_requests (customer_id);
CREATE INDEX idx_flight_requests_status      ON public.flight_requests (status);

-- -----------------------------------------------------------------------------
-- public.flight_request_passengers
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
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."flight_request_passengers"
    VALIDATE CONSTRAINT "fk_flight_request_passengers_request";

ALTER TABLE "public"."flight_request_passengers"
    ADD CONSTRAINT "fk_flight_request_passengers_passenger"
    FOREIGN KEY (passenger_id) REFERENCES public.passengers (id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."flight_request_passengers"
    VALIDATE CONSTRAINT "fk_flight_request_passengers_passenger";

-- -----------------------------------------------------------------------------
-- public.quote_options
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."quote_options" (
    "id"                uuid                        NOT NULL DEFAULT gen_random_uuid(),
    "flight_request_id" uuid                        NOT NULL,
    "description"       text                        NOT NULL,
    "price"             numeric(10, 2),
    "currency"          text                                 DEFAULT 'BRL',
    "is_selected"       boolean                              DEFAULT false,
    "notes"             text,
    "departure_date"    date,
    "return_date"       date,
    "created_at"        timestamp without time zone          DEFAULT now()
);

ALTER TABLE "public"."quote_options" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX quote_options_pkey ON public.quote_options USING btree (id);
ALTER TABLE "public"."quote_options"
    ADD CONSTRAINT "quote_options_pkey" PRIMARY KEY USING INDEX "quote_options_pkey";

ALTER TABLE "public"."quote_options"
    ADD CONSTRAINT "fk_quote_options_flight_request"
    FOREIGN KEY (flight_request_id) REFERENCES public.flight_requests (id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."quote_options" VALIDATE CONSTRAINT "fk_quote_options_flight_request";

CREATE INDEX idx_quote_options_flight_request_id ON public.quote_options (flight_request_id);

-- =============================================================================
-- RLS
-- =============================================================================

CREATE POLICY "wa_bridge_app_flight_requests"
    ON "public"."flight_requests" AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);
CREATE POLICY "wa_bridge_app_flight_request_passengers"
    ON "public"."flight_request_passengers" AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);
CREATE POLICY "wa_bridge_app_quote_options"
    ON "public"."quote_options" AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_flight_requests"
    ON "public"."flight_requests" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_flight_request_passengers"
    ON "public"."flight_request_passengers" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_quote_options"
    ON "public"."quote_options" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."flight_requests"           TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."flight_request_passengers" TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."quote_options"             TO "wa_bridge_app";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."flight_requests"           TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."flight_request_passengers" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."quote_options"             TO "authenticated";

GRANT SELECT ON TABLE "public"."flight_requests"           TO "n8n_app";
GRANT SELECT ON TABLE "public"."flight_request_passengers" TO "n8n_app";
GRANT SELECT ON TABLE "public"."quote_options"             TO "n8n_app";

-- =============================================================================
-- Triggers
-- =============================================================================

CREATE TRIGGER trg_flight_requests_updated_at
    BEFORE UPDATE ON public.flight_requests
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.set_updated_at();

-- =============================================================================
-- Views
-- =============================================================================

CREATE OR REPLACE VIEW public.flight_requests_summary
    WITH (security_invoker = on)
    AS
SELECT
    fr.*,
    c.name                                                AS customer_name,
    (SELECT count(*) FROM public.flight_request_passengers frp
     WHERE frp.flight_request_id = fr.id)                 AS passenger_count,
    sq.price                                              AS selected_quote_price,
    sq.currency                                           AS selected_quote_currency,
    sq.description                                        AS selected_quote_description
FROM public.flight_requests fr
JOIN  public.customers     c  ON c.id = fr.customer_id
LEFT JOIN public.quote_options sq ON sq.flight_request_id = fr.id AND sq.is_selected = true;

GRANT SELECT ON public.flight_requests_summary TO authenticated;
