# Verification Record

## Current Increment - 2026-10-05

Code commit: `6a0e6867c72ab1dea60026ac114542634e94ebe3`

[GitHub Actions run 37317582263](https://github.com/StanParaclete/alp-platform/actions/runs/37317582263)
completed with **four jobs passing and the mobile audit failing**. This is not
an approved release. The high-severity security gate was not weakened.

| Job | Result and evidence |
| --- | --- |
| existing-webapp | PASS: focused login/PWA/media/invitation checks and production build. |
| applications (01-website) | PASS: clean install, six tests, zero audit findings, Next.js 16.3.8 production build and HTTP smoke test. |
| applications (03-app) | FAIL at dependency audit: 19 high and 10 moderate package findings; 15 unit tests passed. CI native export was skipped after the failed gate. |
| applications (04-software) | PASS: four policy tests, zero audit findings and unpacked Linux Electron build. |
| database | PASS: all three migrations, 15 backend unit tests, real PostgreSQL/Redis security checks, seven browser unit tests, Vite build, browser workflow against the real API, and zero backend/browser audit findings. |

The new browser checks use a disposable PostgreSQL institution and synthetic
accounts, not production or a mocked data API. They exercise teacher sign-in,
student creation/editing (including a database assertion), plan creation and
autosave, version history, goals, observations and staff comments. They also
check linked-parent restrictions, preservation of unsaved edits during a
simulated save outage, navigation blocking, retry, sign-out and an unavailable
recovery service. No bearer tokens or learner records persist in browser storage.

Automated axe checks ran on login, roster and plan views in light/dark themes and
at desktop/phone widths. Screenshot checks used 1440x960 and 390x844, required no
document overflow and checked the supplied image and linked Stan Paraclete
credit. These are representative accessibility checks, not WCAG certification.
The screenshots were downloaded and inspected. Phone section selection now uses
a native picker that keeps the current section visible; switching sections and
preserving saved content is covered in the browser workflow.

Local checks: seven browser, six website, 15 mobile, 15 backend and four desktop
unit tests passed. Website and browser production builds passed; the website
smoke check covered 18 pages, 13 images, 404 and unavailable-contact handling.
Both native JavaScript exports passed locally, but the unresolved mobile audit
still blocks distribution. Unpacked macOS arm64 packaging passed after granting
the standard Electron build-cache directory access. It is unsigned and has not
passed runtime/installer acceptance.

The first browser run, 37280538374, exposed an exact-label failure caused by a
textarea nested in its label; labels and controls are now separate elements.
Compatible dependency patches removed the website, desktop and backend findings.
See [dependency evidence and unresolved upstream advisories](DEPENDENCY_SECURITY.md).
The prior September audit results below are historical, not current clearance.

The local preview at `http://127.0.0.1:3200/` has no staging API configured and
intentionally disables sign-in. It is not a demo backend. No new API deployment,
production data migration, DNS cutover, merge to `main` or live publication was
performed. Main remains `3b5155579c126d4da1df0ccd496fd61bce8db5d0`.

## Previous Recovery Baseline - 2026-09-21

Code commit: `36efe31aacd41eff02fe55e9db873f7897bdc5a6`

[GitHub Actions run 35541663342](https://github.com/StanParaclete/alp-platform/actions/runs/35541663342)
completed successfully. All five jobs passed:

| Job | Checks |
| --- | --- |
| existing-webapp | Clean install; login, PWA, supplied-media and invitation-authorization checks; Vite production build. |
| applications (01-website) | Clean install; contact validation/failure tests; dependency high-severity gate; Next.js production build; standalone HTTP smoke test. |
| applications (03-app) | Clean install; 15 tests covering API origins, session races, draft revisions, Expo peer alignment, invitation client behavior and recovery request/reset state; dependency high-severity gate; iOS and Android JavaScript exports. |
| applications (04-software) | Clean install; four navigation/download/IPC policy tests; dependency high-severity gate; unpacked Linux Electron build. |
| database | Prisma generation and validation; 15 domain/security/onboarding/recovery unit tests; all three migrations against fresh PostgreSQL 16; real tenant isolation, parent access, revision history, session rotation/replay/revocation, enquiry persistence, onboarding and recovery tests; real Redis limit/expiry/disconnection test; dependency high-severity gate. |

Recovery database checks cover generic known/unknown/disabled-address responses,
encrypted outbox handling, invalid/expired/revoked codes, rejected-mail retry,
atomic password changes, revocation of old sessions during concurrent login and
refresh, two competing codes, concurrent use of the same code, password-change
notices, account disable/rename, rate-limit outages and outbox pagination beyond
100 records. Mail acceptance/rejection is simulated with an injected transport;
neither real SMTP nor inbox delivery was tested. Recovery remains disabled by
default until its [staging acceptance gates](PASSWORD_RECOVERY.md) are completed.

Onboarding database checks cover first-school creation/sign-in, repeat bootstrap
rejection, invitation role and tenant boundaries, explicit learner links, hashed
codes, concurrent single-use redemption, existing-account authentication without
password replacement, and rejected revoked/expired/disabled-issuer/demoted-issuer
or archived-learner invitations. Rejected invitations create no account and
successful acceptance records one audit event. No real users were provisioned.

The earlier run, 34837809154, failed the mobile dependency install because
React DOM 19.3.0 did not match Expo's React 19.2.3. The fix pins React DOM and
native animation peers to the installed Expo SDK's supported versions. No
`--force` or `--legacy-peer-deps` bypass is required. An automated test now
checks the declared, locked and installed versions against the SDK metadata.

## Local Evidence

- Recovery: 15 backend unit checks and 15 mobile checks passed. Prisma generated and validated the expanded schema. No production services were used.
- Previous onboarding checks: a bootstrap dry run targeted an unreachable port and succeeded without connecting; an unconfirmed apply was refused. Neither command printed credentials.
- Native iOS/Android JavaScript export passed. Native screen/runtime acceptance could not run locally: `xcrun simctl` is unavailable. The browser checks below cover the website, not the new native invitation or recovery screens.

- Website smoke test passed: 18 pages, 13 image assets, real 404 response, and a 503 response when contact delivery is unconfigured.
- Browser screenshots inspected at 1280x720, 1440x900 and 390x844. Homepage media loaded, header and text fit, and document width matched viewport width. Both light and dark themes were exercised.
- Mobile menu, contact navigation and download modal were exercised. Escape dismissed the modal, restored scrolling and returned focus to its opener.
- The footer's Stan Paraclete link resolved to `https://www.stanparaclete.com/`.
- The checked website browser console contained no errors or warnings.
- Existing web-app tests and invitation-security suite passed locally. Mobile tests passed after a clean reinstall. One local package download timed out; retrying with the cache completed successfully.

Browser checks were representative, not an exhaustive accessibility audit or
proof of every application workflow. Website form success requires a configured
delivery service; no real enquiry was submitted in these checks.

## Scope Limits

No production database was used by the new tests. No migration, DNS cutover,
merge to `main`, or live publication was performed. The live branch remains
`3b5155579c126d4da1df0ccd496fd61bce8db5d0` at verification time.

CI exports are not signed APK/IPA releases. Electron packaging is not proof of
installer, update, printing or device behavior. The mobile audit still has
moderate transitive findings; the gate used here rejects high/critical issues,
not every advisory. Physical-device tests, full role/workflow acceptance,
operational monitoring and restore tests, missing product modules, signing and
the migration rehearsal remain as listed in `ECOSYSTEM_STATUS.md`.
