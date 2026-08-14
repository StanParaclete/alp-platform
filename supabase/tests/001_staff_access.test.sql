-- ══════════════════════════════════════════════════════════════════
-- 001 — Staff-only access model
--
--   supabase test db      (or ./supabase/tests/run-local.sh)
--
-- These policies are the only barrier between a public anon key and
-- every student record on the platform. A failure here is a breach,
-- not a broken test.
--
-- The assertions at the end enforce the June 2026 product decision:
-- there is no parent role and no guardian login. They exist to make
-- reintroducing one a deliberate act that turns CI red, rather than
-- something that creeps back in a merge.
-- ══════════════════════════════════════════════════════════════════
begin;
select plan(19);

-- ── Controlled provisioning ───────────────────────────────────────
-- handle_new_user deliberately ignores role and org_id from signup
-- metadata (they are attacker-controlled — see 004_public_signup).
-- Every account therefore starts unassigned, and role/org are set
-- server-side. These fixtures do exactly what invite-user does with
-- the service role key.
create or replace function pg_temp.provision(
  p_user uuid, p_org uuid, p_role user_role
) returns void language sql as $$
  update public.profiles set org_id = p_org, role = p_role, status = 'active' where id = p_user;
$$;



-- ── Fixture ───────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'dir.a@school-a.edu',
   '{"full_name":"Director A","role":"director","school":"School A"}'),
  ('22222222-2222-2222-2222-222222222222', 'dir.b@school-b.edu',
   '{"full_name":"Director B","role":"director","school":"School B"}');

insert into auth.users (id, email, raw_user_meta_data)
select unnest(array['33333333-3333-3333-3333-333333333333',
                    '44444444-4444-4444-4444-444444444444',
                    '55555555-5555-5555-5555-555555555555'])::uuid,
       unnest(array['t1@school-a.edu','t2@school-a.edu','slp@school-a.edu']),
       jsonb_build_object('org_id', org_id::text) ||
       jsonb_build_object('role',      unnest(array['teacher','teacher','related'])) ||
       jsonb_build_object('full_name', unnest(array['Teacher One','Teacher Two','Speech Therapist']))
from public.profiles where id = '11111111-1111-1111-1111-111111111111';

-- ── Signup trigger ────────────────────────────────────────────────
select is((select count(*)::int from public.profiles), 5,
  'handle_new_user creates a profile for every auth user');

select is((select count(*)::int from public.profiles where org_id is null), 5,
  'every account starts UNASSIGNED — signup metadata cannot grant an org');

-- Now provision them the controlled way.
insert into public.orgs (id, name) values
  ('0000000a-0000-0000-0000-00000000000a', 'School A'),
  ('0000000b-0000-0000-0000-00000000000b', 'School B');

select pg_temp.provision('11111111-1111-1111-1111-111111111111','0000000a-0000-0000-0000-00000000000a','director');
select pg_temp.provision('22222222-2222-2222-2222-222222222222','0000000b-0000-0000-0000-00000000000b','director');
select pg_temp.provision('33333333-3333-3333-3333-333333333333','0000000a-0000-0000-0000-00000000000a','teacher');
select pg_temp.provision('44444444-4444-4444-4444-444444444444','0000000a-0000-0000-0000-00000000000a','teacher');
select pg_temp.provision('55555555-5555-5555-5555-555555555555','0000000a-0000-0000-0000-00000000000a','related');

select is(
  (select p.org_id from public.profiles p where p.id = '33333333-3333-3333-3333-333333333333'),
  (select p.org_id from public.profiles p where p.id = '11111111-1111-1111-1111-111111111111'),
  'an invited teacher lands in the inviter''s org');

-- ── Teacher One: caseload, guardian record, consent ───────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

-- The forged org_id is the point: a hostile client can send anything,
-- and the stamp trigger must overwrite it.
insert into public.students (name, grade, teacher_id, org_id)
values ('Kofi Mensah', '4', '33333333-3333-3333-3333-333333333333', gen_random_uuid());

insert into public.goals (student_id, goal_text, org_id)
select id, 'Read 80 wcpm by May', gen_random_uuid()
from public.students where name = 'Kofi Mensah';

insert into public.student_guardians (student_id, parent_name, parent_email, relationship, is_primary, org_id)
select id, 'Akosua Mensah', 'akosua@example.com', 'mother', true, gen_random_uuid()
from public.students where name = 'Kofi Mensah';

insert into public.alp_consents (student_id, decision, method, sent_at, org_id)
select id, 'pending', 'email', now(), gen_random_uuid()
from public.students where name = 'Kofi Mensah';

select is(
  (select org_id from public.students where name = 'Kofi Mensah'),
  public.current_org_id(),
  'a client-supplied org_id is overwritten by the caller''s real org');

select is((select parent_name from public.student_guardians), 'Akosua Mensah',
  'staff can record a guardian as a contact record');

select is((select org_id from public.student_guardians), public.current_org_id(),
  'guardian records are stamped with the staff member''s org');

-- ── Teacher Two: same org, different caseload ─────────────────────
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

insert into public.students (name, grade, teacher_id, org_id)
values ('Ama Boateng', '2', '44444444-4444-4444-4444-444444444444', gen_random_uuid());

select is((select count(*)::int from public.students), 1,
  'a teacher sees only their own caseload');

select is((select count(*)::int from public.goals), 0,
  'a teacher cannot read another teacher''s student goals');

select is((select count(*)::int from public.student_guardians), 0,
  'a teacher cannot read guardian contacts for another teacher''s student');

-- ── Related Services: org-wide reviewer ───────────────────────────
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);

select is((select count(*)::int from public.students), 2,
  'related services staff see every student in their org');

select is((select count(*)::int from public.student_guardians), 1,
  'and the guardian contacts they need in order to make contact');

-- ── Director A ────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is((select count(*)::int from public.students), 2,
  'a director sees every student in their org');

-- ── Cross-tenant ──────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select is((select count(*)::int from public.students), 0,
  'CROSS-TENANT: another school''s director sees no students');

select is((select count(*)::int from public.student_guardians), 0,
  'CROSS-TENANT: and no family contact details');

with attempted as (update public.students set name = 'HACKED' returning 1)
select is((select count(*)::int from attempted), 0,
  'CROSS-TENANT: and cannot modify these rows');

-- ── Unauthenticated ───────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '', true);

select is((select count(*)::int from public.students), 0,
  'an unauthenticated caller sees no students');

select is((select count(*)::int from public.student_guardians), 0,
  'an unauthenticated caller sees no family contact details');

-- ══════════════════════════════════════════════════════════════════
-- The staff-only decision, enforced
--
-- Parent and student logins were removed in June 2026. These two
-- assertions make bringing one back a deliberate act that fails CI,
-- rather than something that reappears quietly in a merge.
-- ══════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int from unnest(enum_range(null::user_role)) e
   where e::text in ('parent','student','family','guardian')),
  0,
  'DECISION: user_role contains no parent/student/family role');

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'student_guardians'
     and column_name in ('guardian_id','user_id','auth_id')),
  0,
  'DECISION: guardians are contact records, not linked user accounts');

select * from finish();
rollback;
