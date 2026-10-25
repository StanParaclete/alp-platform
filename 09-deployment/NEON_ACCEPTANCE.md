# Isolated Neon API Acceptance

This operator-only check creates a new, empty database on the existing Neon
compute. It never seeds or resets the copied school database (`alp_svpq`).
All test identities use synthetic names and `example.test` email addresses.
Mail is captured by tests, not sent to real recipients. No database is dropped.

## Run

Provide `ALP_NEON_ACCEPTANCE_ADMIN_URL` through a protected process environment or
approved local credential entry, never a command-line URL, chat or Git. It must
be the direct Neon owner connection for `alp_svpq`, not a pooled endpoint.
Optionally set `PGSSLROOTCERT` to an approved CA bundle. Remote TLS always
verifies the certificate and hostname.

From `05-backend`, run:

```sh
node scripts/test-neon-acceptance.mjs
```

The runner creates `alp_acceptance_<24 random hex characters>`, attaches a
random test marker, applies the existing migrations and starts the real Express
integration suite against that database. Tests require `NODE_ENV=test`, an exact
host/database confirmation, the matching database marker, and zero users and
schools before setup. The normal localhost `alp_test` path remains supported.
Production/copy names, pooled endpoints, missing markers and nonempty remote
databases are refused. Do not weaken these checks to reuse a populated database.

Only aggregate results and failing test names are printed. Passwords, recovery
codes, connection strings and raw assertion output are not printed. A passing
run requires nonzero tests, zero failures and zero skipped tests.

## Scope and Limits

The suite covers account creation/sign-in, invitations and their acceptance,
school/role restrictions, learner/plan persistence, revisions,
session revocation and password-recovery/outbox behavior using real Neon SQL.
It uses controlled rate-limit and mail transports to exercise success/failure
paths. This does not prove live Redis enforcement, Zoho inbox delivery, a running
mail worker, goal/progress UI acceptance, browser/phone usability, least-privilege runtime permissions, load
capacity or production cutover safety.

The test database is retained with synthetic data for diagnosis. Record its name
and approve cleanup separately; do not retain obsolete test databases indefinitely
on a quota-limited free project. It is not the destination for a final school-data
restore. Never copy real learner records into it.

## Run History: 25 October 2026

- `alp_acceptance_aa029f82234584f83c4d08f7`: initial run interrupted while
  improving test-harness cleanup/diagnostics. No acceptance pass is claimed.
- `alp_acceptance_38b4adf372150c282a2b0506`: 23 tests reported, 20 passed and
  three failed (one recovery concurrency check plus its two containing groups).
  Prisma reported `P2028`. This was not a school-data or live-app test.
- Credential transactions now have explicit bounded wait/transaction budgets.
  A fresh run in `alp_acceptance_69b80bce9b82189bc3a5b2a9` is verifying the change;
  do not mark it passed until its report confirms zero failures and skips.

All these databases contain synthetic test data only and are retained pending
approved cleanup. The school-data copy remains in `alp_svpq` and is unchanged.

Built by [Stan Paraclete](https://www.stanparaclete.com/).
