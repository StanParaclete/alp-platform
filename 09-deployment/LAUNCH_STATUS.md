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

## Netlify Project State

Verified in the Netlify dashboard on 2026-10-08:

- The `myalpeducation` team currently has one project for this repository:
  `growwithalp.com`.
- That project is linked to `github.com/StanParaclete/alp-platform`.
- Production deploys come from `main`.
- The current build settings are the legacy browser app:
  base directory `02-webapp`, build command `npm run build`, publish directory
  `02-webapp/dist`, and functions directory `02-webapp/netlify/functions`.
- The only visible project environment variables are Supabase client variables:
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The DNS zone contains Netlify records for `growwithalp.com` and
  `www.growwithalp.com`, plus the stale `api.growwithalp.com` Supabase CNAME.

Do not repurpose this live project during the parallel migration. Create
separate Netlify projects for the new marketing website and browser workspace,
verify them on staging URLs, then move production domains only after the API and
onboarding gates pass.

Create or update these records only after the new browser workspace and API have
passing deployment checks on their own staging hosts:

- `growwithalp.com` and `www.growwithalp.com` should point to the approved
  marketing website project.
- `app.growwithalp.com` should point to the approved browser workspace host.
- `api.growwithalp.com` should point to the approved ALP API host.
- Both hosts must pass HTTPS, CORS and readiness checks before a school is
  invited.

## Hosting Gates

The parallel branch includes a backend deployment Dockerfile and an anonymous
API readiness checker. GitHub Actions run
37720258789 for commit `d89baf87374995549fb01893194610351bf922ed` built the
migration, API and worker images; ran migrations against CI-only PostgreSQL;
started the API image with CI-only Redis; and verified:

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
