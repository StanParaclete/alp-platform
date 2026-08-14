-- ══════════════════════════════════════════════════════════════════
-- ALP Platform — Role grants
--
-- A hosted Supabase project sets default privileges that grant new
-- public tables to anon / authenticated / service_role automatically,
-- so this is a no-op there. It matters everywhere else: CI runners,
-- a local Postgres, or a self-hosted Supabase. Without it the schema
-- applies cleanly and then every query fails with "permission denied",
-- which looks like an RLS bug and is not one.
--
-- Grants are not a security boundary here — RLS is. These roles can
-- reach the tables; the policies decide which rows.
-- ══════════════════════════════════════════════════════════════════

do $$ begin create role anon;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role;  exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables    in schema public to authenticated;
grant usage,  select                 on all sequences in schema public to authenticated;
grant execute                        on all functions in schema public to authenticated;

-- service_role is used only by Edge Functions holding the service key.
-- It bypasses RLS by design, which is why invite-user re-checks org
-- membership in application code before it writes anything.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- anon deliberately gets nothing beyond schema usage. Every table in
-- this schema holds student data; there is no anonymous read surface.

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
