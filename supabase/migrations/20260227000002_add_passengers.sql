-- =============================================================================
-- Migration: add_passengers
-- Purpose:   Add passenger management tables (public.passengers and
--            public.customer_passengers) with RLS policies, grants,
--            and an updated_at trigger for PostgREST access.
--
--            Passengers represent individual travellers stored independently of
--            customers. The customer_passengers junction table associates any
--            number of passengers with a customer, with an optional label that
--            describes the relationship (e.g. "self", "spouse", "child").
--
--            Depends on: 20260227000000_add_customers.sql
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.passengers
--
-- One row per traveller profile. Stores identity and travel-document details
-- independently of any customer link so that the same passenger can be shared
-- across multiple customers if needed.
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."passengers" (
    "id"                      uuid                        NOT NULL DEFAULT gen_random_uuid(),
    "full_name"               text                        NOT NULL,
    "date_of_birth"           date,
    "gender"                  text
                              CHECK (gender IN ('male', 'female')),
    "nationality"             text,
    "document_type"           text
                              CHECK (document_type IN ('cpf', 'rg', 'passport', 'other')),
    "document_number"         text,
    "frequent_flyer_airline"  text,
    "frequent_flyer_number"   text,
    "notes"                   text,
    "created_at"              timestamp without time zone          DEFAULT now(),
    "updated_at"              timestamp without time zone          DEFAULT now()
);

ALTER TABLE "public"."passengers" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX passengers_pkey ON public.passengers USING btree (id);

ALTER TABLE "public"."passengers"
    ADD CONSTRAINT "passengers_pkey" PRIMARY KEY USING INDEX "passengers_pkey";

-- -----------------------------------------------------------------------------
-- public.customer_passengers
--
-- Junction table linking customers to their associated passengers.
-- The optional label column describes the relationship from the customer's
-- perspective (e.g. "self", "spouse", "child"). Deleting either side cascades
-- to remove the association row automatically.
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."customer_passengers" (
    "customer_id"  uuid NOT NULL,
    "passenger_id" uuid NOT NULL,
    "label"        text
);

ALTER TABLE "public"."customer_passengers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."customer_passengers"
    ADD CONSTRAINT "customer_passengers_pkey"
    PRIMARY KEY (customer_id, passenger_id);

ALTER TABLE "public"."customer_passengers"
    ADD CONSTRAINT "fk_customer_passengers_customer"
    FOREIGN KEY (customer_id) REFERENCES public.customers (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "public"."customer_passengers"
    VALIDATE CONSTRAINT "fk_customer_passengers_customer";

ALTER TABLE "public"."customer_passengers"
    ADD CONSTRAINT "fk_customer_passengers_passenger"
    FOREIGN KEY (passenger_id) REFERENCES public.passengers (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "public"."customer_passengers"
    VALIDATE CONSTRAINT "fk_customer_passengers_passenger";

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge_app — full access to both tables (the bridge process owns the data)
-- -----------------------------------------------------------------------------

CREATE POLICY "wa_bridge_app_passengers"
    ON "public"."passengers"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "wa_bridge_app_customer_passengers"
    ON "public"."customer_passengers"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- authenticated — full CRUD on both tables (users manage passenger data)
-- -----------------------------------------------------------------------------

CREATE POLICY "authenticated_passengers"
    ON "public"."passengers"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_customer_passengers"
    ON "public"."customer_passengers"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- TABLE-LEVEL GRANTS
-- =============================================================================

-- Bridge application needs full DML on passenger tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."passengers"          TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."customer_passengers" TO "wa_bridge_app";

-- Authenticated users have full CRUD (passenger data is user-managed).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."passengers"          TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."customer_passengers" TO "authenticated";

-- n8n workflows can read passenger data (n8n_app bypasses RLS via role attribute).
GRANT SELECT ON TABLE "public"."passengers"          TO "n8n_app";
GRANT SELECT ON TABLE "public"."customer_passengers" TO "n8n_app";

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- wa_bridge.set_updated_at() already exists (created in add_customers migration).
-- Register it on the passengers table so updated_at stays current on every UPDATE.

CREATE TRIGGER trg_passengers_updated_at
    BEFORE UPDATE ON public.passengers
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.set_updated_at();
