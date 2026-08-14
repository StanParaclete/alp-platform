-- ══════════════════════════════════════════════════════════════════
-- 004 — Public signup cannot escalate
--
-- ALP has PUBLIC self-registration: "Sign Up Free" on the landing page
-- calls supabase.auth.signUp(), which is an unauthenticated endpoint.
-- Its `options.data` becomes raw_user_meta_data and is entirely
-- attacker-controlled — anyone can POST any JSON to it.
--
-- An earlier version of handle_new_user() read BOTH role and org_id
-- from that field. A visitor could therefore send
--
--   { "role": "admin", "org_id": "<a real school's uuid>" }
--
-- and receive an admin account inside that school with read access to
-- every student record. That exploit was demonstrated against this
-- schema before the fix; assertions 3–7 below are its regression test.
--
-- The rule now: self-registration always lands UNASSIGNED, and role
-- and organisation are set only by supabase/functions/invite-user,
-- server-side, after the caller is verified as a director or admin.
-- ══════════════════════════════════════════════════════════════════
begin;
select plan(13);

-- ── A real school with a real student ─────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'head@victim.edu',
   '{"full_name":"Head Teacher","role":"director","school":"Victim Primary"}');

-- Provisioned the controlled way: the trigger leaves every account
-- unassigned, so an operator (or the invite function) assigns the org.
insert into public.orgs (id, name, country)
values ('0000aaaa-0000-0000-0000-00000000000a', 'Victim Primary', 'GH');

update public.profiles
   set org_id = '0000aaaa-0000-0000-0000-00000000000a', role = 'director', status = 'active'
 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
insert into public.students (name, grade, teacher_id, org_id)
values ('Confidential Student', '4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', gen_random_uuid());
select set_config('request.jwt.claim.sub', '', true);
reset role;

-- ══════════════════════════════════════════════════════════════════
-- A plain public signup
-- ══════════════════════════════════════════════════════════════════
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'someone@gmail.com',
   '{"full_name":"Public Visitor","school":"My School"}');

select is((select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'teacher', 'a public signup with no role gets the LOWEST role, never director');

select ok((select org_id is null from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'a public signup is UNASSIGNED — no organisation');

-- ══════════════════════════════════════════════════════════════════
-- The exploit, as a regression test
-- ══════════════════════════════════════════════════════════════════
insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'attacker@gmail.com',
   '{"full_name":"Attacker","role":"admin","org_id":"0000aaaa-0000-0000-0000-00000000000a"}');

select is((select role::text from public.profiles where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'teacher', 'EXPLOIT: a forged role="admin" in the signup payload is ignored');

select ok((select org_id is null from public.profiles where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'EXPLOIT: a forged org_id in the signup payload is ignored');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);

select is((select count(*)::int from public.students), 0,
  'EXPLOIT: the attacker can read NO student records');

select is((select count(*)::int from public.student_guardians), 0,
  'EXPLOIT: and no family contact details');

select ok(not public.is_org_admin(),
  'EXPLOIT: and holds no director/admin powers');

select ok(not public.is_org_reviewer(),
  'EXPLOIT: and is not an org-wide reviewer');

-- Every other forged role is equally inert.
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('22222222-2222-2222-2222-222222222222', 'a2@gmail.com', '{"role":"director"}'),
  ('33333333-3333-3333-3333-333333333333', 'a3@gmail.com', '{"role":"intervention"}'),
  ('44444444-4444-4444-4444-444444444444', 'a4@gmail.com', '{"role":"related"}');

select is(
  (select count(*)::int from public.profiles
    where id in ('22222222-2222-2222-2222-222222222222',
                 '33333333-3333-3333-3333-333333333333',
                 '44444444-4444-4444-4444-444444444444')
      and role = 'teacher' and org_id is null),
  3,
  'EXPLOIT: director, intervention and related are all ignored from signup');

-- ══════════════════════════════════════════════════════════════════
-- An unassigned account is inert against every table
-- ══════════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select ok(public.current_org_id() is null,
  'an unassigned account resolves to no organisation');

select is(
  (select (select count(*) from public.students)
        + (select count(*) from public.goals)
        + (select count(*) from public.alp_documents)
        + (select count(*) from public.progress_entries)
        + (select count(*) from public.family_messages)
        + (select count(*) from public.student_guardians))::int,
  0,
  'an unassigned account reads nothing from any student table');

-- It cannot create its own student either: students_insert requires
-- org_id = current_org_id(), and the stamp trigger writes NULL.
select throws_ok($$
  insert into public.students (name, grade, org_id)
  values ('Injected', '1', gen_random_uuid())
$$, NULL, NULL,
  'an unassigned account cannot create a student record');

-- ══════════════════════════════════════════════════════════════════
-- Only the invite path grants a role — modelled here as the
-- service-role write that invite-user performs.
-- ══════════════════════════════════════════════════════════════════
reset role;
update public.profiles
   set org_id = '0000aaaa-0000-0000-0000-00000000000a', role = 'teacher', status = 'active'
 where id = '11111111-1111-1111-1111-111111111111'
   and org_id is null;   -- invite-user scopes its update the same way

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select ok(public.current_org_id() = '0000aaaa-0000-0000-0000-00000000000a',
  'once invited, the account belongs to the inviter''s organisation');

select * from finish();
rollback;
