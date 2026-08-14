# ALP — security rules

Rules, not guidelines. Each one exists because it was already broken
once. They outrank convenience, schedule, and any particular
implementation — including the current one.

---

## Rule 1 — Role and organisation are server-controlled

> **A user's role and organisation are security attributes. They must
> never be writable by the user, through the client application, a
> generic self-update policy, or anything a request body can reach.**

`org_id` is not a preference. It is the answer to "whose children's
records may this person read", and `current_org_id()` reads it straight
off the user's own profile row. Anything that lets a caller set it lets
that caller choose a school.

The only legitimate writer is server-side provisioning: the
`invite-user` Edge Function, holding the service role key, after it has
checked who is asking. Every other path must be closed.

**Fields covered:** `role`, `org_id`, `status`, `invited_by`.

**This has been breached three separate ways.** Each was fixed
independently, and each fix left the others open, which is the reason
this is written as a rule about the *attribute* rather than a note about
any one endpoint:

| Door | How it worked | Closed by |
|---|---|---|
| Public signup | `raw_user_meta_data` is set by the caller; the trigger read `role` and `org_id` out of it | `handle_new_user` ignores metadata for anything security-relevant |
| Invitation | The request body carried `role` and `orgId` and they reached the database | `authorizeInvite` derives both server-side from the caller's own profile |
| Self-update | `profiles_update_self` constrains *which row* may be written, not *what* may be written into it | `guard_profile_privileges` trigger, migration `20260814000003` |

The third door stayed open for the entire time the first two were
considered fixed. Nothing in the codebase looked wrong.

### What this rule forbids in practice

- A policy whose `WITH CHECK` only identifies the row (`id = auth.uid()`)
  while the statement is free to set any column in it.
- Client code that sends `role`, `org_id`, `status` or `invited_by` in a
  profile write, even as a value read back from the server.
- Trusting `raw_user_meta_data`, or any request field, for authorization.
- A new table with a `role`- or `org`-shaped column and a self-update
  policy copied from `profiles`.

### Why the fix is a trigger, not a better policy

An RLS policy cannot see `OLD`. It can require the new role to equal a
literal, but not to equal the previous value. Immutability is a
comparison between two versions of a row, so it belongs in a
`BEFORE UPDATE` trigger. Attempting it in a policy means hard-coding a
role, which breaks legitimate admin edits and invites a future
loosening.

### One trap in implementing it

The guard must exempt server-side roles, and it must do so by naming the
*client* roles it applies to (`authenticated`, `anon`) rather than the
server roles it lets through.

The first version of the trigger checked `current_user = 'service_role'`
and guarded everything else. That also caught `postgres` — which is what
the migrations and the pgTAP suite connect as. Every test fixture
provisions staff with a direct `update public.profiles set org_id = ...,
role = ...`, exactly as `invite-user` does. The guard silently reverted
all of them, so the fixtures provisioned nothing and the suite would
have run against unprovisioned accounts.

A guard that reverts rather than errors is the right behaviour for a
client request and a dangerous one for a test fixture: nothing fails
loudly, the assertions just stop meaning what they say.

### How it is enforced

- `supabase/migrations/20260814000003_profiles_privilege_guard.sql` —
  the trigger.
- CI: **Profile privileges are frozen against client writes** — fails
  the build if the trigger or its function disappears from the
  migrations.
- CI: **Signup metadata is never trusted for role or org** — fails if
  `handle_new_user` starts reading those fields.
- CI: **No client-side writes to privileged profile fields** — fails if
  app code sends them.
- `uat/tenant-isolation-probe.mjs` layer 4 — attacks all three doors
  against a running project.
- `uat/verify-privilege-guard.mjs` — the focused check, run against the
  real project after deploying the migration.

---

## Rule 2 — Read isolation and write isolation are separate properties

A policy set with a correct `USING` clause and a missing `WITH CHECK`
reads perfectly clean and writes wide open. Proving a caller cannot
*see* another school's data says nothing about whether they can
*change* it.

Every tenant-scoped table needs both proven. That is why the probe has
separate read and write layers rather than one pass, and why `DELETE`
is tested separately from `UPDATE` — deletion is often the policy
someone forgets to write at all.

---

## Rule 3 — The UI is not a security boundary

Clicking through the application proves the application filters
correctly. It proves nothing about what the database will hand to a
caller who skips the application, and the anon key needed to skip it is
in the shipped bundle by design.

Every isolation claim must be demonstrated against PostgREST, the RPC
endpoints and the Edge Functions directly. A UAT pass that consists
only of browser testing is not a pass.

---

## Rule 4 — A check that cannot fail is worse than no check

It is worse because a clean run gets trusted, and the trust is spent
elsewhere.

This is not hypothetical here. The tenant probe shipped with a
notifications check that computed a list of foreign rows and then never
looked at it — it called `pass()` unconditionally and had done so on
every run. It was counted among the passing probes.

Consequences for how this project tests:

- Every detector is run against both a correct and a deliberately
  leaking input (`uat/probe-selftest.mjs`).
- The self-test imports the real detectors rather than re-declaring
  them, so the tested copy cannot drift from the running one.
- The probe is run against a mock in both modes in CI. If the leaking
  mode comes back clean, the build fails — a probe that passes a
  leaking database is broken, whatever it says about the real one.
- "Could not determine" is a distinct outcome from "clean". An
  unreachable endpoint, an unreadable row, or a missing uuid reports
  `skip`, and any skip makes the whole run INCOMPLETE.

---

## Rule 5 — Fix the smallest thing that closes the hole

The architecture is frozen. A security finding is a reason to write a
targeted migration, not to reopen a design. `20260814000003` adds one
trigger and changes no existing policy, table or client code.

If a fix seems to require restructuring, that is a signal to look for
the narrower fix first, and to write down why the narrow one was
rejected if it genuinely was.
