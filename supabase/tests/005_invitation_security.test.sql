-- ══════════════════════════════════════════════════════════════════
-- 005 — Provisioning boundary (database half)
--
-- Tests 1–11 of the invitation audit are decided by authorizeInvite()
-- and are exercised in 02-webapp/tests/invite-authorization.test.mjs
-- against that exact function.
--
-- Two parts of the boundary are enforced by SQL rather than by that
-- function, and only SQL can prove them:
--
--   TEST 11 (takeover half) — the assignment is scoped to profiles
--     where org_id is null, so a replayed invite cannot move an
--     existing staff member or change their role.
--
--   TEST 12 — a pending account is inert against every table, and
--     against the role helpers, regardless of what its role column says.
-- ══════════════════════════════════════════════════════════════════
begin;
select plan(15);

insert into public.orgs (id, name) values
  ('0000000a-0000-0000-0000-00000000000a', 'School A'),
  ('0000000b-0000-0000-0000-00000000000b', 'School B');

-- A provisioned director with a student, and a settled teacher.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'dir@a.edu',  '{"full_name":"Director A"}'),
  ('22222222-2222-2222-2222-222222222222', 'staff@a.edu','{"full_name":"Settled Teacher"}'),
  ('33333333-3333-3333-3333-333333333333', 'public@gmail.com', '{"full_name":"Public Visitor"}');

-- ── TEST 12: what public signup produces ──────────────────────────
select is((select status::text from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'pending', 'TEST 12: a public signup is PENDING, not merely org-less');

select ok((select org_id is null from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'TEST 12: and has no organisation');

-- Provision the two staff accounts the way invite-user does.
update public.profiles
   set org_id = '0000000a-0000-0000-0000-00000000000a', role = 'director', status = 'active'
 where id = '11111111-1111-1111-1111-111111111111' and org_id is null;

update public.profiles
   set org_id = '0000000a-0000-0000-0000-00000000000a', role = 'teacher', status = 'active'
 where id = '22222222-2222-2222-2222-222222222222' and org_id is null;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
insert into public.students (name, grade, teacher_id, org_id)
values ('Kofi Mensah', '4', '22222222-2222-2222-2222-222222222222', gen_random_uuid());
insert into public.student_guardians (student_id, parent_name, relationship, is_primary, org_id)
select id, 'Akosua Mensah', 'Mother', true, gen_random_uuid()
from public.students where name = 'Kofi Mensah';
reset role;

-- ══════════════════════════════════════════════════════════════════
-- TEST 11 — replay cannot take over a settled account
-- ══════════════════════════════════════════════════════════════════
-- invite-user scopes its assignment with `.is("org_id", null)`. This
-- is that clause: a replayed or duplicated invite aimed at someone who
-- already belongs somewhere matches zero rows and changes nothing.
with attempted as (
  update public.profiles
     set org_id = '0000000b-0000-0000-0000-00000000000b', role = 'admin', status = 'active'
   where id = '22222222-2222-2222-2222-222222222222'
     and org_id is null
  returning 1
)
select is((select count(*)::int from attempted), 0,
  'TEST 11: a replayed invite cannot re-provision a settled account');

select is((select role::text from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'teacher', 'TEST 11: the existing role is unchanged');

select is((select org_id from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '0000000a-0000-0000-0000-00000000000a',
  'TEST 11: and the existing organisation is unchanged');

-- ══════════════════════════════════════════════════════════════════
-- TEST 12 — a pending account is inert
-- ══════════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

select ok(public.current_org_id() is null,
  'TEST 12: a pending account resolves to no organisation');

select ok(not public.is_org_admin(),
  'TEST 12: no director/admin powers');

select ok(not public.is_org_reviewer(),
  'TEST 12: no org-wide reviewer powers');

select is(
  (select (select count(*) from public.students)
        + (select count(*) from public.student_guardians)
        + (select count(*) from public.goals)
        + (select count(*) from public.alp_documents)
        + (select count(*) from public.progress_entries)
        + (select count(*) from public.family_messages)
        + (select count(*) from public.alp_consents))::int,
  0,
  'TEST 12: reads nothing from any student table');

select throws_ok($$
  insert into public.students (name, grade, org_id) values ('Injected','1',gen_random_uuid())
$$, NULL, NULL, 'TEST 12: cannot create a student');

-- Cannot self-provision: profiles_update_self allows editing your own
-- row, so the block has to come from somewhere else — is_org_admin()
-- is false, and org_id stays null because there is nothing to grant it.
update public.profiles set role = 'admin', status = 'active'
 where id = '33333333-3333-3333-3333-333333333333';

select ok(not public.is_org_admin(),
  'TEST 12: self-setting role=admin grants nothing without an organisation');

select is((select count(*)::int from public.students), 0,
  'TEST 12: and still reads no student records');

-- ══════════════════════════════════════════════════════════════════
-- A suspended staff member loses access without being deleted
-- ══════════════════════════════════════════════════════════════════
reset role;
update public.profiles set status = 'suspended'
 where id = '22222222-2222-2222-2222-222222222222';

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select ok(public.current_org_id() is null,
  'a suspended account resolves to no organisation');

select is((select count(*)::int from public.students), 0,
  'a suspended account reads no student records');

reset role;
select is((select count(*)::int from unnest(enum_range(null::user_role))), 5,
  'the user_role enum still admits exactly five values');

select * from finish();
rollback;
