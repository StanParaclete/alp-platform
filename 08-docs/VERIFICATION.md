# Verification Record - 2026-09-19

Code commit: `f6842b85eafa247e0f26970629688df449be6307`

[GitHub Actions run 35455307223](https://github.com/StanParaclete/alp-platform/actions/runs/35455307223)
completed successfully. All five jobs passed:

| Job | Checks |
| --- | --- |
| existing-webapp | Clean install; login, PWA, supplied-media and invitation-authorization checks; Vite production build. |
| applications (01-website) | Clean install; contact validation/failure tests; dependency high-severity gate; Next.js production build; standalone HTTP smoke test. |
| applications (03-app) | Clean install; eight tests covering API origins, session races, draft revisions and Expo peer alignment; dependency high-severity gate; iOS and Android JavaScript exports. |
| applications (04-software) | Clean install; four navigation/download/IPC policy tests; dependency high-severity gate; unpacked Linux Electron build. |
| database | Prisma generation and validation; five domain/security unit tests; migration against fresh PostgreSQL 16; real tenant isolation, parent access, revision history, session rotation/replay/revocation and enquiry persistence tests; real Redis limit/expiry/disconnection test; dependency high-severity gate. |

The preceding run, 34837809154, failed the mobile dependency install because
React DOM 19.3.0 did not match Expo's React 19.2.3. The fix pins React DOM and
native animation peers to the installed Expo SDK's supported versions. No
`--force` or `--legacy-peer-deps` bypass is required. An automated test now
checks the declared, locked and installed versions against the SDK metadata.

## Local Evidence

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
