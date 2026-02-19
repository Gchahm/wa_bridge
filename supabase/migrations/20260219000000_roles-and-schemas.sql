-- =============================================================================
-- Migration: roles-and-schemas
-- Purpose:   Create the wa_bridge schema and the wa_bridge_app database role.
--            Grant schema-level USAGE to all roles that need it.
--
--            This must run before any tables or views are created because both
--            depend on the schema and the role existing first.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS "wa_bridge";

-- -----------------------------------------------------------------------------
-- Application role
--
-- wa_bridge_app is the role used by the Go/Node bridge process.
-- NOINHERIT means it does not automatically inherit privileges from roles it
-- belongs to — privileges must be granted directly.
-- LOGIN allows the bridge process to authenticate as this role.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wa_bridge_app') THEN
        CREATE ROLE "wa_bridge_app" WITH LOGIN NOINHERIT;
    END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Schema-level USAGE grants
--
-- USAGE on a schema lets a role resolve object names within it.
-- It does not grant SELECT/INSERT/etc. on individual tables — those are set
-- separately in the tables migration.
-- -----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA "wa_bridge" TO "wa_bridge_app";

-- The authenticated role (Supabase's built-in role for logged-in users) needs
-- access to both schemas so that views in public can resolve wa_bridge tables.
GRANT USAGE ON SCHEMA "public"    TO "authenticated";
GRANT USAGE ON SCHEMA "wa_bridge" TO "authenticated";
