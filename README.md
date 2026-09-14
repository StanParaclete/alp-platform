# ALP - Accelerated Learning Plan

Built by [Stan Paraclete](https://www.stanparaclete.com).

ALP supports educational intervention planning and progress monitoring. The
existing React/Supabase application in `02-webapp/` remains the live product.
The expanded website, API, Expo client and Electron client are being developed
alongside it on `codex/alp-ecosystem`. They have not replaced production.

Start with [implementation status](08-docs/ECOSYSTEM_STATUS.md) and
[deployment instructions](09-deployment/README.md). The root `netlify.toml`
still deploys only `02-webapp/`. Do not run new database migrations against the
live Supabase database.

Use Node.js 24 for the ecosystem packages and `npm ci` inside each package.
No real user credentials or production secrets belong in this repository.
