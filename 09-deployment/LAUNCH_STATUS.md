# ALP Launch Status

Last updated: 2026-10-09

This file separates completed build work from the remaining public launch gates.
The live `growwithalp.com` site is online, but the parallel ecosystem branch is
not yet safe to cut over for schools.

## Public DNS

- `growwithalp.com` resolves and serves the current Netlify production site.
- `alp-website-745.netlify.app` serves the staged marketing website for the
  parallel ecosystem, but the root domain has not been moved to it.
- `app.growwithalp.com` resolves to the staged browser workspace and returns
  HTTP 200 at `/login`.
- `api.growwithalp.com` does not resolve in public DNS. Do not send production
  traffic or credentials there.

## Netlify Project State

Verified in Netlify and public endpoint checks on 2026-10-08:

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
  `www.growwithalp.com`. Public DNS for `api.growwithalp.com` currently fails.

Separate staging projects now exist for the parallel ecosystem:

- `alp-website-745`, project ID `8c885a93-4089-4a19-981e-3643b074feb7`, serves
  `https://alp-website-745.netlify.app`.
- `alp-app-745`, project ID `1fa5a5af-0f8a-4dc3-b5d4-70fb2fa28e18`, serves
  `https://app.growwithalp.com` and `https://alp-app-745.netlify.app`.
- These projects were deployed from local production builds. GitHub-triggered
  deploys for the new projects still need Netlify/GitHub deploy-key and webhook
  authorization.

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

1. Select an active Railway plan or another approved paid backend host. Railway
   currently blocks deploys before upload because the workspace trial has
   expired.
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

## Latest Local Checks

On 2026-10-09:

- `alp-app-745` redeployed successfully as deploy
  `6ac7fc19135ba28c5864dbf3`.
- `alp-website-745` redeployed successfully as deploy
  `6ac7fc2c135ba28e7864dbb6`.
- `https://app.growwithalp.com/login` returned HTTP 200 with the expected API
  content security policy.
- `https://alp-website-745.netlify.app/` returned HTTP 200.
- `node 09-deployment/check-api.mjs --api https://api.growwithalp.com --origin https://app.growwithalp.com`
  failed at API identity because the API hostname could not be resolved.
- `node 09-deployment/check-public-status.mjs` is the current no-secrets public
  release check. It currently passes the marketing website and browser app, and
  fails only at ALP API identity until `api.growwithalp.com` resolves to the
  approved backend host and passes readiness.
- `npm test` in `05-backend` passed 15 local tests. The two service-backed
  PostgreSQL and Redis tests were skipped because staging service URLs were not
  configured locally.
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
- The existing Railway API service is still associated with
  `https://www.growwithalp.com`; do not move public DNS or invite schools until
  the backend is redeployed on an approved API host and `api.growwithalp.com`
  passes the public checker.
