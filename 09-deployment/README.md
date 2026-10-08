# Parallel Deployment Guide

This branch does not replace the live Netlify/Supabase deployment. Keep
`codex/alp-ecosystem` separate from `main` until its acceptance gates are complete.
Do not use the historical deployment examples in `08-docs/archive/`.

## Test Branch

The `Parallel ecosystem checks` workflow builds the website and native clients
and runs real PostgreSQL/Redis isolation tests. It requires no production secrets.
Select the test branch when manually dispatching the workflow. Never insert live
database credentials into its integration-test environment.

The same workflow also builds the backend deployment images from
`09-deployment/backend.Dockerfile`, applies migrations from the migration image,
starts the API image against CI-only PostgreSQL and Redis, and runs the anonymous
API readiness checker. See `09-deployment/LAUNCH_STATUS.md` for what this proves
and what still needs manual production acceptance.

For the current Netlify project split and DNS cutover checklist, use
`09-deployment/NETLIFY_CUTOVER.md`. It records the live dashboard state and the
exact project settings to create before public DNS changes.

## Website Staging

Create a separate Netlify project connected to this repository and branch, using
`01-website/netlify.toml`. Keep the existing project and root config untouched.
Configure `NEXT_PUBLIC_SITE_URL` and `SITE_ORIGIN` to the exact staging HTTPS
origin, and `NEXT_PUBLIC_APP_URL` to the approved browser gateway. Keep
`ALLOW_INDEXING=false` until a public launch is authorized. Netlify must retain
access to sibling `02-webapp/` assets for the media synchronization build step.

On a Node host, run `npm ci` and `npm run build` in `01-website`, then
`HOST=0.0.0.0 PORT=3100 npm start` behind a TLS reverse proxy. The build prepares
Next's standalone server with public assets and static bundles. For a local
preview use `npm start`, which binds to `127.0.0.1:3100` by default.

`CONTACT_WEBHOOK_URL` must be the new API's HTTPS `/public/enquiries` endpoint.
Set the same random `CONTACT_WEBHOOK_TOKEN` on website and API servers. The form
returns an unavailable error until configured, not a false success. Verify a
synthetic submission reaches the database and the configured recipient before
accepting real enquiries. Do not expose webhook secrets through public variables.

## API Staging

Provision separate PostgreSQL and Redis instances. Use Node 24, a least-privilege
runtime database user and a separately controlled migration identity. Configure
the environment described in `05-backend/.env.example`, including a random JWT
secret and exact allowed frontend origins. Run `npm ci`, `npm run generate`,
`npm run validate`, and `npm run migrate:deploy` against this new database only.
Start API and SMTP worker as separate supervised processes. Set `HOST=0.0.0.0`
only behind the intended private ingress/TLS proxy.

Check `/health/live` and `/health/ready`. Before external use, configure a trusted
proxy/rate-limit topology, managed backups, secret rotation, alerting, request
body limits and log redaction. Test failure/retry behavior for SMTP and Redis.
For the first school and subsequent account invitations, follow
`08-docs/ONBOARDING.md`; never substitute test seeds for account provisioning.
For opt-in password recovery, configure the separate encryption key and mail
worker using `08-docs/PASSWORD_RECOVERY.md`. Verify actual inbox delivery and
session revocation in staging before public enablement. Additional-school
administration and identity-provider integration remain unfinished.

Container deployments should build from the repository root:

```sh
docker build -f 09-deployment/backend.Dockerfile --target migrate -t alp-backend-migrate:release .
docker build -f 09-deployment/backend.Dockerfile --target api -t alp-backend-api:release .
docker build -f 09-deployment/backend.Dockerfile --target worker -t alp-backend-worker:release .
```

Run the `migrate` image once per release with the migration database identity,
then run the `api` and `worker` images as separate non-root services. The worker
still needs real SMTP verification before public password recovery or contact
delivery is advertised.

After staging deploy, verify the public API without sending credentials:

```sh
node 09-deployment/check-api.mjs --api https://api.example.com --origin https://app.example.com
```

For the current staged website, browser gateway and production API hostname, run
the no-secrets public status check:

```sh
node 09-deployment/check-public-status.mjs
```

It must pass the marketing website, browser app, API liveness, API readiness,
CORS and anonymous-authentication checks before any school is invited. A failure
at `ALP API identity` means DNS, TLS or backend hosting is still incomplete.

The production API host must expose the Express backend from
`09-deployment/backend.Dockerfile`, with managed PostgreSQL and Redis. Build
from the repository root, run the `migrate` target once with a migration database
identity, then run the `api` target as the public HTTPS service and the `worker`
target as a separate private process. Keep these runtime values in the provider's
secret manager, not in Git or chat: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`,
`CONTACT_WEBHOOK_TOKEN`, SMTP credentials and password-recovery keys.

## Browser Workspace Staging

`02-webapp/ecosystem` is the new Vite client for the separate API. Use its own
Netlify project/configuration and HTTPS origin, never the existing live project.
Set `VITE_API_URL` at build time and allow only this frontend's exact origin in
the API's `CORS_ORIGINS`. The production build rejects missing or insecure API
origins and generates Netlify security headers. Do not add this preview as the
public website's gateway until its acceptance and migration gates are complete.
See `02-webapp/ecosystem/README.md` for implemented workflows and test boundaries.

## Native Releases

Expo requires the owner's project, build credentials and device testing. A
successful `expo export` produces JavaScript bundles, not an APK or IPA.
Electron requires platform installers, signing and macOS notarization. Leave
`updatesEnabled=false` until the signed feed has passed update testing. Add
verified download URLs to `01-website/content/releases.json` only after those
artifacts exist. Do not add dummy URLs or advertise store availability.

## Not Yet Verified

Production domain routing, migration/import tooling, native store publication,
email inbox delivery, backup restore drills, external monitoring, and full
security/accessibility/restore acceptance remain work. Follow the gates in
`08-docs/ARCHITECTURE.md`; deployment settings alone do not make a release ready.
