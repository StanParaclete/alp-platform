-- ══════════════════════════════════════════════════════════════════
-- ALP Platform — profiles privilege guard
--
-- FIXES a self-escalation hole found by uat/tenant-isolation-probe.mjs
-- (layer 4, probe E1) on 14 Aug 2026.
--
-- THE HOLE
-- profiles_update_self reads:
--
--   for update using (id = auth.uid()) with check (id = auth.uid())
--
-- The WITH CHECK constrains WHICH ROW may be written. It does not
-- constrain WHAT may be written into it. So any authenticated user
-- could send:
--
--   PATCH /rest/v1/profiles?id=eq.<their own id>
--   { "role": "admin", "org_id": "<another school's uuid>" }
--
-- and it succeeded — the row still satisfied id = auth.uid(). Because
-- current_org_id() reads org_id straight off this row, the caller then
-- saw every student, guardian and audit record in the school they
-- pointed themselves at. One request, full tenant boundary bypass.
--
-- This is the SAME class as the original vulnerability: a
-- client-supplied organisation identifier becoming authorization. That
-- was closed at signup (handle_new_user ignores auth metadata) and at
-- invitation (invite-user derives role and org server-side). This was
-- the third door and it was never shut.
--
-- WHY A TRIGGER RATHER THAN A BETTER POLICY
-- An RLS policy cannot see OLD. It can say "the new role must be X",
-- but not "the new role must equal the old role". Immutability is a
-- comparison between two versions of the row, so it belongs in a
-- BEFORE UPDATE trigger. Tightening the policy instead would mean
-- hard-coding a role, which breaks legitimate admin edits.
--
-- WHY IT DOES NOT BREAK THE APP
-- The only profile write in the client is upsertProfile(), which sends
-- full_name, school and updated_at. None of those are touched here.
--
-- Idempotent — safe to re-run.
-- ══════════════════════════════════════════════════════════════════

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
-- Deliberately SECURITY INVOKER. current_user must remain the role
-- PostgREST switched to, so the service_role check below is real. A
-- SECURITY DEFINER function would report the owner instead and the
-- check would never match.
as $$
begin
  -- ── Anything that is not a browser client ───────────────────────
  -- PostgREST switches to exactly two roles for requests carrying a
  -- client key: `authenticated` for a signed-in user and `anon` for
  -- none. Those are the only roles an attacker can reach, so those are
  -- the only roles this guard applies to.
  --
  -- Everything else is server-side and must pass through untouched:
  --   service_role  — invite-user provisioning, the ONE intended path
  --                   for a privilege change
  --   postgres      — migrations, psql, and the pgTAP suite, whose
  --                   fixtures provision staff exactly as invite-user
  --                   does (see supabase/tests/*.test.sql)
  --
  -- Listing the guarded roles rather than the exempt ones was the
  -- original shape of this check, and it silently reverted every test
  -- fixture: the suite ran green while provisioning nothing.
  --
  -- If a new client-facing database role is ever introduced, it must be
  -- added here or it will not be guarded.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- ── Administrators, inside their own school ─────────────────────
  -- A director or admin may change a colleague's role or suspend them.
  -- They may NOT move anyone — themselves included — into a different
  -- organisation, which is the boundary this whole file protects.
  if public.is_org_admin()
     and old.org_id is not distinct from public.current_org_id()
     and new.org_id is not distinct from old.org_id
  then
    return new;
  end if;

  -- ── Everyone else ───────────────────────────────────────────────
  -- Privileged columns are frozen to their existing values. The write
  -- is not rejected: full_name, school and avatar_url still save, so a
  -- teacher editing their display name sees it work. Only the
  -- privilege fields are silently reverted, which is the behaviour the
  -- signup trigger already has for the same fields.
  new.role       := old.role;
  new.org_id     := old.org_id;
  new.status     := old.status;
  new.invited_by := old.invited_by;
  new.id         := old.id;
  return new;
end $$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

comment on function public.guard_profile_privileges() is
  'Freezes role/org_id/status against client writes. Closes the profiles '
  'self-escalation path; see uat/tenant-isolation-probe.mjs layer 4 probe E1.';
