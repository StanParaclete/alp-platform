-- ══════════════════════════════════════════════════════════════════
-- ALP — COMPLETE SCHEMA, single paste
--
-- Both migrations combined so this is ONE paste into the Supabase SQL
-- Editor rather than two, removing the chance of running them out of
-- order (grants before tables silently grants nothing).
--
--   Supabase Dashboard → SQL Editor → New query → paste all → Run
--
-- Safe to run more than once: every statement is idempotent, so a
-- re-run after a partial failure will not error or duplicate anything.
--
-- Expect "Success. No rows returned" — this creates objects, it does
-- not select. Then run the verification queries at the bottom.
--
-- Source of truth remains supabase/migrations/. This file is generated
-- from those two; edit them, not this.
-- ══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
-- ALP Platform — Initial Schema  (staff-only model)
--
-- Creates every table src/supabase.js queries, plus the
-- on_auth_user_created trigger that supabase/functions/invite-user
-- depends on. The repo currently ships no SQL at all: the only schema
-- in it is 05-backend/prisma/schema.prisma, which belongs to the
-- separate Express backend and is not what the web app talks to.
--
-- ── Access model ──────────────────────────────────────────────────
-- FIVE authenticated roles, all staff:
--   admin           Administrator
--   director        Leadership / Director
--   teacher         Teacher
--   intervention    Intervention Specialist
--   related Related Services
--
-- Parents and guardians DO NOT have accounts. They are contact records
-- owned by staff. The communication path is:
--   staff completes ALP → director approves → PDF → print/email to family
--
-- There is deliberately no `parent` role, no guardian login and no
-- policy granting anyone outside the org access to a student record.
-- If a parent portal is ever wanted, it is a new decision, not a gap.
--
-- Run: supabase db push   (or paste into Supabase → SQL Editor)
-- ══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum
    ('teacher','director','admin','intervention','related');
exception when duplicate_object then null; end $$;

-- "Belongs to no school yet" and "provisioned as a teacher" are
-- different states. Without this they are both (role='teacher',
-- org_id=null) and only the null org distinguishes them — which is a
-- silent invariant that one careless default would erase.
do $$ begin
  create type account_status as enum ('pending','active','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alp_status as enum
    ('draft','in_review','changes_requested','approved','archived');
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════════════
-- ORGANISATIONS — the tenant boundary
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  country     text default 'GH',
  plan        text default 'free',
  created_at  timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════════
-- PROFILES — one row per auth.users row, created by trigger below
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid references public.orgs(id) on delete set null,
  email       text,
  full_name   text,
  role        user_role not null default 'teacher',
  -- Every account starts pending. Only server-side provisioning
  -- (supabase/functions/invite-user) moves it to active, and it sets
  -- org_id in the same statement.
  status      account_status not null default 'pending',
  school      text,
  avatar_url  text,
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_org_idx  on public.profiles(org_id);
create index if not exists profiles_role_idx on public.profiles(org_id, role);

-- ══════════════════════════════════════════════════════════════════
-- RLS HELPERS
-- SECURITY DEFINER so they read profiles WITHOUT triggering profiles'
-- own RLS policy — otherwise every lookup recurses into the policy
-- that called it.
-- ══════════════════════════════════════════════════════════════════
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  -- status must be active, not merely org_id non-null. Two independent
  -- conditions, so a future bug that sets one does not silently grant
  -- access on its own.
  select org_id from public.profiles
   where id = auth.uid() and status = 'active'
$$;

create or replace function public.current_user_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Roles that may see every student in their own org, not just a caseload.
create or replace function public.is_org_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.profiles
      where id = auth.uid() and status = 'active' and org_id is not null)
      in ('director','admin','intervention','related'),
    false)
$$;

create or replace function public.is_org_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.profiles
      where id = auth.uid() and status = 'active' and org_id is not null)
      in ('director','admin'),
    false)
$$;

-- ══════════════════════════════════════════════════════════════════
-- STUDENTS
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.students (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.orgs(id) on delete cascade,
  teacher_id               uuid references public.profiles(id) on delete set null,
  name                     text not null,
  student_code             text,
  dob                      date,
  grade                    text,
  disability               text,
  plan_type                text default 'ALP',
  alp_status               alp_status not null default 'draft',
  submitted_for_review_at  timestamptz,
  submitted_by             uuid references public.profiles(id) on delete set null,
  approved_at              timestamptz,
  approved_by              uuid references public.profiles(id) on delete set null,
  review_decision_notes    text,
  archived_at              timestamptz,
  archived_by              uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists students_org_idx     on public.students(org_id);
create index if not exists students_teacher_idx on public.students(org_id, teacher_id);
create index if not exists students_status_idx  on public.students(org_id, alp_status);
create unique index if not exists students_code_uniq
  on public.students(org_id, student_code) where student_code is not null;

-- ══════════════════════════════════════════════════════════════════
-- GUARDIANS — staff-managed contact records. NOT user accounts.
--
-- A separate table rather than parent_name/parent_email columns on
-- students, for one reason: a child frequently has two guardians who
-- must both be contacted — separated parents, a grandparent, a foster
-- carer. Columns force the second one into a free-text note and it
-- stops being usable for addressing a PDF.
--
-- `is_primary` gives PDF generation an unambiguous "the parent" to
-- address without needing to guess.
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.student_guardians (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  parent_name   text not null,
  parent_email  text,
  parent_phone  text,
  relationship  text,                        -- 'mother', 'father', 'grandparent', 'carer'…
  is_primary    boolean not null default false,
  address       text,
  notes         text,                        -- staff-facing: preferred contact times, interpreter needed
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists guardians_student_idx on public.student_guardians(student_id);
-- At most one primary guardian per student, so PDF generation never
-- has to choose between two.
create unique index if not exists guardians_one_primary
  on public.student_guardians(student_id) where is_primary;

-- ══════════════════════════════════════════════════════════════════
-- CONSENT — recorded BY STAFF, not signed in-app
--
-- The Review Summary screen shows "Parent Input — Pending signature".
-- In this model that is a fact staff record after sending the PDF, not
-- something a guardian does in a browser. `method` matters for audit:
-- "we emailed it" and "they signed the printed copy" are different
-- evidentiary positions if a placement is ever challenged.
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.alp_consents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  guardian_contact_id   uuid references public.student_guardians(id) on delete set null,
  version_id    uuid,                        -- FK added after alp_versions exists
  decision      text not null default 'pending'
                check (decision in ('pending','agreed','declined','partial')),
  method        text check (method in ('printed','email','in_person','phone','post')),
  sent_at       timestamptz,
  responded_at  timestamptz,
  signed_name   text,                        -- as written on the returned copy
  comments      text,
  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists consents_student_idx on public.alp_consents(student_id, created_at desc);

-- ══════════════════════════════════════════════════════════════════
-- GOALS
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.goals (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.orgs(id) on delete cascade,
  student_id            uuid not null references public.students(id) on delete cascade,
  domain                text,
  goal_text             text not null,
  baseline              text,
  target                text,
  monitoring_frequency  text default 'weekly',
  status                text default 'active',
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists goals_student_idx on public.goals(student_id);
create index if not exists goals_org_idx     on public.goals(org_id);

-- ══════════════════════════════════════════════════════════════════
-- PROGRESS ENTRIES
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.progress_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  goal_id     uuid references public.goals(id) on delete cascade,
  score       numeric,
  date        date not null default current_date,
  notes       text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists progress_student_date_idx
  on public.progress_entries(student_id, date desc);
create index if not exists progress_goal_idx on public.progress_entries(goal_id);

-- ══════════════════════════════════════════════════════════════════
-- ALP DOCUMENTS
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.alp_documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  title       text,
  content     jsonb not null default '{}'::jsonb,
  status      text default 'draft',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists alp_docs_org_updated_idx
  on public.alp_documents(org_id, updated_at desc);
create index if not exists alp_docs_student_idx on public.alp_documents(student_id);

-- ══════════════════════════════════════════════════════════════════
-- ALP VERSIONS — immutable snapshots for audit / rollback
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.alp_versions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  version_number integer not null,
  snapshot       jsonb not null default '{}'::jsonb,
  change_summary text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (student_id, version_number)
);
create index if not exists alp_versions_student_idx
  on public.alp_versions(student_id, version_number desc);

do $$ begin
  alter table public.alp_consents
    add constraint alp_consents_version_fk
    foreign key (version_id) references public.alp_versions(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ══════════════════════════════════════════════════════════════════
-- FAMILY MESSAGES — a staff-side log of contact with the family.
-- Not a chat: nobody outside the org can read or write it. It records
-- what was sent, when, and by whom.
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.family_messages (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  sender_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists family_msgs_student_idx
  on public.family_messages(student_id, created_at desc);

-- ══════════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  student_id  uuid references public.students(id) on delete cascade,
  type        text not null default 'general',
  title       text not null,
  body        text,
  urgent      boolean not null default false,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(user_id) where read = false;

-- ══════════════════════════════════════════════════════════════════
-- AUDIT LOG — append-only. No update/delete policy exists by design.
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.orgs(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  action      text not null,
  table_name  text,
  record_id   uuid,
  student_id  uuid references public.students(id) on delete set null,
  details     jsonb,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_log(created_at desc);
create index if not exists audit_student_idx on public.audit_log(student_id, created_at desc);


-- ══════════════════════════════════════════════════════════════════
-- SET PRIMARY GUARDIAN — atomic
--
-- The previous implementation was two separate statements from the
-- browser: clear the student's current primary, then set the new one.
-- The partial unique index guarantees you never end up with two
-- primary ROWS, but it does NOT make that sequence safe. Two staff
-- acting at once can interleave as clear/clear/set/set, and the second
-- write simply overwrites the first — a lost update, with no error
-- raised for anyone to notice.
--
-- Doing it in one function makes it one transaction. The FOR UPDATE
-- lock on the student's guardian rows is what actually serialises
-- concurrent callers: the second transaction blocks at the lock until
-- the first commits, then proceeds against the state the first left.
--
-- SECURITY INVOKER (the default), deliberately: RLS still applies, so
-- this can only be called for a student the caller may already edit.
-- A SECURITY DEFINER function here would quietly hand every staff
-- member write access to every guardian in the database.
-- ══════════════════════════════════════════════════════════════════
create or replace function public.set_primary_guardian(
  p_student_id  uuid,
  p_guardian_contact_id uuid
)
returns public.student_guardians
language plpgsql
set search_path = public
as $$
declare
  v_row public.student_guardians;
begin
  -- Serialisation point. Also the RLS check: a caller who may not
  -- update this student's guardians cannot take the lock.
  perform 1 from public.student_guardians
   where student_id = p_student_id
   for update;

  -- The guardian must belong to THIS student. Without this, passing a
  -- guardian id from another student would clear the first student's
  -- primary contact and then set a stranger as their primary — so the
  -- ALP PDF would be addressed to the wrong family.
  if not exists (
    select 1 from public.student_guardians
     where id = p_guardian_contact_id and student_id = p_student_id
  ) then
    raise exception 'Guardian % does not belong to student %', p_guardian_contact_id, p_student_id
      using errcode = '23503';
  end if;

  update public.student_guardians
     set is_primary = false
   where student_id = p_student_id
     and is_primary;

  update public.student_guardians
     set is_primary = true
   where id = p_guardian_contact_id
     and student_id = p_student_id   -- scoped by both, per review
   returning * into v_row;

  return v_row;
end $$;

-- ══════════════════════════════════════════════════════════════════
-- AUTO-STAMP org_id
-- The client never sends org_id. These triggers derive it from the
-- caller's profile, so a client that forges the field is overwritten.
-- ══════════════════════════════════════════════════════════════════
create or replace function public.stamp_org_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.org_id := public.current_org_id();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['students','student_guardians','alp_consents','goals',
                           'progress_entries','alp_documents','alp_versions',
                           'family_messages','audit_log']
  loop
    execute format('drop trigger if exists stamp_org_id_trg on public.%I', t);
    execute format(
      'create trigger stamp_org_id_trg before insert on public.%I
       for each row execute function public.stamp_org_id()', t);
  end loop;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','students','student_guardians','goals','alp_documents']
  loop
    execute format('drop trigger if exists touch_updated_at_trg on public.%I', t);
    execute format(
      'create trigger touch_updated_at_trg before update on public.%I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════
-- NEW USER TRIGGER
-- Without this an invited user signs in successfully but has no
-- profiles row, so getProfile() returns null and the app dead-ends.
--
-- Invited user → metadata carries org_id + role from the inviter.
-- Cold signup  → creates a new org and makes them its director.
--
-- An unrecognised role (including 'parent' from any older invite still
-- sitting in an inbox) falls back to 'teacher' rather than erroring.
-- ══════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text := coalesce(nullif(meta->>'full_name',''), split_part(new.email,'@',1));
  v_school    text := nullif(meta->>'school', '');
begin
  -- ══════════════════════════════════════════════════════════════
  -- raw_user_meta_data IS ATTACKER-CONTROLLED. Never read role or
  -- org_id from it.
  --
  -- It is populated from `options.data` on supabase.auth.signUp(),
  -- which is a public, unauthenticated endpoint. Anyone can POST
  -- their own JSON to it. An earlier version of this function read
  -- both fields from here, so:
  --
  --   POST /auth/v1/signup
  --   { "email": "...", "password": "...",
  --     "data": { "role": "admin", "org_id": "<a real school's uuid>" } }
  --
  -- created an ADMIN account inside that school, with read access to
  -- every student record in it. Verified against this schema before
  -- the fix.
  --
  -- Every self-registration therefore lands UNASSIGNED:
  --   org_id = NULL  → current_org_id() is NULL
  --                  → every RLS policy compares against NULL
  --                  → the account can read nothing at all
  --   role   = 'teacher' (lowest privilege; the column is NOT NULL,
  --                       and it means nothing without an org)
  --
  -- Role and organisation are assigned ONLY by
  -- supabase/functions/invite-user, which runs server-side with the
  -- service role key after checking the caller is a director or admin
  -- of the org they are inviting into. That function writes to
  -- public.profiles directly; it does not go through this trigger.
  -- ══════════════════════════════════════════════════════════════
  insert into public.profiles (id, org_id, email, full_name, role, status, school)
  values (new.id, null, new.email, v_full_name, 'teacher', 'pending', v_school)
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Deny by default everywhere. The anon key ships inside the JS bundle
-- — anyone can read it out of devtools — so RLS is the only thing
-- protecting student records and disability data.
-- ══════════════════════════════════════════════════════════════════
alter table public.orgs              enable row level security;
alter table public.profiles          enable row level security;
alter table public.students          enable row level security;
alter table public.student_guardians enable row level security;
alter table public.alp_consents      enable row level security;
alter table public.goals             enable row level security;
alter table public.progress_entries  enable row level security;
alter table public.alp_documents     enable row level security;
alter table public.alp_versions      enable row level security;
alter table public.family_messages   enable row level security;
alter table public.notifications     enable row level security;
alter table public.audit_log         enable row level security;

-- ORGS
drop policy if exists orgs_select on public.orgs;
create policy orgs_select on public.orgs
  for select using (id = public.current_org_id());

drop policy if exists orgs_update on public.orgs;
create policy orgs_update on public.orgs
  for update using (id = public.current_org_id() and public.is_org_admin());

-- PROFILES — every user here is staff, so an org-wide roster is correct.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or org_id = public.current_org_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (org_id = public.current_org_id() and public.is_org_admin());

-- STUDENTS — teachers see their caseload; reviewers see the whole org.
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select using (
    org_id = public.current_org_id()
    and (teacher_id = auth.uid() or public.is_org_reviewer())
  );

drop policy if exists students_insert on public.students;
create policy students_insert on public.students
  for insert with check (org_id = public.current_org_id());

drop policy if exists students_update on public.students;
create policy students_update on public.students
  for update using (
    org_id = public.current_org_id()
    and (teacher_id = auth.uid() or public.is_org_admin())
  );

drop policy if exists students_delete on public.students;
create policy students_delete on public.students
  for delete using (org_id = public.current_org_id() and public.is_org_admin());

-- ── Child tables inherit visibility from the parent student row ────
-- A teacher can never reach records belonging to someone else's caseload.
do $$
declare t text;
begin
  foreach t in array array['student_guardians','alp_consents','goals','progress_entries',
                           'alp_documents','alp_versions','family_messages']
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$
      create policy %I_select on public.%I for select using (
        exists (select 1 from public.students s
                where s.id = %I.student_id
                  and s.org_id = public.current_org_id()
                  and (s.teacher_id = auth.uid() or public.is_org_reviewer())))
    $f$, t, t, t);

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format($f$
      create policy %I_insert on public.%I for insert with check (
        exists (select 1 from public.students s
                where s.id = %I.student_id
                  and s.org_id = public.current_org_id()
                  and (s.teacher_id = auth.uid() or public.is_org_reviewer())))
    $f$, t, t, t);
  end loop;
end $$;

-- Updates: mutable tables only. alp_versions stays immutable — a
-- version snapshot you can edit is not an audit trail.
do $$
declare t text;
begin
  foreach t in array array['student_guardians','alp_consents','goals',
                           'progress_entries','alp_documents','family_messages']
  loop
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format($f$
      create policy %I_update on public.%I for update using (
        exists (select 1 from public.students s
                where s.id = %I.student_id
                  and s.org_id = public.current_org_id()
                  and (s.teacher_id = auth.uid() or public.is_org_admin())))
    $f$, t, t, t);
  end loop;
end $$;

-- Guardian records are correctable and removable by the caseload
-- teacher or an admin — a wrong phone number must be fixable.
drop policy if exists student_guardians_delete on public.student_guardians;
create policy student_guardians_delete on public.student_guardians
  for delete using (
    exists (select 1 from public.students s
            where s.id = student_guardians.student_id
              and s.org_id = public.current_org_id()
              and (s.teacher_id = auth.uid() or public.is_org_admin()))
  );

-- NOTIFICATIONS — you only ever see your own.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert with check (
    exists (select 1 from public.profiles p
            where p.id = notifications.user_id
              and p.org_id = public.current_org_id())
  );

-- AUDIT LOG — insert-only, readable by admins, never updatable.
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
  for insert with check (user_id = auth.uid());

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select using (org_id = public.current_org_id() and public.is_org_admin());

-- ── Realtime (subscribeToStudents / subscribeToNotifications) ──────
do $$ begin
  alter publication supabase_realtime add table public.students;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;


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


-- ══════════════════════════════════════════════════════════════════
-- VERIFICATION — run these separately once the above succeeds
-- ══════════════════════════════════════════════════════════════════
-- 12 rows, rowsecurity = true on EVERY one. Any false is a table
-- readable by anyone holding the public anon key.
--
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public' order by tablename;
--
-- Exactly: teacher, director, admin, intervention, related
--
--   select string_agg(e::text, ', ')
--     from unnest(enum_range(null::user_role)) e;
--
-- One row. Without this trigger a signup creates an auth account with
-- no profiles row, and the app dead-ends on a blank dashboard.
--
--   select tgname from pg_trigger where tgname = 'on_auth_user_created';
--
-- One row — the atomic primary-guardian function.
--
--   select proname from pg_proc where proname = 'set_primary_guardian';
