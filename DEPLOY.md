# ALP — Deploy

Rebased onto your real repo (`ALP_COMPLETE`), staff-only model, five roles.

---

## 1. Database — do this first

Your repo ships no SQL. The only schema in it is
`05-backend/prisma/schema.prisma`, which belongs to the separate Express
backend and is **not** what the web app talks to. The web app queries nine
tables in Supabase that have never been created anywhere in version control.

`supabase/functions/invite-user/index.ts` even referenced a `schema.sql` that
was never committed — which is why an invited user could sign in and land on
a broken dashboard: the auth account was created, the matching `profiles` row
was not.

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

No CLI? Paste each file in `supabase/migrations/` into **Supabase → SQL
Editor** in filename order. Both are idempotent.

Verify:

```sql
select tablename, rowsecurity from pg_tables where schemaname='public';
-- 12 tables, rowsecurity true on every one

select string_agg(e::text, ', ') from unnest(enum_range(null::user_role)) e;
-- teacher, director, admin, intervention, related_service
```

### Access model

Five roles, all staff: **Administrator, Leadership/Director, Teacher,
Intervention Specialist, Related Services.**

Parents and guardians have **no accounts**. They are contact records on
`student_guardians`, maintained by staff, used to address the generated PDF.
The workflow is: staff completes the ALP → director approves → PDF →
print/email to the family.

Teachers see their own caseload. Director, Administrator, Intervention and
Related Services see their whole organisation. Nobody sees another
organisation. A `before insert` trigger stamps `org_id` from the caller's own
profile, so a client that forges it is overwritten server-side.

`student_guardians` is a table rather than `parent_name`/`parent_email`
columns on `students` for one reason: a child often has two guardians who
both need contacting — separated parents, a grandparent, a foster carer.
Columns force the second into a free-text note and it stops being usable for
addressing a PDF. `is_primary` (uniquely indexed) gives PDF generation an
unambiguous contact.

`alp_consents.method` is not cosmetic. "We emailed it" and "they signed the
printed copy" are different evidentiary positions if a placement is ever
challenged.

---

## 2. Edge Functions

```bash
supabase functions deploy invite-user
supabase functions deploy ai-assist

supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role key>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGINS="https://growwithalp.com,https://www.growwithalp.com"
```

**`ai-assist` is new and fixes a broken feature.** `App.jsx` called
`api.anthropic.com` directly from the browser, twice, with `Content-Type` as
its only header — no API key, no `anthropic-version`. In production both
returned 401 and showed "Check your internet connection", so the AI Goal
Suggestions advertised on your landing page did nothing. It only worked in a
preview environment that injected a key.

Do **not** fix this with `VITE_ANTHROPIC_API_KEY`. Vite inlines `VITE_*` at
build time, so the key would ship as a literal string in your public bundle
and anyone could spend against your account. CI blocks this.

The function is JWT-gated, rate-limited to 12 requests/minute per user, and
keeps the prompts server-side so the endpoint cannot be repurposed as a
general Claude proxy billed to you. Student names are no longer sent to
Anthropic — the model returns a `[Name]` placeholder that the browser fills
in locally.

---

## 3. Web app

Set both in **Netlify → Environment variables** *before* the first build.
Vite inlines `VITE_*`, so a build without them is permanently stuck in demo
mode.

```
VITE_SUPABASE_URL       = https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY  = <anon public key>
```

---

## Tests

```bash
supabase test db                  # needs Docker
./supabase/tests/run-local.sh     # plain Postgres 16 + pgTAP, no Docker
```

19 assertions: the signup trigger, `org_id` stamping against a forged value,
teacher caseload scope, reviewer scope, guardian contact visibility,
cross-tenant reads and writes, the unauthenticated case, and two that assert
the staff-only decision itself.

**psql exits 0 even when a pgTAP assertion fails** — a failed assertion is a
row of output, not a SQL error. The runner parses the TAP stream instead, and
also fails a file that runs clean but asserts nothing. If you rewrite it,
keep both checks: a green build over a red suite is worse than no tests,
because it gets trusted. (It caught a real miscount while I was writing these.)

---

## What changed in your source

**`src/supabase.js`**

- `getReviewersForOrg()` queried **every profile on the platform**. Submitting
  an ALP at one school notified directors at every other school and disclosed
  their names and roles to the caller. Now scoped to the caller's org.
- `getALPDocuments(schoolId)` accepted a school id and never used it.
- Added guardian and consent helpers (staff-managed, no parent auth).
- `signOut()` clears the org cache, so a second user on a shared staffroom
  machine cannot inherit the first user's scope.

**`supabase/functions/invite-user/index.ts`**

- Selected only `role` from `profiles` but then read `callerProfile?.school`
  — always `undefined`.
- A director could invite an **admin** and then sign in to it: a one-step
  escalation past their own tier. Now admin-only.
- Invitees are bound to the inviter's org server-side.
- `Access-Control-Allow-Origin: *` replaced with an allowlist.
- Authorised `leadership`, a role that does not exist in the enum.

**`src/App.jsx`**

- **Role ids were internally inconsistent**: the UI defined `id:"leadership"`
  and `id:"related"`, while permission checks tested for
  `["director","admin","leadership"]` and other code used `"related_service"`.
  The defensive double-listing hid the split — but the invite function
  validates against the database enum, so a `leadership` invite would have
  been rejected with no obvious cause. All five ids now match the enum.
- `role==="director"` routes to **`LeadershipDashboard`**, not
  `DirectorDashboard`. That is deliberate: the live role id was `leadership`,
  so `LeadershipDashboard` is the view directors have actually been using,
  and it is the slightly richer of the two near-duplicates.
  `DirectorDashboard` is now unreferenced — left in place rather than
  deleted, but it is dead code.
- Terminology: SPED / Special Education → ALP / Student Support / SNE (the
  official term in Ghana and Nigeria). `IEP` remains only in the two places
  that deliberately compare ALP to an IEP.
- **The product had three names** — "Adaptive Learning Program",
  "Accelerated Learning Program", "Accelerated Learning Plan". Normalised to
  the one on your wordmark and domain.
- Both AI call sites now go through `ai-assist`.

---

## CI

`.github/workflows/ci.yml` runs the RLS suite, the build, and guards that
each map to something that actually shipped broken:

- **No parent/student login.** This one guards a *decision*, not a bug. It is
  invisible in the code — nothing looks wrong about adding a `parent` role —
  and it was already reintroduced once by accident on a branch. CI now turns
  red if a parent role, a `parent` enum value, or `FamilyPortal.jsx` returns.
- No direct `api.anthropic.com` calls and no `VITE_*` API keys in client code.
- No stray SPED/Special Education terminology.
- One product name.
- Every `create table` has a matching `enable row level security`.
- No `sk-ant-` or `service_role` string in the built bundle.

---

## Guardian contacts

Guardians are **contact records, not users** — no account, no login, no
session, no role, no route. They are managed in **Step 1 of the ALP Builder**
via `<GuardianContacts/>`, alongside the rest of the student demographics.

Staff can add, edit, remove and set a primary contact. Fields are name,
relationship (dropdown, with a free-text box when "Other" is chosen), phone,
email and address. The first guardian added is primary by default — the
common case is one contact, and making a teacher tick a box for it is pure
friction.

**Changing the primary contact is one atomic operation**, via the
`set_primary_guardian()` Postgres function. It verifies the guardian belongs
to the student, clears the old primary, and sets the new one inside a single
transaction, with a `FOR UPDATE` lock on the student's guardian rows so
concurrent callers serialise.

That replaced a two-statement version issued from the browser. The partial
unique index (`guardians_one_primary`) meant you could never end up with two
primary *rows*, but it did not make the sequence safe: two staff acting at
once could interleave as clear/clear/set/set, and the second write would
silently overwrite the first with no error raised. The index remains as the
final constraint; the lock is what actually serialises.

The function also rejects a guardian belonging to a different student. The
old version would have cleared this student's primary contact and then set a
stranger as primary — so the ALP PDF would have gone to the wrong family.
Because the check happens before any write, a rejected call changes nothing.

The primary contact is what the **ALP PDF** and the **ALP Support Notice**
address. Additional guardians appear on the PDF under "Additional contacts".

### A bug this uncovered

Step 1 previously had four flat fields — `parentName`, `parentEmail`,
`parentPhone`, `emergencyContact` — written to `parent_name`, `parent_email`
and `parent_phone` **columns on `students` that do not exist**. Everything a
teacher typed there was silently discarded on save.

The same phantom columns were read in four other places: the PDF signature
block, the Support Notice, and both contact panels in the Student Profile.
All of them always rendered "Not recorded" or "—" — including on the PDF sent
to the family. All now read from `student_guardians`.

The Student Profile also had a **"Portal account: Active / Not set up"** row,
left over from the removed parent portal. Removed, not relabelled.

---

## Signup and role assignment

**Public self-registration is enabled** — "Sign Up Free" on the landing page
calls `supabase.auth.signUp()`, an unauthenticated endpoint.

Every self-registration lands **unassigned**: `org_id` NULL, role `teacher`
(the lowest, and meaningless without an org). With no org, `current_org_id()`
returns NULL, every RLS policy compares against NULL, and the account can read
nothing and create nothing.

**Role and organisation are assigned only by `invite-user`**, server-side,
after it verifies the caller is a director or admin of the org they are
inviting into. That update is scoped to profiles where `org_id is null`, so a
replayed invite cannot move an existing staff member into another org or
change their role.

### The vulnerability this replaced

`handle_new_user()` used to read both `role` and `org_id` from
`raw_user_meta_data`. That field is populated from `options.data` on the
public signup endpoint — it is whatever the caller sends. So this worked:

```
POST /auth/v1/signup
{ "email": "...", "password": "...",
  "data": { "role": "admin", "org_id": "<a real school's uuid>" } }
```

The visitor received an **admin account inside that school**, with read access
to every student record and every guardian contact in it. No invitation, no
approval, no existing account required. Demonstrated against this schema
before the fix; `004_public_signup.test.sql` is its regression test, verified
to fail if the trigger starts reading those fields again.

### Account states

`profiles.status` is `pending`, `active` or `suspended`, separate from role.

"Belongs to no school yet" and "provisioned as a teacher" are different
states. Without an explicit column they were both `role='teacher',
org_id=null`, and only the null org distinguished them — a silent invariant
that one careless default would erase. `current_org_id()`, `is_org_admin()`
and `is_org_reviewer()` all require `status='active'` **and** a non-null
`org_id`: two independent conditions, so a future bug that satisfies one does
not grant access on its own.

`suspended` also gives you an off-switch that is not deletion — a departing
staff member loses access immediately while their audit trail stays intact.

### Provisioning the first user of a new school

Because signup can no longer grant a role, the first director of a new
organisation is created deliberately — Supabase SQL Editor or your admin
tooling:

```sql
insert into public.orgs (name, country) values ('Westwood Primary','GH')
returning id;

update public.profiles
   set org_id = '<the id returned above>', role = 'director'
 where email = 'head@westwood.edu' and org_id is null;
```

Everyone else at that school is then invited from inside the app.

### The product consequence, stated plainly

The landing page offers "Free forever for individual teachers". A teacher who
signs up that way now lands in an unassigned account that can do nothing until
someone provisions them. That is the secure behaviour you asked for, and it is
a real change to that funnel — worth deciding on deliberately rather than
discovering. If self-service onboarding matters commercially, the safe version
is a signup flow that creates a NEW org for the user (never joining an
existing one by id), which is a different feature and is not built here.

---

## ⚠ What is currently deployed

As of 13 Aug 2026, growwithalp.com serves the original pre-fix build — its
page title is still "Adaptive Learning Program Platform for Special
Education" and its meta keywords still say "IEP alternative, SPED teacher
tools". None of the work in this package is live.

Until it is deployed, the live signup page offers a role dropdown containing
Administrator and Director, and the deployed backend honours the choice.
Treat deploying this as the fix for a live issue, not as routine.

`uat/diagnose-signup.mjs` diagnoses the "Failed to fetch" signup error.

## User acceptance testing

`uat/UAT_PLAN.md` — role-by-role walkthroughs, an unauthenticated section,
and a two-layer cross-tenant test.

`uat/tenant-isolation-probe.mjs` — 15 probes against PostgREST directly with
two real accounts in two organisations. This is the layer a browser
walkthrough misses: clicking through the UI proves the UI filters correctly,
not that the database refuses, and the original `org_id` vulnerability needed
no UI at all.

`uat/probe-selftest.mjs` — 27 checks proving each detector fires against a
leaking response as well as staying quiet against a clean one.

**What UAT covers that the 110 automated assertions do not:** whether any of
it works in a browser, JWT verification and the caller reads inside the
invite handler, and whether the generated PDF actually renders correctly —
`generateALPPdf` is called in tests but its output has never been looked at.

---

## Known gaps

Named rather than discovered in front of a district.

- **Two backends still exist.** `05-backend` is a complete Express + Prisma +
  Postgres application — 21 models, its own auth with 2FA, billing, PDF
  generation — at version 2.4.1, which is the version your landing page
  advertises for the desktop downloads. Nothing uses it: its API client
  `02-webapp/src/webapp.js` is 559 lines and is never imported. Deciding
  between it and Supabase is the largest open question in the repo; carrying
  both indefinitely is the expensive option.

- **`dist/assets/index-*.js` is 941 kB** (241 kB gzipped) in one chunk,
  because `App.jsx` is a single 10,500-line module. It works. It is slow on
  the mobile connections this will be used over, and route-level code
  splitting is the fix. I did not do it — it is a refactor, not a fix, and
  you asked me not to expand scope.

- **`node_modules` was committed at some point** and is still in history
  (21 MB pack). Harmless, but it is why a clone is slower than it should be.
  No real secrets are in history — I checked every blob.

- **The rights/consent wording is not legal advice.** Ghana's Inclusive
  Education Policy, Nigeria's NPE and US IDEA differ on what must be told to
  a family and when. Have someone qualified in your jurisdiction review the
  parent-facing text on the generated PDF before selling there.

