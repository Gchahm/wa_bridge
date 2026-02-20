CREATE SCHEMA IF NOT EXISTS wa_meow;
CREATE SCHEMA IF NOT EXISTS wa_bridge;

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wa_bridge_app') THEN
            CREATE ROLE "wa_bridge_app" WITH LOGIN NOINHERIT;
        END IF;
    END
$$;

ALTER ROLE wa_bridge_app SET search_path TO wa_meow;


GRANT ALL ON SCHEMA wa_bridge TO wa_bridge_app;
GRANT ALL ON ALL TABLES IN SCHEMA wa_bridge TO wa_bridge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA wa_bridge GRANT ALL ON TABLES TO wa_bridge_app;


GRANT ALL ON SCHEMA wa_meow TO wa_bridge_app;
GRANT ALL ON ALL TABLES IN SCHEMA wa_meow TO wa_bridge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA wa_meow GRANT ALL ON TABLES TO wa_bridge_app;

-- The authenticated role (Supabase's built-in role for logged-in users) needs
-- access to both schemas so that views in public can resolve wa_bridge tables.
GRANT USAGE ON SCHEMA wa_bridge TO authenticated;
