-- =============================================================================
-- n8n schema and role
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS "n8n";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n_app') THEN
        CREATE ROLE "n8n_app" WITH LOGIN NOINHERIT;
    END IF;
END
$$;

GRANT CONNECT, CREATE ON DATABASE postgres TO "n8n_app";

GRANT USAGE ON SCHEMA "n8n" TO "n8n_app";
GRANT ALL PRIVILEGES ON SCHEMA "n8n" TO "n8n_app";

ALTER DEFAULT PRIVILEGES IN SCHEMA "n8n"
    GRANT ALL PRIVILEGES ON TABLES TO "n8n_app";

ALTER DEFAULT PRIVILEGES IN SCHEMA "n8n"
    GRANT ALL PRIVILEGES ON SEQUENCES TO "n8n_app";

-- wa_bridge read access for n8n workflows
GRANT USAGE ON SCHEMA "wa_bridge" TO "n8n_app";

GRANT SELECT ON TABLE "wa_bridge"."chats"             TO "n8n_app";
GRANT SELECT ON TABLE "wa_bridge"."contacts"          TO "n8n_app";
GRANT SELECT ON TABLE "wa_bridge"."messages"          TO "n8n_app";
GRANT SELECT ON TABLE "wa_bridge"."outgoing_messages" TO "n8n_app";
