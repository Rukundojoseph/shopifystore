-- PostgreSQL Row Level Security for tenant isolation.
--
-- The application already scopes every query by store_id on the server
-- (lib/tenants). These policies are a second, database-level wall for
-- deployments where the app (or Supabase PostgREST) connects with a role that
-- is NOT the table owner / does not have BYPASSRLS.
--
-- How it works: the app runs tenant work inside a transaction that sets
--   SET LOCAL app.store_id = '<uuid>';
-- and these policies only expose rows for that store. A platform-admin
-- connection sets app.bypass_rls = 'on'.
--
-- Apply with:  psql "$DIRECT_URL" -f prisma/rls.sql
-- (Run after migrations. Re-runnable.)

CREATE OR REPLACE FUNCTION app_current_store() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.store_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('app.bypass_rls', true), 'off') = 'on' $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'store_members','store_domains','store_settings','categories','products','product_variants',
    'customers','orders','order_items','payments','subscriptions','media'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (app_bypass_rls() OR "storeId" = app_current_store()) WITH CHECK (app_bypass_rls() OR "storeId" = app_current_store())', t);
  END LOOP;
END $$;

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON stores;
CREATE POLICY tenant_isolation ON stores USING (app_bypass_rls() OR id = app_current_store()) WITH CHECK (app_bypass_rls() OR id = app_current_store());

-- payment_events has no storeId; scope through its payment.
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payment_events;
CREATE POLICY tenant_isolation ON payment_events USING (
  app_bypass_rls() OR EXISTS (SELECT 1 FROM payments p WHERE p.id = "paymentId" AND p."storeId" = app_current_store())
);
