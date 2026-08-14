# ALP — User Acceptance Testing

The architecture is frozen. What follows is about proving it works, not
changing it. If a test here fails, the fix should be the smallest change that
makes it pass — resist the urge to redesign.

## What the 110 automated assertions already cover, and what they don't

**Covered:** RLS policies, tenant isolation at the database level, the
signup path, invitation authorization, guardian contacts, role enum
integrity, the primary-guardian RPC.

**Not covered, and this is the point of UAT:**

- Whether any of it *works in a browser*. Every automated test talks to
  Postgres or to a pure function. None of them render a page.
- JWT verification and the database reads that populate `caller` in the
  invite function. Those live in the handler and are exercised by neither
  suite.
- Whether a teacher can actually complete a plan end to end without hitting
  a broken screen.
- Whether the PDF renders correctly. `generateALPPdf` is called in tests but
  the output has never been *looked at*.

Do not report "110 assertions passing" as evidence that authentication has
been penetration-tested. It has not been.

---

## Before any of this: what is deployed is not what is in this package

Fetched from growwithalp.com on 13 Aug 2026:

```
title:         ALP — Adaptive Learning Program Platform for Special Education
meta-keywords: special education software, IEP alternative, SPED teacher tools
description:   ...progress monitoring, and family portal
```

That is the original pre-fix build. None of the security work is live — not
the schema, not RLS, not the signup fix, not the terminology or brand
normalisation.

**The consequence, in production, right now:** the signup page offers a role
dropdown containing Administrator and Director, and the deployed server-side
code honours it. Anyone who reaches that page can pick Administrator.

Deploy before testing, or you will be UAT-ing the vulnerability.

---

## Setup

Two organisations, on a staging project if you have one.

| | School A | School B |
|---|---|---|
| Director | `dir.a@…` | `dir.b@…` |
| Teacher | `teacher.a@…` | `teacher.b@…` |
| Intervention | `iv.a@…` | — |
| Related services | `rel.a@…` | — |
| Administrator | `admin.a@…` | — |
| Student | Student A | Student B |

Remember accounts are `pending` until provisioned. Create the first director
of each school with the SQL in `DEPLOY.md`, then invite everyone else from
inside the app — which also tests the invite flow.

---

## 1. Teacher

- [ ] Sign in
- [ ] Create a student
- [ ] Work through all 10 steps of the ALP Builder
- [ ] **Step 1: add a guardian** — name, relationship, phone, email, address
- [ ] Mark them primary
- [ ] Save, then **fully reload the page**
- [ ] Confirm the guardian persisted with the primary flag
- [ ] Add a second guardian
- [ ] Switch the primary to the second guardian
- [ ] Confirm exactly one shows the PRIMARY badge
- [ ] Remove a guardian
- [ ] Generate the ALP PDF and **open it** — confirm the correct primary
      guardian appears with relationship, phone and email, and that
      additional contacts are listed
- [ ] Generate an ALP Support Notice — confirm the guardian contact is
      pre-filled from `student_guardians`
- [ ] Submit for review
- [ ] Confirm the plan is now locked for editing

Watch for: anything still showing "Not recorded" where a guardian exists.
Five separate places used to read columns that never existed.

## 2. Director

- [ ] Sign in
- [ ] Open the Review Queue; the submitted plan should be there
- [ ] Open it and request changes with a note
- [ ] Sign in as the teacher — confirm the plan is editable again and the
      note is visible
- [ ] Resubmit, then approve as the director
- [ ] Confirm the plan is locked for the teacher and unlocked for the director
- [ ] Invite a teacher into your own school — confirm the email arrives
- [ ] Accept the invite in a private window and confirm the new account lands
      in **your** school with the role you chose
- [ ] Try to invite an **administrator** — must be refused

## 3. Intervention specialist

- [ ] Sign in
- [ ] Confirm visibility of students across the organisation
- [ ] Record intervention data and a progress update
- [ ] Confirm **no approve button**, and that approving is impossible
- [ ] Confirm no access to user management

## 4. Related services

- [ ] Sign in
- [ ] Open an assigned student
- [ ] Record session/service information
- [ ] Confirm guardian contacts are visible (they need them to make contact)
- [ ] Confirm no approval rights and no user management

## 5. Administrator

- [ ] Sign in
- [ ] User management — list staff, invite each of the five roles
- [ ] Organisation settings
- [ ] Audit log — confirm the earlier submit/approve actions are recorded
- [ ] Compliance dashboard

## 6. No session at all

In a private window, signed out, try each of these directly:

- [ ] The dashboard URL
- [ ] A student detail URL
- [ ] The Review Queue URL
- [ ] Student search
- [ ] A reports URL
- [ ] Guardian contacts

Every one should redirect to sign-in or show nothing. None should render a
student name, even briefly before redirecting — a flash of real data is a
leak.

## 7. Pending account

- [ ] Sign up through the public "Sign Up Free" flow
- [ ] Confirm the account cannot reach any student data
- [ ] Confirm it cannot invite anyone
- [ ] Confirm the UI explains what to do next rather than showing an empty
      broken dashboard

That last one is a **known gap**. Signup creates a pending account, and
nothing has been built to greet it. Decide whether that is acceptable for
launch or whether it needs a holding screen.

---

## 8. Cross-tenant isolation — the one that matters most

The original vulnerability was reachable by anyone who could type a URL. So
test it in two layers, because the UI layer alone would have missed it.

### Layer 1 — through the browser, as Teacher A

- [ ] Search for Student B by name
- [ ] Paste Student B's URL directly into the address bar
- [ ] Filter and sort every student list looking for School B rows
- [ ] Run every report type
- [ ] Try to open Student B's guardian contacts
- [ ] Generate a PDF for Student B

Teacher A must see nothing from School B in any of them.

### Layer 2 — skipping the browser entirely

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=<anon key>
export A_EMAIL=teacher.a@school-a.edu  A_PASSWORD=...
export B_EMAIL=teacher.b@school-b.edu  B_PASSWORD=...

node uat/tenant-isolation-probe.mjs
```

42 probes against PostgREST, the RPC endpoint and the Edge Functions
directly, in six layers:

| Layer | What it proves |
|---|---|
| 1 Reads | A cannot *see* B's students, guardians, goals, progress, documents, versions, messages, consents, staff, orgs, audit log or notifications |
| 2 Writes | A cannot *change* them — UPDATE, INSERT and DELETE, each tested separately |
| 3 RPC | `set_primary_guardian()` refuses a foreign guardian and a foreign student, **and nothing moves** |
| 4 Escalation | Client-supplied `org_id`/`role` never becomes authorization — via signup, via invite-user, via a direct write to your own profile |
| 5 Lifecycle | Pending and suspended accounts reach nothing; active accounts reach their own school |
| 6 Anonymous | The anon key alone returns nothing from any table |

Read isolation and write isolation are separate properties. A policy set
with a correct `USING` clause and a missing `WITH CHECK` reads perfectly
clean and writes wide open, so layer 1 can pass in full while layer 2
fails — which is why they are separate layers rather than a single pass.

**Outcomes are `ok`, `BREACH`, `skip`.** A skip is never counted as a
pass, and any skip makes the whole run report INCOMPLETE with exit code
3. This matters: several probes need data that may not exist yet (School
B's student needs a guardian and a goal), and the honest report is
"untested", not "clean".

**Safety.** Writes are attempted as no-op rewrites — a field set to the
value it already holds — so a successful write proves the breach without
altering data. Inserts that succeed are deleted again using School B's
own session. `--skip-writes` limits the run to reads. The DELETE probe
is genuinely destructive and is skipped unless you pass `--allow-delete`;
point it at a throwaway student in School B.

Two optional accounts unlock the layers that are otherwise skipped:

```bash
# Layer 4 — signs up with forged org_id/role and checks the profile
# comes out unprivileged. Leaves a pending account behind; delete it.
export PROBE_SIGNUP_EMAIL=alp-probe-01@example.invalid

# Layer 5 — run three times as an administrator moves the account
# through the states. The transitions need a human; the assertions don't.
export P_EMAIL=pending@school-a.edu P_PASSWORD=... P_EXPECT=pending
```

Anything reported as `BREACH` is a real finding — the probe talks to
your database, not to a fixture.

**Why this layer exists:** clicking through the UI proves the UI filters
correctly. It does not prove the database refuses. The `org_id`
vulnerability needed no UI at all.

### Verifying the probe itself

```bash
node uat/probe-selftest.mjs
```

Every detector run against both a correctly-isolated and a leaking
response, plus edge cases a naive check would miss: a scan returning
mostly-own-org rows with one foreign row, a leak arriving through an
embedded join rather than the top-level table, a pending account with a
null org that must not be miscounted as foreign, and a write that
returns a representation row.

The self-test **imports the real detectors** from `uat/detectors.mjs` —
the same module the probe uses. It used to re-declare its own copy of
each predicate, which meant it proved that a *copy* worked while the
probe was free to drift.

Three checks exist specifically because the earlier version of the probe
got them wrong, and they should not be deleted:

- **`notifications` with no caller uuid reports undetermined, not
  clean.** The old probe computed a foreign-row list and then never used
  it, calling `pass()` unconditionally. That probe could not fail.
- **An unreachable endpoint reports undetermined, not clean.** A network
  failure must never read as "the escalation was refused".
- **An unreadable profile reports undetermined, not clean.** "No profile
  row" may just mean the account cannot see itself.

### Running the probe without a real project

```bash
node uat/mock-supabase.mjs --port 8099 --mode secure   # or --mode leaky
```

A fake Supabase that speaks enough PostgREST and GoTrue for the probe to
run end to end. The self-test proves the detectors fire, but it feeds
them fixtures and never touches the probe's HTTP layer — a probe can
have perfect detectors and still be useless because it built the wrong
URL or swallowed a response.

The probe must come out clean against `secure` and report a breach on
**every** probe against `leaky`. CI runs both on each push. If the leaky
run comes back clean, the probe is broken and a green run against the
real project would mean nothing.

---

## 9. Findings from building this suite

**Self-escalation through `profiles` — fixed in
`20260814000003_profiles_privilege_guard.sql`.**

`profiles_update_self` reads:

```sql
for update using (id = auth.uid()) with check (id = auth.uid())
```

The `WITH CHECK` constrains which row may be written, not what may be
written into it. Any authenticated user could send:

```
PATCH /rest/v1/profiles?id=eq.<their own id>
{ "role": "admin", "org_id": "<another school's uuid>" }
```

and it succeeded — the row still satisfied `id = auth.uid()`. Since
`current_org_id()` reads `org_id` straight off that row, the caller then
saw every student, guardian and audit record in the school they pointed
themselves at. One request, full tenant bypass, from any teacher account.

This is the same class as the original vulnerability — a client-supplied
organisation identifier becoming authorization. It was closed at signup
and at invitation. This was the third door and it was never shut. The
110 automated assertions did not catch it, and neither did the earlier
version of this probe, because neither tried to write to `profiles`.

The fix is a `BEFORE UPDATE` trigger rather than a better policy: an RLS
policy cannot see `OLD`, so it cannot express "the new role must equal
the old role". Immutability is a comparison between two versions of a
row, which is what triggers are for.

Deploy that migration **before** running UAT, or layer 4 will report the
breach on your own project.

### Verifying the fix on the real project

The mock proves the probe works. Only this proves *your* database is
fixed. After running `20260814000003_profiles_privilege_guard.sql`:

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=<anon key>
export A_EMAIL=teacher.a@school-a.edu  A_PASSWORD=...
export B_EMAIL=teacher.b@school-b.edu  B_PASSWORD=...

node uat/verify-privilege-guard.mjs
```

Four attacks, run one at a time and checked after each — a later write
can otherwise mask an earlier one by putting a value back:

1. `role=admin` **and** `org_id=School B` — the full escalation
2. `role=director` — privilege only
3. `org_id=School B` — tenancy only
4. `status`, `invited_by` — the quiet ones

Then the consequence rather than the field: student access must still
be School A and nothing else.

Then the part that is easy to skip — **`full_name` and `school` must
still save**, and a mixed request must land the safe field while
dropping the forged one. A trigger that froze every column would pass
all four attacks and silently break the profile screen. "The attack
failed" and "the guard is correct" are different claims.

It runs as a plain teacher and refuses to run as a director or admin,
since an admin is *allowed* to change roles inside their own school and
the result would prove nothing. Legitimate fields are restored before it
exits, including after a failure.

If you are staying browser-only, `uat/verify-privilege-guard.sql` does
the same checks from the SQL Editor, inside a transaction that is rolled
back. Note the caveat in its header: that file has been reviewed but not
executed, because no Postgres was available when it was written. The
`.mjs` version is the verified one.

**Do not start UAT until this passes on the real project.**

---

## Reporting

For each failure, record: role, exact steps, expected, actual, and whether
data was exposed. Anything in section 8 is a security finding and should be
fixed before anything cosmetic.
