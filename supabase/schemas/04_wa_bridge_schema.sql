-- =============================================================================
-- Schema and roles
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS "wa_bridge";

-- Bridge application role (used by the Go process)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wa_bridge_app') THEN
        CREATE ROLE "wa_bridge_app" WITH LOGIN NOINHERIT;
    END IF;
END
$$;

-- Schema-level USAGE grants
GRANT USAGE ON SCHEMA "wa_bridge" TO "wa_bridge_app";
GRANT USAGE ON SCHEMA "public"    TO "authenticated";
GRANT USAGE ON SCHEMA "wa_bridge" TO "authenticated";
