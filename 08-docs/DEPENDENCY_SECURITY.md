# Dependency Security

## Update: 2026-10-24

Separate readiness-branch changes only; no live deployment was updated.

- Website Next.js: 16.4.3. Audit: zero findings. Six tests, production build and
  smoke verification of 18 pages/13 images passed.
- Browser workspace Vite: 8.3.5. Audit: zero findings. Eight tests and production
  build passed.
- Desktop Electron: 44.9.3; compatible transitive patches include undici 7.30.1
  and 6.29.1, fast-uri 3.1.9. Audit: zero findings. Four policy tests passed.
  No new signed installer or physical-device acceptance is claimed.
- Backend Zod: 4.6.7; Nodemailer: 10.2.1; compatible transitive patches include
  body-parser 2.4.0 and fast-uri 3.1.9. Audit: zero findings. Local suite: 23
  passed, two service tests skipped. Fresh service-backed CI remains required.
- Mobile audit: five high and six moderate package findings. Registry latest
  node-forge is still 1.4.0, which the audit flags. Expo also depends on Zod 3;
  forcing Zod 4 into that dependency is not a reviewed compatibility fix.
  No forced Expo downgrade, audit exclusion or reduced threshold was used.

The older dated inventory below is historical; its counts and versions are not
the current assessment. Audit success is time-dependent and is not a complete
security certification. Native distribution remains blocked by the mobile gate
and unsigned/unverified release artifacts.

## Historical Inventory: 2026-10-08

Scope: the separate `codex/alp-ecosystem` branch. This is not a security
assessment of the deployed Supabase application. No live release was changed.

## Compatible Patches Applied

- Website: Next.js 16.3.5 to 16.3.8, addressing
  [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).
- Desktop: compatible lockfile updates for brace-expansion (1.1.21, 2.1.7,
  5.0.12), http-cache-semantics 4.3.0 and fast-uri 3.1.8.
- Backend: fast-uri 3.1.8 and proxy-addr 2.0.8.
- Website and browser workspace: compatible overrides for patched `sharp`
  0.35.5 and `source-map-js` 1.2.2 where required by Next, Tailwind/PostCSS and
  Vite dependency trees.
- Mobile: brace-expansion 5.0.12. Expo, React Native and their supported React
  and animation peers were not downgraded or overridden. A safe lockfile-only
  audit cleanup removed the transient `source-map-js` and `shell-quote` reports
  without using `--force`.

The website, new browser client, desktop and backend local audits report zero
known vulnerabilities after these updates. That result is time-dependent and
does not replace code review, threat modelling or operational security testing.

## Mobile Release Blockers

The mobile audit still fails `npm audit --audit-level=high`: 18 high and 10
moderate package findings, including propagation through parent dependencies.
These are not 28 independent vulnerabilities.

| Leaf package | Dependency path | Advisory | Published patched version |
| --- | --- | --- | --- |
| braces 3.0.3 | Expo CLI -> Metro file map -> micromatch | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack exhaustion on deeply nested patterns | None as of 2026-10-08 |
| node-forge 1.4.0 | Expo CLI and Expo code-signing-certificates | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), RSA signature verification | None as of 2026-10-08 |

Both the registry's latest versions and the advisory's patched-version fields
were checked. The known dependency paths are in native development/build
tooling; this inventory does not prove that every affected function is unreachable
or that a signed artifact would be safe. Do not distribute native releases while
the high-severity gate is red. Do not expose Metro/Expo development services to
untrusted networks or run untrusted projects in the release/signing environment.

Moderate transitive findings remain in decode-uri-component via
expo-router/query-string and uuid via Expo config-plugins/xcode. Track those
alongside the high findings. `npm audit fix --force` proposes incompatible major
changes/downgrades, including older Expo packages, and is not an accepted fix.

## Closure Evidence Required

1. Adopt patched upstream versions compatible with the supported Expo SDK, or a
   separately reviewed and tested dependency replacement. Recheck actual paths
   with `npm ls braces node-forge brace-expansion decode-uri-component uuid`.
2. Run a clean `npm ci`, the native peer-alignment/unit tests, the unchanged
   high-severity audit gate and both platform JavaScript exports.
3. Repeat signed native build and physical-device acceptance before distribution.
   Exporting JavaScript alone is not release evidence.

No audit exclusions, `continue-on-error`, force install or reduced severity
threshold were added. CI should continue to fail the mobile job until resolved.
