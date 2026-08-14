-- ══════════════════════════════════════════════════════════════════
-- ALP — verify the profiles privilege guard, from the SQL Editor
--
-- Paste into Supabase → SQL Editor → New query → Run.
--
-- Same attacks as uat/verify-privilege-guard.mjs, for the browser-only
-- path. Node is not required.
--
-- WHAT IT DOES
-- Impersonates a real teacher account by setting the same JWT claims
-- PostgREST sets, so RLS and the trigger behave exactly as they do for
-- a request from the app. It then attempts each forged write and checks
-- the row afterwards.
--
-- Everything happens inside a transaction that is ROLLED BACK at the
-- end, so nothing is left changed even if the guard is missing.
--
-- BEFORE RUNNING
-- Replace the two values in the `params` block below:
--   teacher_email — a plain teacher account (NOT a director or admin;
--                   admins are allowed to change roles in their own
--                   school, so the result would prove nothing)
--   other_org     — any organisation the teacher is not in
--
-- HONEST CAVEAT
-- Unlike verify-privilege-guard.mjs, this file has NOT been executed
-- against a running Postgres — there was none available when it was
-- written. It has been reviewed, not proven. The .mjs script is the
-- verified one; run this only if you are staying browser-only, and
-- treat an unexpected error as a bug in this file rather than a finding
-- about your database.
--
-- HOW TO READ THE OUTPUT
-- One row per check, with a `verdict` column. Every row must say PASS.
-- Any FAIL means the guard is not in place and UAT must not start.
-- ══════════════════════════════════════════════════════════════════

begin;

-- ── Pick the accounts ──────────────────────────────────────────────
create temporary table params on commit drop as
select
  (select id from public.profiles
    where email = 'teacher.a@school-a.edu'          -- ← EDIT THIS
    limit 1)                                    as teacher_id,
  (select id from public.orgs
    where name = 'School B'                          -- ← EDIT THIS
    limit 1)                                    as other_org;

do $$
declare p record;
begin
  select * into p from params;
  if p.teacher_id is null then
    raise exception 'No profile found for that email. Edit the params block.';
  end if;
  if p.other_org is null then
    raise exception 'No organisation found by that name. Edit the params block.';
  end if;
  if (select role from public.profiles where id = p.teacher_id) in ('admin','director') then
    raise exception 'That account is a % — use a plain teacher, or the result proves nothing.',
      (select role from public.profiles where id = p.teacher_id);
  end if;
  if (select org_id from public.profiles where id = p.teacher_id) = p.other_org then
    raise exception 'The teacher is already in that organisation. Pick a different one.';
  end if;
end $$;

-- ── Snapshot the starting state ────────────────────────────────────
create temporary table baseline on commit drop as
select id, role, org_id, status, full_name, school, invited_by
  from public.profiles
 where id = (select teacher_id from params);

-- ── Become that teacher ────────────────────────────────────────────
-- These are the same settings PostgREST applies to a request carrying
-- the teacher's JWT, so RLS and the trigger see exactly what they would
-- see in production.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select teacher_id from params), 'role', 'authenticated')::text,
  true);

-- ── The attacks ────────────────────────────────────────────────────
-- Each runs on its own. A later write could otherwise mask an earlier
-- one by putting a value back.

-- 1. The full escalation
update public.profiles
   set role = 'admin', org_id = (select other_org from params)
 where id = (select teacher_id from params);

create temporary table after_1 on commit drop as
select role, org_id, status from public.profiles where id = (select teacher_id from params);

-- 2. Privilege only
update public.profiles set role = 'director'
 where id = (select teacher_id from params);

create temporary table after_2 on commit drop as
select role, org_id, status from public.profiles where id = (select teacher_id from params);

-- 3. Tenancy only
update public.profiles set org_id = (select other_org from params)
 where id = (select teacher_id from params);

create temporary table after_3 on commit drop as
select role, org_id, status from public.profiles where id = (select teacher_id from params);

-- 4. The quiet ones
update public.profiles
   set status = 'active', invited_by = (select teacher_id from params)
 where id = (select teacher_id from params);

create temporary table after_4 on commit drop as
select role, org_id, status from public.profiles where id = (select teacher_id from params);

-- 5. Legitimate fields — these MUST still work
update public.profiles set full_name = 'guard check', school = 'guard check'
 where id = (select teacher_id from params);

create temporary table after_5 on commit drop as
select full_name, school, role from public.profiles where id = (select teacher_id from params);

-- 6. Mixed request — safe field lands, forged field does not
update public.profiles set full_name = 'guard check mixed', role = 'admin'
 where id = (select teacher_id from params);

create temporary table after_6 on commit drop as
select full_name, role from public.profiles where id = (select teacher_id from params);

-- ── What the teacher can now see ───────────────────────────────────
create temporary table access_check on commit drop as
select
  count(*) filter (where s.org_id <> b.org_id) as foreign_students,
  count(*)                                     as visible_students
  from public.students s
 cross join baseline b;

reset role;

-- ── Results ────────────────────────────────────────────────────────
select check_name, detail,
       case when ok then 'PASS' else 'FAIL' end as verdict
from (
  select 1 as n, 'attack 1: role=admin + org_id=other' as check_name,
         (a.role = b.role and a.org_id is not distinct from b.org_id) as ok,
         format('role %s, org %s', a.role, a.org_id) as detail
    from after_1 a cross join baseline b
  union all
  select 2, 'attack 2: role=director',
         (a.role = b.role and a.org_id is not distinct from b.org_id),
         format('role %s', a.role)
    from after_2 a cross join baseline b
  union all
  select 3, 'attack 3: org_id=other',
         (a.role = b.role and a.org_id is not distinct from b.org_id),
         format('org %s', a.org_id)
    from after_3 a cross join baseline b
  union all
  select 4, 'attack 4: status + invited_by',
         (a.status = b.status and a.role = b.role),
         format('status %s', a.status)
    from after_4 a cross join baseline b
  union all
  select 5, 'legitimate: full_name and school still save',
         (a.full_name = 'guard check' and a.school = 'guard check'),
         format('full_name %s, school %s', a.full_name, a.school)
    from after_5 a
  union all
  select 6, 'mixed request: safe field saved, forged field dropped',
         (a.full_name = 'guard check mixed' and a.role = b.role),
         format('full_name %s, role %s', a.full_name, a.role)
    from after_6 a cross join baseline b
  union all
  select 7, 'consequence: no foreign students visible',
         (c.foreign_students = 0),
         format('%s visible, %s foreign', c.visible_students, c.foreign_students)
    from access_check c
  union all
  select 8, 'the guard trigger exists',
         exists (select 1 from pg_trigger
                  where tgname = 'profiles_guard_privileges' and not tgisinternal),
         'profiles_guard_privileges on public.profiles'
) r
order by n;

-- Nothing above is kept. Every write is discarded here.
rollback;
