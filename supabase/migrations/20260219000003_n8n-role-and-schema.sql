-- =============================================================================
-- Migration: n8n-role-and-schema
-- Purpose:   Create the n8n schema and the n8n_app database role for n8n to
--            use as its backend store and workflow executor.
--            Grant schema-level privileges so n8n can create its own tables,
--            indexes, and sequences at startup, and read WhatsApp data from
--            the wa_bridge schema.
--
--            This must run after the wa_bridge schema exists (i.e. after the
--            roles-and-schemas migration).
-- =============================================================================

-- Schema
CREATE SCHEMA IF NOT EXISTS "n8n";

-- Application role
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n_app') THEN
        CREATE ROLE "n8n_app" WITH LOGIN NOINHERIT;
    END IF;
END
$$;

-- Schema-level USAGE grant
GRANT USAGE ON SCHEMA "n8n" TO "n8n_app";

-- Full control over the n8n schema so n8n can create tables, indexes, etc.
GRANT ALL PRIVILEGES ON SCHEMA "n8n" TO "n8n_app";

-- Default privileges: any objects created in the n8n schema in the future are
-- automatically owned/accessible by n8n_app without further grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA "n8n"
    GRANT ALL PRIVILEGES ON TABLES TO "n8n_app";

ALTER DEFAULT PRIVILEGES IN SCHEMA "n8n"
    GRANT ALL PRIVILEGES ON SEQUENCES TO "n8n_app";

-- wa_bridge access: allow n8n workflows to read WhatsApp data
GRANT USAGE ON SCHEMA "wa_bridge" TO "n8n_app";

GRANT SELECT ON TABLE "wa_bridge"."chats"             TO "n8n_app";
GRANT SELECT ON TABLE "wa_bridge"."contacts"          TO "n8n_app";
GRANT SELECT ON TABLE "wa_bridge"."messages"          TO "n8n_app";
GRANT SELECT ON TABLE "wa_bridge"."outgoing_messages" TO "n8n_app";
