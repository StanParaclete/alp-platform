# ALP Launch Status

Last updated: 2026-10-09

This file separates completed build work from the remaining public launch gates.
The live `growwithalp.com` site is online. The parallel ecosystem now has a
working browser workspace and API gateway, but it is not yet safe to invite
schools until onboarding, email, backups and acceptance testing are complete.

## Public DNS

- `growwithalp.com` resolves and serves the current Netlify production site.
- `alp-website-745.netlify.app` serves the staged marketing website for the
  parallel ecosystem, but the root domain has not been moved to it.
- `app.growwithalp.com` resolves to the staged browser workspace and returns
  HTTP 200 at `/login`.
- `api.growwithalp.com` is managed by Netlify DNS and points to the
  `alp-api-proxy-745` gateway, which proxies to the Render `alp-api` service.

## Netlify Project State

Verified in Netlify and public endpoint checks on 2026-10-09:

- The `myalpeducation` team still has the original `growwithalp.com` project
  linked to `github.com/StanParaclete/alp-platform`.
- That original production project deploys from `main`.
- Its current build settings are the legacy browser app:
  base directory `02-webapp`, build command `npm run build`, publish directory
  `02-webapp/dist`, and functions directory `02-webapp/netlify/functions`.
- The only visible project environment variables are Supabase client variables:
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The DNS zone contains Netlify records for `growwithalp.com` and
  `www.growwithalp.com`, `app.growwithalp.com` and `api.growwithalp.com`.

Separate projects now exist for the parallel ecosystem:

- `alp-website-745`, project ID `8c885a93-4089-4a19-981e-3643b074feb7`, serves
  `https://alp-website-745.netlify.app`.
- `alp-app-745`, project ID `1fa5a5af-0f8a-4dc3-b5d4-70fb2fa28e18`, serves
  `https://app.growwithalp.com` and `https://alp-app-745.netlify.app`.
- `alp-api-proxy-745`, project ID `9b2794d5-0452-4627-ad9c-439186050c31`,
  serves `https://api.growwithalp.com` and forwards to the Render API service.
- These projects were deployed from local production builds. GitHub-triggered
  deploys for the new projects still need Netlify/GitHub deploy-key and webhook
  authorization.

Do not repurpose this live project during the parallel migration. Create
separate Netlify projects for the new marketing website and browser workspace,
verify them on staging URLs, then move production domains only after the API and
onboarding gates pass.

Current DNS responsibilities:

- `growwithalp.com` and `www.growwithalp.com` should point to the approved
  marketing website project.
- `app.growwithalp.com` points to the approved browser workspace host.
- `api.growwithalp.com` points to the approved ALP API gateway.
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

The API also deploys on Render Free with Render Postgres and Render Key Value,
behind the Netlify `api.growwithalp.com` gateway. This proves the deployment
path can start cleanly and the public API can answer readiness checks. It does
not prove real school onboarding, email inbox delivery, native store builds,
backups, restore drills, payment, support operations or production monitoring.

## Required Before Public Use

1. Verify account onboarding with a real school administrator and at least one
   teacher account. The browser setup route is implemented, but the API keeps
   it disabled until `ALP_SETUP_TOKEN` is temporarily configured for the first
   owner setup.
2. Verify contact and password-recovery email delivery in a real inbox.
3. Add backups, restore testing, alerting, log retention, secret rotation and an
   explicit proxy/rate-limit topology.
4. Decide whether the free Render stack is acceptable for a limited pilot. The
   current free Postgres database expires on November 8, 2026 unless upgraded or
   migrated, the web service can sleep after inactivity, and the Key Value
   service is not persistent.
5. Run the five-role walkthrough: school admin, teacher, specialist,
   family-facing records and student-facing flows.
6. Only then publish release notes/download links and invite schools.

## Latest Local Checks

On 2026-10-09:

- The guarded first-school browser setup flow was added to the ecosystem app
  and API. It is reachable at `/setup` after deployment, but the backend returns
  404 until `ALP_SETUP_TOKEN` is set on the API service.
- `npm test` in `05-backend` passed 16 local tests. The two service-backed
  PostgreSQL and Redis tests were skipped because staging service URLs were not
  configured locally.
- `npm test` in `02-webapp/ecosystem` passed 8 local tests.
- `VITE_API_URL=https://api.growwithalp.com npm run build` in
  `02-webapp/ecosystem` produced a production app bundle.
- `alp-app-745` redeployed successfully as deploy
  `6ac951c0ce03370bfd8c1eef`; `https://app.growwithalp.com/setup` returns the
  new first-school setup screen with the Stan Paraclete footer link.
- `node 09-deployment/check-api.mjs --api https://api.growwithalp.com --origin https://app.growwithalp.com`
  passed the public API identity, readiness, CORS, origin-blocking and anonymous
  account-access checks.
- `node 09-deployment/check-public-status.mjs` passed the marketing website,
  browser app and public API checks.
- Render `alp-api` manually deployed commit `c2ca225` as deploy
  `dep-db4lbl6i0phs73d4fk50`; it is marked Live in the Render dashboard.
- `POST /auth/bootstrap` on the hosted API now reaches the guarded setup
  endpoint and returns `First-school setup is not available.` until
  `ALP_SETUP_TOKEN` is intentionally configured for first-school setup.
- `alp-app-745` redeployed successfully as deploy
  `6ac7fc19135ba28c5864dbf3`.
- `alp-website-745` redeployed successfully as deploy
  `6ac7fc2c135ba28e7864dbb6`.
- `https://app.growwithalp.com/login` returned HTTP 200 with the expected API
  content security policy.
- `https://alp-website-745.netlify.app/` returned HTTP 200.
- `node 09-deployment/check-public-status.mjs` is the current no-secrets public
  release check.
- Manual HTTPS checks against `api.growwithalp.com` with the Netlify gateway IP
  passed ALP API identity, PostgreSQL and Redis readiness, browser-origin CORS,
  browser preflight, blocked unrecognised origins and blocked anonymous `/me`
  access.
- Railway CLI is authenticated and the local `05-backend` link now points at the
  actual API service `alp-backend`
  (`398c79ff-1282-4110-9a46-fb7e8b72ddfa`) in project
  `7c85796d-3139-4ef0-9196-81b20ed32691`, production environment
  `95ea7b77-5a8d-44b0-9c5c-dd4994089bbf`.
- The Railway project currently shows `alp-backend` as failed and Postgres as
  offline. The latest Railway deployment is from 2026-07-09 and still references
  the old `/05-backend/railway.json` flow rather than the current root
  `railway.json` Docker build.
- `railway up --service alp-backend --environment production --project 7c85796d-3139-4ef0-9196-81b20ed32691`
  was attempted from the repository root and stopped before upload with:
  `Your trial has expired. Please select a plan to continue using Railway.`
- Railway remains blocked by the expired trial and is not part of the active
  no-monthly-fee staging stack.
