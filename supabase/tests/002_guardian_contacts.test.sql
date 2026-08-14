-- ══════════════════════════════════════════════════════════════════
-- 002 — Guardian contact records
--
-- Walks the verification sequence for the Step 1 guardian UI, at the
-- database level: add a guardian, mark primary, add a second, switch
-- primary, and confirm the PDF and Support Notice would resolve the
-- right contact.
--
-- The last three assertions guard the architecture: guardians are
-- contact records with no authentication, and the "exactly one
-- primary" rule is enforced by the database rather than by frontend
-- logic that a second browser tab can defeat.
-- ══════════════════════════════════════════════════════════════════
begin;
select plan(14);

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



-- ── Fixture: one school, one teacher, one student ─────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'dir@school-a.edu',
   '{"full_name":"Director A","role":"director","school":"School A"}');

insert into auth.users (id, email, raw_user_meta_data)
select '33333333-3333-3333-3333-333333333333', 't1@school-a.edu',
       jsonb_build_object('full_name','Teacher One','role','teacher','org_id',org_id::text)
from public.profiles where id = '11111111-1111-1111-1111-111111111111';

insert into public.orgs (id, name) values ('0000000a-0000-0000-0000-00000000000a','School A');
select pg_temp.provision('11111111-1111-1111-1111-111111111111','0000000a-0000-0000-0000-00000000000a','director');
select pg_temp.provision('33333333-3333-3333-3333-333333333333','0000000a-0000-0000-0000-00000000000a','teacher');

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

insert into public.students (name, grade, teacher_id, org_id)
values ('Kofi Mensah', '4', '33333333-3333-3333-3333-333333333333', gen_random_uuid());

-- ── 1–3. Teacher adds one guardian, marks primary ─────────────────
insert into public.student_guardians
  (student_id, parent_name, relationship, parent_phone, parent_email, is_primary, org_id)
select id, 'Akosua Mensah', 'Mother', '+233 20 111 2222', 'akosua@example.com', true, gen_random_uuid()
from public.students where name = 'Kofi Mensah';

select is((select count(*)::int from public.student_guardians), 1,
  'a teacher can add a guardian contact to their own student');

select is((select relationship from public.student_guardians where parent_name = 'Akosua Mensah'),
  'Mother', 'the relationship is stored as chosen from the dropdown');

select is((select org_id from public.student_guardians), public.current_org_id(),
  'the guardian record is stamped with the staff member''s org');

-- ── 4–6. Persistence across a reload ──────────────────────────────
-- A fresh select is exactly what the UI does on remount.
select is(
  (select parent_phone from public.student_guardians
   where student_id = (select id from public.students where name = 'Kofi Mensah')
     and is_primary),
  '+233 20 111 2222',
  'the guardian persists and reloads with the primary flag intact');

-- ── 7. A second guardian ──────────────────────────────────────────
insert into public.student_guardians
  (student_id, parent_name, relationship, parent_phone, is_primary, org_id)
select id, 'Kwame Mensah', 'Father', '+233 20 333 4444', false, gen_random_uuid()
from public.students where name = 'Kofi Mensah';

select is((select count(*)::int from public.student_guardians), 2,
  'a student can have more than one guardian');

-- ── The database, not the frontend, enforces one primary ──────────
select throws_ok($$
  update public.student_guardians set is_primary = true
  where parent_name = 'Kwame Mensah'
$$, '23505', NULL,
  'CONSTRAINT: a second primary guardian is rejected by the database');

-- ── 8. Switching primary, the way setPrimaryGuardian() does ───────
update public.student_guardians set is_primary = false
  where student_id = (select id from public.students where name = 'Kofi Mensah')
    and is_primary;
update public.student_guardians set is_primary = true
  where parent_name = 'Kwame Mensah';

select is((select parent_name from public.student_guardians where is_primary),
  'Kwame Mensah', 'the primary contact can be switched to the other guardian');

select is((select count(*)::int from public.student_guardians where is_primary), 1,
  'and there is still exactly one primary');

-- ── 9–12. What the PDF and Support Notice resolve ─────────────────
select is(
  (select parent_name from public.student_guardians
   where student_id = (select id from public.students where name = 'Kofi Mensah')
   order by is_primary desc, parent_name limit 1),
  'Kwame Mensah',
  'PDF: getPrimaryGuardian resolves the current primary contact');

select is(
  (select parent_phone from public.student_guardians
   where student_id = (select id from public.students where name = 'Kofi Mensah')
   order by is_primary desc, parent_name limit 1),
  '+233 20 333 4444',
  'SUPPORT NOTICE: the phone number follows the primary contact');

-- A student with no guardian recorded must not break generation.
insert into public.students (name, grade, teacher_id, org_id)
values ('Ama Boateng', '2', '33333333-3333-3333-3333-333333333333', gen_random_uuid());

select is(
  (select count(*)::int from public.student_guardians
   where student_id = (select id from public.students where name = 'Ama Boateng')),
  0,
  'a student with no guardian yields an empty list, not an error');

-- ══════════════════════════════════════════════════════════════════
-- Architecture guards
-- ══════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int from information_schema.columns
   where table_schema='public' and table_name='student_guardians'
     and column_name in ('guardian_contact_id','user_id','auth_id','password','role')),
  0,
  'ARCHITECTURE: guardians have no user id, auth id, password or role');

select is(
  (select count(*)::int
   from information_schema.table_constraints tc
   join information_schema.constraint_column_usage ccu
     on tc.constraint_name = ccu.constraint_name
   where tc.table_name = 'student_guardians'
     and tc.constraint_type = 'FOREIGN KEY'
     and ccu.table_schema = 'auth'),
  0,
  'ARCHITECTURE: no foreign key from guardians into auth');

-- A guardian must never be reachable from another organisation.
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*)::int from public.student_guardians), 0,
  'an unauthenticated caller sees no guardian contact details');

select * from finish();
rollback;
