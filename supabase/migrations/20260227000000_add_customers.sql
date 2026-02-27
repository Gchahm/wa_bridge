-- =============================================================================
-- Migration: add_customers
-- Purpose:   Add customer management tables (wa_bridge.customers and
--            wa_bridge.customer_relationships) with RLS policies, grants,
--            an updated_at trigger, and public views for PostgREST access.
--
--            Customers can optionally be linked to a WhatsApp contact via
--            phone_number FK, giving the frontend a way to correlate CRM
--            records with live chat sessions.
--
--            Depends on: 20260219000001_tables.sql
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge.customers
--
-- One row per CRM customer. Optionally linked to a wa_bridge.contacts row
-- via phone_number so that WhatsApp conversations can be associated with a
-- known customer. The link is 1:1 enforced by a unique partial index.
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."customers" (
    "id"           uuid                        NOT NULL DEFAULT gen_random_uuid(),
    "name"         text                        NOT NULL,
    "email"        text,
    "phone"        text,
    "notes"        text,
    "phone_number" text,
    "created_at"   timestamp without time zone          DEFAULT now(),
    "updated_at"   timestamp without time zone          DEFAULT now()
);

ALTER TABLE "wa_bridge"."customers" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX customers_pkey ON wa_bridge.customers USING btree (id);

ALTER TABLE "wa_bridge"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY USING INDEX "customers_pkey";

-- phone_number is an optional FK to wa_bridge.contacts (bare JID, digits only).
-- ON DELETE SET NULL keeps the customer record if the contact is removed.
-- ON UPDATE CASCADE keeps the link intact if the phone number value is corrected.
ALTER TABLE "wa_bridge"."customers"
    ADD CONSTRAINT "fk_customers_contact"
    FOREIGN KEY (phone_number) REFERENCES wa_bridge.contacts (phone_number)
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
ALTER TABLE "wa_bridge"."customers" VALIDATE CONSTRAINT "fk_customers_contact";

-- Enforce a 1:1 mapping: a WhatsApp contact can be linked to at most one
-- customer. The partial index ignores NULL phone_number rows so that multiple
-- customers can remain unlinked.
CREATE UNIQUE INDEX idx_customers_phone_number_unique
    ON wa_bridge.customers (phone_number)
    WHERE phone_number IS NOT NULL;

-- -----------------------------------------------------------------------------
-- wa_bridge.customer_relationships
--
-- Symmetric relationship graph between customers (e.g. family members).
-- Each directed pair (customer_id, related_customer_id) is a distinct row;
-- the application layer is responsible for inserting both directions if a
-- symmetric representation is desired.
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."customer_relationships" (
    "customer_id"         uuid NOT NULL,
    "related_customer_id" uuid NOT NULL,
    "relationship_type"   text NOT NULL
                          CHECK (relationship_type IN ('spouse', 'parent', 'child', 'sibling', 'other'))
);

ALTER TABLE "wa_bridge"."customer_relationships" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "wa_bridge"."customer_relationships"
    ADD CONSTRAINT "customer_relationships_pkey"
    PRIMARY KEY (customer_id, related_customer_id);

-- A customer cannot have a relationship with themselves.
ALTER TABLE "wa_bridge"."customer_relationships"
    ADD CONSTRAINT "chk_no_self_relationship"
    CHECK (customer_id != related_customer_id);

ALTER TABLE "wa_bridge"."customer_relationships"
    ADD CONSTRAINT "fk_customer_relationships_customer"
    FOREIGN KEY (customer_id) REFERENCES wa_bridge.customers (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "wa_bridge"."customer_relationships"
    VALIDATE CONSTRAINT "fk_customer_relationships_customer";

ALTER TABLE "wa_bridge"."customer_relationships"
    ADD CONSTRAINT "fk_customer_relationships_related"
    FOREIGN KEY (related_customer_id) REFERENCES wa_bridge.customers (id)
    ON DELETE CASCADE
    NOT VALID;
ALTER TABLE "wa_bridge"."customer_relationships"
    VALIDATE CONSTRAINT "fk_customer_relationships_related";

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge_app — full access to both tables (the bridge process owns the data)
-- -----------------------------------------------------------------------------

CREATE POLICY "wa_bridge_app_customers"
    ON "wa_bridge"."customers"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "wa_bridge_app_customer_relationships"
    ON "wa_bridge"."customer_relationships"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- authenticated — full CRUD on both tables (users manage customer data)
-- -----------------------------------------------------------------------------

CREATE POLICY "authenticated_customers"
    ON "wa_bridge"."customers"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_customer_relationships"
    ON "wa_bridge"."customer_relationships"
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- TABLE-LEVEL GRANTS
-- =============================================================================

-- Bridge application needs full DML on customer tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."customers"              TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."customer_relationships" TO "wa_bridge_app";

-- Authenticated users have full CRUD (CRM data is user-managed).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."customers"              TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."customer_relationships" TO "authenticated";

-- n8n workflows can read customer data (n8n_app bypasses RLS via role attribute).
GRANT SELECT ON TABLE "wa_bridge"."customers"              TO "n8n_app";
GRANT SELECT ON TABLE "wa_bridge"."customer_relationships" TO "n8n_app";

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge.set_updated_at — reusable trigger function
--
-- Sets the updated_at column to now() before any UPDATE. Defined once in the
-- wa_bridge schema and reused by all tables that carry an updated_at column.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION wa_bridge.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON wa_bridge.customers
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.set_updated_at();

-- =============================================================================
-- VIEWS (public schema)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.customers — direct projection of wa_bridge.customers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.customers
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.customers;

-- -----------------------------------------------------------------------------
-- public.customer_relationships — direct projection of wa_bridge.customer_relationships
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.customer_relationships
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.customer_relationships;

-- -----------------------------------------------------------------------------
-- public.customers_with_contact
--
-- Extends customers with WhatsApp presence data from the linked contact row.
-- wa_push_name  — the display name the contact has set on WhatsApp.
-- wa_last_seen_at — the last time the bridge saw a message from this contact.
--
-- Rows without a phone_number link still appear (LEFT JOIN) with NULL for the
-- wa_* columns.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.customers_with_contact
    WITH (security_invoker = on)
    AS
SELECT
    cu.id,
    cu.name,
    cu.email,
    cu.phone,
    cu.notes,
    cu.phone_number,
    cu.created_at,
    cu.updated_at,
    co.push_name  AS wa_push_name,
    co.last_seen_at AS wa_last_seen_at
FROM wa_bridge.customers AS cu
LEFT JOIN wa_bridge.contacts AS co ON co.phone_number = cu.phone_number;

-- =============================================================================
-- VIEW GRANTS
-- =============================================================================

-- Authenticated users have full CRUD through the pass-through views; the
-- underlying table grants and RLS policies are the effective security boundary.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_relationships TO authenticated;

-- customers_with_contact is read-only (it joins two tables; mutations should
-- target public.customers directly).
GRANT SELECT ON public.customers_with_contact TO authenticated;
