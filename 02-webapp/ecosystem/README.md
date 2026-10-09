# ALP Ecosystem Browser Workspace

Separate React/Vite client for `05-backend`. The parent `02-webapp` package still
serves the existing Supabase product. Do not change its root Netlify configuration
or use live ALP accounts here. This client has no demo login or embedded accounts.

## Run

Use Node 24. From this directory, run `npm ci`, then `npm run dev`. The development
server binds to `127.0.0.1:3200`. Set `VITE_API_URL` to the separate API's exact
origin in the process environment or a local `.env.local`. Development permits
HTTP only on `127.0.0.1`; production requires HTTPS. Missing configuration disables
sign-in with an explicit error. Never place secrets in `VITE_*` variables.

The API must include this frontend's exact origin in `CORS_ORIGINS`. Provision
accounts with the existing operator bootstrap and school-invitation workflow.
These accounts are independent of Supabase. For production, set `VITE_API_URL`,
run `npm run build`, and serve `dist/` over HTTPS with SPA route fallback.

Create a separate staging Netlify project using this directory's `netlify.toml`,
not the repository's live configuration. The build emits `_headers` with a CSP
limited to the configured API, no-store, frame protection and no-index headers.
Other hosts must explicitly apply equivalent headers. The repository checkout
must retain the sibling mobile modules and existing image assets during builds.

## Implemented

- Email sign-in, first-school setup, account recovery and invitation acceptance
  (new or existing account).
- Explicit school selection, pending-membership screen and role-aware navigation.
- Searchable, paginated roster; student creation/editing; profiles and messages.
- Thirteen-section plan editor, delayed autosave, revision-conflict handling,
  review/approval/reopening, read-only family views, history and staff comments.
- Goal creation and recorded observations, with a chronological progress table.
- Notification reads, account/school details, responsive layout and light/dark themes.

Browser tokens and learner data stay in memory. Reloading the page requires
sign-in again. Nothing is written to localStorage, sessionStorage or a service
worker. This intentionally excludes persistent device login and offline support.
Shared framework-independent API, draft, section and recovery modules come from
`03-app/src`; native components and secure-store modules are not imported.

Plan edits block in-app navigation, school changes and logout until saved or
explicitly discarded. Browser reload/close uses the browser's unsaved-change
warning; this is not durable crash recovery. Session expiry ends access and clears
the browser state. The API remains the authority for membership and permissions.

## Verification

`npm test` runs seven configuration, security-header and session-state tests.
`npm run build` requires a valid HTTPS `VITE_API_URL`; `npm audit --audit-level=high`
checks dependencies. For local UI checks install Chromium with
`npx playwright install chromium`, then run `npm run test:browser`.

The default browser test uses explicitly synthetic transport fixtures; they are
outside `src` and are never imported by the runtime. CI instead runs
`npm run test:browser -- --integration` after applying migrations to disposable
PostgreSQL. This mode refuses anything except `NODE_ENV=test` and a localhost
`alp_test` database from `ALP_INTEGRATION_DATABASE_URL`. It uses the real Express
API, a synthetic institution, random test passwords and example.test addresses.
The injected limiter is permissive; Redis enforcement has a separate CI test.

Browser checks exercise login, first-school setup state, student creation/editing, family restrictions, plan persistence, history,
goals, progress, comments, save-failure navigation, recovery-unavailable handling,
no persistent session data, responsive screenshots and automated WCAG checks.
Screenshots contain synthetic data only and CI retains them for seven days.
No test sends real email, touches a live database or certifies accessibility.

## Remaining Work

This is not parity with every requested product module. Browser invitation
administration, framework administration, charts, exports, document storage,
AI, signatures, MFA/social login and encrypted offline work remain incomplete.
Recovery mail delivery, staged first-school setup, broader role acceptance, manual
assistive-technology review and migration rehearsal remain release gates.

Built by [Stan Paraclete](https://www.stanparaclete.com/).
