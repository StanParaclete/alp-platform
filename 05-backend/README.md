# ALP Parallel API

Use Node 24 and separate PostgreSQL/Redis services. Configure the keys listed in
`.env.example` through the environment. Generate `JWT_SECRET` with at least 48
random bytes encoded as hex. Never point this package at live Supabase.

Run `npm ci`, `npm run generate`, `npm run validate`, then `npm run migrate:deploy`
against the new database. Start with `npm start`; run `npm run worker` separately
with SMTP configuration for enquiries. Scripts do not automatically load `.env`;
use your process manager, container environment or Node's `--env-file` option.

`npm test` includes unit checks and explicitly skipped service tests when their
URLs are absent. `npm run test:integration` requires both
`ALP_INTEGRATION_DATABASE_URL` (localhost `alp_test`) and
`ALP_INTEGRATION_REDIS_URL` (localhost database 15), and `NODE_ENV=test`.
The CI workflow provisions these ephemeral services. Seeds are test-only and
must never be used as production account provisioning.

First-school setup and single-use school invitations are documented in
[School onboarding](../08-docs/ONBOARDING.md). `npm run bootstrap` is a validation-only
dry run; applying requires an explicit separate database and confirmation.

The implemented contract is in `src/app.mjs`, validated by `src/domain.mjs`.
Review [status and unfinished modules](../08-docs/ECOSYSTEM_STATUS.md) before
deploying. Configure a trusted reverse proxy policy and rate-limit topology
before exposing this API; arbitrary `X-Forwarded-For` values must not be trusted.

Built by [Stan Paraclete](https://www.stanparaclete.com).
