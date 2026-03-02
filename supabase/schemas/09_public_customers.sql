-- =============================================================================
-- public.customers, public.customer_relationships
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.customers
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."customers" (
    "id"           uuid                        NOT NULL DEFAULT gen_random_uuid(),
    "name"         text                        NOT NULL,
    "email"        text,
    "phone"        text,
    "notes"        text,
    "phone_number" text,
    "created_at"   timestamp without time zone          DEFAULT now(),
    "updated_at"   timestamp without time zone          DEFAULT now()
);

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id);
ALTER TABLE "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY USING INDEX "customers_pkey";

ALTER TABLE "public"."customers"
    ADD CONSTRAINT "fk_customers_contact"
    FOREIGN KEY (phone_number) REFERENCES wa_bridge.contacts (phone_number)
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
ALTER TABLE "public"."customers" VALIDATE CONSTRAINT "fk_customers_contact";

CREATE UNIQUE INDEX idx_customers_phone_number_unique
    ON public.customers (phone_number)
    WHERE phone_number IS NOT NULL;

-- -----------------------------------------------------------------------------
-- public.customer_relationships
-- -----------------------------------------------------------------------------

CREATE TABLE "public"."customer_relationships" (
    "customer_id"         uuid NOT NULL,
    "related_customer_id" uuid NOT NULL,
    "relationship_type"   text NOT NULL
                          CHECK (relationship_type IN ('spouse', 'parent', 'child', 'sibling', 'other'))
);

ALTER TABLE "public"."customer_relationships" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."customer_relationships"
    ADD CONSTRAINT "customer_relationships_pkey"
    PRIMARY KEY (customer_id, related_customer_id);

ALTER TABLE "public"."customer_relationships"
    ADD CONSTRAINT "chk_no_self_relationship"
    CHECK (customer_id != related_customer_id);

ALTER TABLE "public"."customer_relationships"
    ADD CONSTRAINT "fk_customer_relationships_customer"
    FOREIGN KEY (customer_id) REFERENCES public.customers (id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."customer_relationships"
    VALIDATE CONSTRAINT "fk_customer_relationships_customer";

ALTER TABLE "public"."customer_relationships"
    ADD CONSTRAINT "fk_customer_relationships_related"
    FOREIGN KEY (related_customer_id) REFERENCES public.customers (id)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE "public"."customer_relationships"
    VALIDATE CONSTRAINT "fk_customer_relationships_related";

-- =============================================================================
-- RLS
-- =============================================================================

CREATE POLICY "wa_bridge_app_customers"
    ON "public"."customers" AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);
CREATE POLICY "wa_bridge_app_customer_relationships"
    ON "public"."customer_relationships" AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_customers"
    ON "public"."customers" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_customer_relationships"
    ON "public"."customer_relationships" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."customers"              TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."customer_relationships" TO "wa_bridge_app";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."customers"              TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."customer_relationships" TO "authenticated";

GRANT SELECT ON TABLE "public"."customers"              TO "n8n_app";
GRANT SELECT ON TABLE "public"."customer_relationships" TO "n8n_app";

-- =============================================================================
-- Triggers
-- =============================================================================

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
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.set_updated_at();

-- =============================================================================
-- Views
-- =============================================================================

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
FROM public.customers AS cu
LEFT JOIN wa_bridge.contacts AS co ON co.phone_number = cu.phone_number;

GRANT SELECT ON public.customers_with_contact TO authenticated;

CREATE OR REPLACE VIEW public.unlinked_contacts
    WITH (security_invoker = on)
    AS
SELECT c.phone_number, c.push_name, c.last_seen_at
FROM wa_bridge.contacts c
LEFT JOIN public.customers cu ON cu.phone_number = c.phone_number
WHERE cu.id IS NULL
ORDER BY c.last_seen_at DESC NULLS LAST;

GRANT SELECT ON public.unlinked_contacts TO authenticated;
