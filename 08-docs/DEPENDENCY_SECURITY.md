# Dependency Security - 2026-10-05

Scope: the separate `codex/alp-ecosystem` branch. This is not a security
assessment of the deployed Supabase application. No live release was changed.

## Compatible Patches Applied

- Website: Next.js 16.3.5 to 16.3.8, addressing
  [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).
- Desktop: compatible lockfile updates for brace-expansion (1.1.21, 2.1.7,
  5.0.12), http-cache-semantics 4.3.0 and fast-uri 3.1.8.
- Backend: fast-uri 3.1.8.
- Mobile: brace-expansion 5.0.12. Expo, React Native and their supported React
  and animation peers were not downgraded or overridden.

The website, new browser client, desktop and backend local audits report zero
known vulnerabilities after these updates. That result is time-dependent and
does not replace code review, threat modelling or operational security testing.

## Mobile Release Blockers

The mobile audit still fails `npm audit --audit-level=high`: 19 high and 10
moderate package findings, including propagation through parent dependencies.
These are not 29 independent vulnerabilities.

| Leaf package | Dependency path | Advisory | Published patched version |
| --- | --- | --- | --- |
| braces 3.0.3 | Expo CLI -> Metro file map -> micromatch | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack exhaustion on deeply nested patterns | None as of 2026-10-05 |
| node-forge 1.4.0 | Expo CLI and Expo code-signing-certificates | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), RSA signature verification | None as of 2026-10-05 |

Both the registry's latest versions and the advisory's patched-version fields
were checked. The known dependency paths are in native development/build
tooling; this inventory does not prove that every affected function is unreachable
or that a signed artifact would be safe. Do not distribute native releases while
the high-severity gate is red. Do not expose Metro/Expo development services to
untrusted networks or run untrusted projects in the release/signing environment.

Moderate transitive findings also remain in decode-uri-component via
expo-router/query-string and uuid via Expo config-plugins/xcode. Track those
alongside the high findings. `npm audit fix --force` proposes incompatible major
changes/downgrades and is not an accepted fix.

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
