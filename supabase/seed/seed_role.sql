-- Set local-dev password for wa_bridge_app role
-- This runs after migrations during `supabase db reset`
ALTER ROLE wa_bridge_app PASSWORD 'postgres';
