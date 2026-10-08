# ALP Launch Status

Last updated: 2026-10-08

This file separates completed build work from the remaining public launch gates.
The live `growwithalp.com` site is online, but the parallel ecosystem branch is
not yet safe to cut over for schools.

## Public DNS

- `growwithalp.com` resolves and serves the current Netlify production site.
- `app.growwithalp.com` has no DNS record yet.
- `api.growwithalp.com` points at an old Supabase hostname that no longer
  resolves. Do not send production traffic or credentials there.

Create or update these records only after the new browser workspace and API have
passing deployment checks on their own staging hosts:

- `app.growwithalp.com` should point to the approved browser workspace host.
- `api.growwithalp.com` should point to the approved ALP API host.
- Both hosts must pass HTTPS, CORS and readiness checks before a school is
  invited.

## Hosting Gates

The parallel branch now includes a backend deployment Dockerfile and an anonymous
API readiness checker. The GitHub workflow builds the migration, API and worker
images; runs migrations against CI-only PostgreSQL; starts the API image with
CI-only Redis; and verifies:

- ALP API identity on `/health/live`
- PostgreSQL and Redis readiness on `/health/ready`
- exact browser-origin CORS
- blocked unrecognised origins
- blocked anonymous `/me` access
- non-root API container execution

This proves the deployment path can start cleanly. It does not prove real school
onboarding, email inbox delivery, native store builds, backups, restore drills,
payment, support operations or production monitoring.

## Required Before Public Use

1. Sign in to Netlify and confirm the live project, DNS zone and deploy settings.
2. Provide the staging API HTTPS origin without secrets.
3. Deploy the backend to the approved host with managed PostgreSQL and Redis.
4. Configure the browser workspace with `VITE_API_URL` pointing at that staging
   API and set the API `CORS_ORIGINS` to the exact browser origin.
5. Run `node 09-deployment/check-api.mjs --api <api-origin> --origin <app-origin>`
   against the real staging hosts.
6. Verify account onboarding with a real school administrator and at least one
   teacher account.
7. Verify contact and password-recovery email delivery in a real inbox.
8. Add backups, restore testing, alerting, log retention, secret rotation and an
   explicit proxy/rate-limit topology.
9. Only then change public DNS and publish release notes/download links.
