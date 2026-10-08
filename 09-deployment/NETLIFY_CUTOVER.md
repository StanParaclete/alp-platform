# Netlify Cutover Runbook

Last verified: 2026-10-08

This runbook keeps the live `growwithalp.com` project intact while the parallel
ALP ecosystem is staged. Do not change DNS to the new projects until the API,
email and onboarding checks pass.

## Current State

- Netlify team in the browser: `myalpeducation`.
- Existing production project: `growwithalp.com` / `myalpeducation`.
- Existing project builds from `main`.
- Existing project build settings:
  - Base directory: `02-webapp`
  - Build command: `npm run build`
  - Publish directory: `02-webapp/dist`
  - Functions directory: `02-webapp/netlify/functions`
- Existing DNS:
  - `growwithalp.com` -> Netlify project `myalpeducation.netlify.app`
  - `www.growwithalp.com` -> Netlify project `myalpeducation.netlify.app`
  - `api.growwithalp.com` -> stale CNAME `ptsndeotblrgmxcfffrt.supabase.co`
  - `app.growwithalp.com` -> no record

## Create These Projects

Create separate projects from the existing GitHub repository
`StanParaclete/alp-platform`. Use the `codex/alp-ecosystem` branch for staging.
Use `main` only after the migration branch is merged and accepted.

### 1. Marketing Website

Suggested Netlify project name:

```text
alp-website
```

Build settings:

```text
Base directory: 01-website
Build command: npm ci && npm run build
Publish directory: 01-website/.next
Node version: 22
```

Environment variables:

```text
NEXT_PUBLIC_SITE_URL=https://growwithalp.com
NEXT_PUBLIC_APP_URL=https://app.growwithalp.com
SITE_ORIGIN=https://growwithalp.com
ALLOW_INDEXING=false
CONTACT_WEBHOOK_URL=https://api.growwithalp.com/public/enquiries
CONTACT_WEBHOOK_TOKEN=<shared secret with API, never public>
```

Keep `ALLOW_INDEXING=false` until the public launch is approved.

### 2. Browser Application

Suggested Netlify project name:

```text
alp-app
```

Build settings:

```text
Base directory: 02-webapp/ecosystem
Build command: npm run build
Publish directory: 02-webapp/ecosystem/dist
Node version: 24
```

Environment variables:

```text
VITE_API_URL=https://api.growwithalp.com
```

The API must allow this exact browser origin in `CORS_ORIGINS`:

```text
https://app.growwithalp.com
```

## DNS Changes

Do not make these changes until the staged projects have working Netlify
subdomains and the API readiness check passes.

| Hostname | Type | Target |
| --- | --- | --- |
| `growwithalp.com` | Netlify domain | `alp-website` |
| `www.growwithalp.com` | Netlify domain | `alp-website` |
| `app.growwithalp.com` | Netlify domain or CNAME | `alp-app` |
| `api.growwithalp.com` | CNAME or ALIAS | approved backend API host |

Delete the old `api.growwithalp.com` Supabase CNAME only when the replacement
API host is known and ready.

## Verification Before Schools Use It

Run these checks after staging domains are live:

```sh
node 09-deployment/check-api.mjs --api https://api.growwithalp.com --origin https://app.growwithalp.com
```

Then verify manually:

- Website loads over HTTPS at `https://growwithalp.com`.
- Login gateway links to `https://app.growwithalp.com`.
- Browser app loads over HTTPS at `https://app.growwithalp.com`.
- API `/health/live` and `/health/ready` pass.
- Unknown origins are rejected by CORS.
- A school administrator account can sign in.
- A teacher account can sign in and see assigned students.
- Password recovery and contact form emails arrive in a real inbox.
- No demo seed data remains visible to real users.

## Stop Conditions

Stop the launch if any of these are true:

- The API host is unknown.
- `api.growwithalp.com` still points to Supabase.
- `app.growwithalp.com` has no DNS record.
- Netlify deploys are built from the legacy root project instead of the new
  `01-website` or `02-webapp/ecosystem` projects.
- Email delivery has not been verified.
- No real school administrator has completed sign-in.
- Backups, restore testing and alerting are not configured.
