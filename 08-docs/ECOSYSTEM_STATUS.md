# Ecosystem Status

Updated 2026-09-21. This is an implementation inventory, not production approval.
The expanded ecosystem is incomplete. Live ALP has not been migrated.

All five jobs passed for code commit `36efe31aacd41eff02fe55e9db873f7897bdc5a6`
in [CI run 35541663342](https://github.com/StanParaclete/alp-platform/actions/runs/35541663342).
See [verification evidence](VERIFICATION.md) for scope and remaining gaps.

The current onboarding increment adds operator-controlled first-school setup and
single-use school invitations, with mobile creation, revocation and acceptance.
Its unit tests and real PostgreSQL acceptance/security checks pass in CI.
See [onboarding scope and release gates](ONBOARDING.md).

The password-recovery increment adds encrypted mail delivery, a mobile reset
flow and atomic session revocation. Backend/mobile tests (15 each), Prisma
validation, native JavaScript exports, all three migrations and PostgreSQL race
tests pass in CI. No real SMTP or native-device check has run.
See [recovery operations and acceptance](PASSWORD_RECOVERY.md).

| Area | Implemented | Verification and remaining gate |
| --- | --- | --- |
| 01-website | Next.js pages, configurable supplied media, logo palette, theme, platform gateway, linked credit, server-side enquiry forwarding | CI build, contact tests and all-page smoke checks pass. Desktop/mobile browser checks completed. Full accessibility review, configured delivery, legal review and separate staging deployment remain. |
| 02-webapp | Existing Supabase app preserved; supplied imagery, shared credit, login/signup entry paths, privacy-conscious PWA fallback | Build and focused tests run locally. Changes are unpublished. Real signup and five-role acceptance checks remain. |
| 03-app | Expo native screens for authentication, password recovery, school selection, students, 13-section plan editing, autosave, revisions, goals, observations, messages, notifications and account invitations | Clean CI install, 15 tests and iOS/Android JavaScript exports pass. These are not signed native binaries. Physical device tests and store distribution remain. |
| 04-software | Sandboxed Electron client for existing ALP, menus, tray, print/downloads, explicit update controls, linked footer | Policy tests, unsigned macOS arm64 packaging and CI Linux packaging passed. Platform runtime tests, Windows packaging, signing, notarization, installer and updater acceptance remain. |
| 05-backend | Separate Express/Prisma API, first-school bootstrap, scoped invitations, tenant membership checks, linked learner access, JWT rotation/revocation, password recovery with encrypted mail outbox, revision checks, audit records, enquiry outbox and Redis limits | 15 unit tests, real PostgreSQL/Redis checks and high-severity dependency gate pass in CI. SMTP/queue delivery and staging onboarding require separate acceptance. |
| 06-database | Initial PostgreSQL, invitation and password-recovery migrations, plus strict synthetic test seed | All three migrations pass in disposable CI PostgreSQL. No production migration has been run. Restore, migration rehearsal and rollback proof required. |
| 07-assets | Supplied photos/video, existing logo and editable media catalog | Photos are illustrative, not customers or testimonials. Video is disabled pending review. Owner must confirm publication rights. |
| 08-docs / 09-deployment | Current status, migration boundaries and deployment configuration | Container/provider deployments need execution in staging; configuration alone is not release evidence. |

## Access Boundaries

The new API has nine membership roles. All roles require explicit school
membership, including super admins and district managers. Staff currently have
school-wide access, not assigned-caseload restrictions. Parents and students
only access linked learner records and approved plans. Internal plan history
and staff edits are restricted. This policy needs institution approval before
rollout. Existing production role rules are unchanged.

Framework checks currently validate institution-configured required sections.
They do not certify compliance with any country's laws or regulations.

## Not Yet Implemented in the New Ecosystem

- A new React/Vite client integrated with the new API; `02-webapp` still uses Supabase.
- MFA, social identity integration, automated invitation email, additional-school administration and membership removal/role changes. First-school bootstrap, manually shared account invitations and opt-in password recovery are implemented; staging and device acceptance remain.
- Complete service/accommodation workflows, document storage, camera uploads, signatures and meeting scheduling. Several corresponding database models exist without finished endpoints or interfaces.
- AI assistance, validated risk prediction, generated PDF/Word reports and school/district analytics in the new API.
- Encrypted offline learner storage, persistent offline edits, conflict synchronization and remote push delivery. Mobile currently requires connectivity and keeps unsaved drafts in memory.
- CMS administration, operational billing, retention/deletion jobs and production observability/backup drills.

The desktop currently opens the existing live email-login flow; it does not
expose arbitrary external identity-provider navigation. Its session is memory
only. Updates remain disabled until signed release artifacts are available.
The mobile dependency audit has moderate transitive Expo findings to review;
do not force incompatible dependency overrides just to silence the report.

## Release Evidence

Run `.github/workflows/ecosystem.yml` on the test branch. Its database job uses
fresh, disposable PostgreSQL and Redis without production secrets. The dedicated
integration command fails if either service URL is missing. A green source build
does not substitute for native/device, accessibility, migration or live-account
acceptance. Record commit SHA, run URL and results with each release candidate.

Existing live checks in `DEPLOYMENT.md`, including signup, AI function funding,
fixture cleanup and staging security secrets, are still separate outstanding work.
