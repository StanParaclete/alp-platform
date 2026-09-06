# ALP — Deployment architecture

Two environments, one pipeline, no manual fixture work in production.

Written after a session in which production was seeded with fake schools,
paused three times mid-test, and had to be woken by hand before anything
could be verified. That workflow does not scale and it puts test data in
the same database as real children's records. This replaces it.

---

## 1. Production architecture

```
growwithalp.com
   └── Netlify  (builds from main)
         └── React/Vite bundle
               └── Supabase production project
                     ├── Auth
                     ├── PostgreSQL + RLS
                     └── Edge Functions (invite-user, ai-assist)
```

- Project ref: `sjutbbpajmqchrccdmwb`
- Region: eu-west-1
- **Contains zero test fixtures.** Nothing named `alp-uat-*` should ever
  exist here.
- **Should be on Pro before real users.** Free-tier projects pause after
  inactivity; the hostname stops resolving entirely, so signup dies with
  no warning and no error a user could interpret. Free also keeps no
  backups at all, which is not a defensible position for a database
  holding named children.

## 2. Staging architecture

Identical in every respect except that it is disposable.

```
deploy previews  →  Supabase staging project
```

- A second free Supabase project. Free is correct here: pausing is
  irrelevant because CI wakes it, and there is nothing to lose.
- Same three migrations, applied in the same order.
- Seeded by `uat/seed-test-schools.mjs`, which is idempotent and has a
  `--clean` that removes exactly what it created.
- Every destructive test — cross-tenant DELETE, forged signups, the
  privilege-guard attacks — runs here and only here.

---

## 3. Environment variables

### Netlify (production and deploy previews)

| Name | Value | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | |
| `VITE_SUPABASE_ANON_KEY` | the **publishable** key (`sb_publishable_…`) | see below |

**Why publishable and not the legacy anon key.** `ai.js` calls
`supabase.functions.invoke()`, which reuses the client's key. The Edge
Functions gateway accepts publishable keys and rejects legacy JWT anon
keys; PostgREST accepts both. One variable has to serve auth, database
and functions, so it must be the publishable key or AI assistance fails
for every user.

**Never** put a `service_role` or `sb_secret_` key in Netlify. Anything
prefixed `VITE_` is compiled into the JavaScript and readable by every
visitor. A secret key there bypasses RLS for anyone who opens DevTools.

### Supabase Edge Function secrets (both projects)

| Name | Source |
|---|---|
| `SUPABASE_URL` | default secret |
| `SUPABASE_ANON_KEY` | default secret |
| `SUPABASE_SERVICE_ROLE_KEY` | default secret |
| `DEEPSEEK_API_KEY` | platform.deepseek.com |
| `ALLOWED_ORIGINS` | `https://growwithalp.com,https://www.growwithalp.com` plus the deploy-preview origin |

Both functions must have **Verify JWT with legacy secret** OFF. They
authenticate callers in code — `getUser()` then `authorizeInvite()` —
which the gateway cannot do, because the gateway cannot tell a teacher
from a director.

### CI (GitHub → Settings → Secrets → Actions)

| Name | Value |
|---|---|
| `STAGING_SUPABASE_URL` | staging project URL |
| `STAGING_PUBLISHABLE_KEY` | staging `sb_publishable_…` |
| `STAGING_SERVICE_ROLE_KEY` | staging `service_role` — CI only, never Netlify |

---

## 4. Migrations

Applied in order, to **both** projects:

1. `20260813000001_initial_schema.sql` — 12 tables, RLS on every one,
   five roles, `handle_new_user`, `stamp_org_id`, `set_primary_guardian`
2. `20260813000002_grants.sql` — role grants
3. `20260814000003_profiles_privilege_guard.sql` — the trigger that
   freezes `role`, `org_id`, `status` and `invited_by` against client
   writes

Verify after applying:

```sql
select
  (select count(*) from pg_trigger
    where tgname = 'profiles_guard_privileges' and not tgisinternal) as guard,
  (select count(*) from pg_tables where schemaname='public') as tables;
```

Expect `1` and `12`. If `guard` is `0`, migration 3 did not run and a
teacher can write themselves into another school.

---

## 5. Automated tests and where they run

| Test | Runs against | Blocks deploy |
|---|---|---|
| `npm run build` | — | yes |
| `npm run test:invite` (32 assertions) | — | yes |
| `uat/probe-selftest.mjs` | fixtures | yes |
| pgTAP suite (5 files) | ephemeral Postgres | yes |
| Regression guards | source | yes |
| Tenant probe vs `mock-supabase --mode secure` | mock | yes |
| Tenant probe vs `mock-supabase --mode leaky` | mock | yes — must report breaches |
| `uat/verify-privilege-guard.mjs` | **staging** | yes |
| `uat/tenant-isolation-probe.mjs` | **staging** | yes |

The leaky-mock run is not redundant. A probe that passes against a
deliberately broken database is broken itself, and a green run against
the real project would then mean nothing.

## 6. Deployment gates

```
push  →  build + unit + guardrails
      →  pgTAP
      →  probe self-test + mock (secure and leaky)
      →  seed staging  →  privilege guard  →  42 probes  →  clean staging
      →  merge to main
      →  Netlify production
```

Any `BREACH` stops the pipeline. Any `skip` stops it too — a skipped
probe is untested, not clean, and the exit code distinguishes them
(`1` = breach, `3` = incomplete).

---

## 7. Remaining manual acceptance

Automation cannot cover these. They need a human in a browser.

- Public signup on the live site, through to a working dashboard
- Five-role walkthrough: teacher, director, admin, intervention, related
- A complete 10-step plan: create, save, reopen, submit for review
- Director review: approve, request changes
- Guardian contact added, primary switched
- PDF generated and **opened** — no human has ever looked at its output
- Mobile browser pass on a real phone
- An invitation actually sent and accepted end to end

## 8. Is Web V1 production-ready?

**No, and two specific things stand between here and yes.**

Verified against the real production database:

- Privilege guard 8/8 — `role` and `org_id` are server-controlled
- Read isolation, write isolation including cross-tenant DELETE, the
  `set_primary_guardian` boundary, account lifecycle, anonymous access:
  40 probes, zero breaches
- `invite-user` correctly refuses a teacher with 403

Not yet true:

1. **No human has completed a workflow.** Every assurance above is
   machine-generated. Nobody has signed up on growwithalp.com, written a
   plan, had it approved, or opened the PDF.
2. **`ai-assist` returns 502.** The function runs and cannot reach
   DeepSeek — an invalid or unfunded `DEEPSEEK_API_KEY`.

Also outstanding, lower stakes: production still holds the `alp-uat-*`
fixture, which must be removed with `--clean`; the nine photograph slots
on the marketing pages are placeholders; and production should be on Pro
before the first school.

**V1 is complete when a real person completes a real plan on the
deployed site, all five roles work, and the security gate passes against
staging on every push.** Not when a desktop app exists, not when the
feature list is longer.
