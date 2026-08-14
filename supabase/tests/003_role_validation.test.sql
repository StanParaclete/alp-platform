-- ══════════════════════════════════════════════════════════════════
-- 003 — Role validation and atomic primary-guardian changes
--
-- Covers the four corrections from review:
--   1. An invalid role must REJECT the account, not become a teacher.
--   2. set_primary_guardian must verify the guardian belongs to the
--      student, and scope its final update by both ids.
--   3. The verify/clear/set sequence must be one transaction.
--   4. (copy change — covered by the static scan, not here)
--
-- On concurrency: true two-session interleaving cannot be exercised
-- from inside a single pgTAP transaction. What is tested here is that
-- the operation is one atomic unit and that its failure path changes
-- nothing. The serialisation itself comes from the FOR UPDATE lock in
-- set_primary_guardian(), which is stated rather than proven by this
-- file — a two-session harness would be needed for that.
-- ══════════════════════════════════════════════════════════════════
begin;
select plan(17);

-- ══════════════════════════════════════════════════════════════════
-- 1. Roles cannot be granted except through the invite path
--
-- These assertions moved when handle_new_user stopped reading role
-- from signup metadata (see 004_public_signup). There is no longer a
-- client-supplied role to validate at signup — the field is ignored
-- outright, which is strictly stronger than validating it. What still
-- needs proving is that the enum itself admits only five values, so a
-- server-side assignment cannot invent a sixth.
-- ══════════════════════════════════════════════════════════════════
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'dir@school-a.edu',
   '{"full_name":"Director A","role":"director","school":"School A"}');

insert into public.orgs (id, name) values ('0000000a-0000-0000-0000-00000000000a','School A');

select is((select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'teacher', 'a role in signup metadata is ignored — even a valid one');

select ok((select org_id is null from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'and the account starts unassigned');

-- Server-side assignment, as invite-user performs it.
update public.profiles set org_id = '0000000a-0000-0000-0000-00000000000a', role = 'director', status = 'active'
 where id = '11111111-1111-1111-1111-111111111111';

select is((select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'director', 'the invite path can assign an elevated role');

-- The enum is the backstop: no sixth role can be written at all.
select throws_ok($$
  update public.profiles set role = 'parent' where id = '11111111-1111-1111-1111-111111111111'
$$, '22P02', NULL, 'role="parent" cannot be written even server-side');

select throws_ok($$
  update public.profiles set role = 'student' where id = '11111111-1111-1111-1111-111111111111'
$$, '22P02', NULL, 'role="student" cannot be written even server-side');

select throws_ok($$
  update public.profiles set role = 'family' where id = '11111111-1111-1111-1111-111111111111'
$$, '22P02', NULL, 'role="family" cannot be written even server-side');

select throws_ok($$
  update public.profiles set role = 'random' where id = '11111111-1111-1111-1111-111111111111'
$$, '22P02', NULL, 'an arbitrary role string cannot be written even server-side');

-- All five valid roles.
insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-2222-2222-222222222222','t@a.edu','{}'),
       ('33333333-3333-3333-3333-333333333333','adm@a.edu','{}'),
       ('44444444-4444-4444-4444-444444444444','iv@a.edu','{}'),
       ('55555555-5555-5555-5555-555555555555','rel@a.edu','{}');

update public.profiles set org_id = '0000000a-0000-0000-0000-00000000000a', status = 'active',
  role = case id
    when '22222222-2222-2222-2222-222222222222'::uuid then 'teacher'::user_role
    when '33333333-3333-3333-3333-333333333333'::uuid then 'admin'::user_role
    when '44444444-4444-4444-4444-444444444444'::uuid then 'intervention'::user_role
    else 'related'::user_role end
 where id <> '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.profiles), 5,
  'all five valid roles are assignable');

select set_eq(
  $$ select role::text from public.profiles $$,
  array['director','teacher','admin','intervention','related'],
  'exactly the five canonical roles exist');

select is(
  (select count(*)::int from unnest(enum_range(null::user_role))),
  5, 'the user_role enum admits exactly five values');

-- ══════════════════════════════════════════════════════════════════
-- 2 & 3. set_primary_guardian
-- ══════════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

insert into public.students (name, grade, teacher_id, org_id) values
  ('Kofi Mensah', '4', '22222222-2222-2222-2222-222222222222', gen_random_uuid()),
  ('Ama Boateng', '2', '22222222-2222-2222-2222-222222222222', gen_random_uuid());

insert into public.student_guardians (student_id, parent_name, relationship, is_primary, org_id)
select id, 'Akosua Mensah', 'Mother', true, gen_random_uuid()
from public.students where name = 'Kofi Mensah';

insert into public.student_guardians (student_id, parent_name, relationship, is_primary, org_id)
select id, 'Kwame Mensah', 'Father', false, gen_random_uuid()
from public.students where name = 'Kofi Mensah';

-- A guardian belonging to a DIFFERENT student.
insert into public.student_guardians (student_id, parent_name, relationship, is_primary, org_id)
select id, 'Yaa Boateng', 'Mother', true, gen_random_uuid()
from public.students where name = 'Ama Boateng';

-- ── The cross-student case ────────────────────────────────────────
select throws_ok(
  format($$ select public.set_primary_guardian(%L::uuid, %L::uuid) $$,
    (select id from public.students where name = 'Kofi Mensah'),
    (select id from public.student_guardians where parent_name = 'Yaa Boateng')),
  '23503', NULL,
  'CROSS-STUDENT: a guardian from another student is rejected');

-- And nothing moved. This is the point of doing it in one transaction:
-- the old implementation cleared the primary first and would have left
-- Kofi with no primary contact after a rejected call.
select is(
  (select parent_name from public.student_guardians
   where student_id = (select id from public.students where name = 'Kofi Mensah')
     and is_primary),
  'Akosua Mensah',
  'ATOMIC: a rejected call leaves the existing primary untouched');

select is(
  (select parent_name from public.student_guardians
   where student_id = (select id from public.students where name = 'Ama Boateng')
     and is_primary),
  'Yaa Boateng',
  'ATOMIC: and does not disturb the other student either');

-- ── The valid case ────────────────────────────────────────────────
select lives_ok(
  format($$ select public.set_primary_guardian(%L::uuid, %L::uuid) $$,
    (select id from public.students where name = 'Kofi Mensah'),
    (select id from public.student_guardians where parent_name = 'Kwame Mensah')),
  'a guardian belonging to the student is promoted successfully');

select is(
  (select parent_name from public.student_guardians
   where student_id = (select id from public.students where name = 'Kofi Mensah')
     and is_primary),
  'Kwame Mensah', 'the requested guardian is now primary');

select is(
  (select count(*)::int from public.student_guardians
   where student_id = (select id from public.students where name = 'Kofi Mensah')
     and is_primary),
  1, 'and there is still exactly one primary for that student');

-- A guardian id that does not exist at all.
select throws_ok(
  format($$ select public.set_primary_guardian(%L::uuid, %L::uuid) $$,
    (select id from public.students where name = 'Kofi Mensah'),
    '99999999-9999-9999-9999-999999999999'),
  '23503', NULL,
  'a guardian id that does not exist is rejected');

select * from finish();
rollback;
