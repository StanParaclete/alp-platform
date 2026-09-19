# ALP Mobile

Native Expo client for the separate API in `05-backend`. Not an App Store release.

Use Node 24. Run `npm ci`, set `EXPO_PUBLIC_API_URL` to the new HTTPS API origin,
then `npm start`. Run `npm test` and `npm run export` to verify the JavaScript
bundles. `npm run ios` / `npm run android` need the respective native toolchains.
EAS profiles are in `eas.json`; link the owner's Expo project and signing accounts
before producing installable builds. Never put API secrets in `EXPO_PUBLIC_*`.

School administrators can create and revoke invitations in Settings. Recipients
use Join a school on the sign-in screen; existing users sign in first and choose
Join another school in Settings. Invitation codes are shared manually through
the native share sheet, not automatically emailed. See
[School onboarding](../08-docs/ONBOARDING.md) for access and delivery boundaries.

Biometric-gated token storage is opt-in. Learner data is not persisted for offline
use; drafts currently recover only while the process is alive. Device camera,
remote push, signed releases and full offline sync remain release work.

Built by [Stan Paraclete](https://www.stanparaclete.com).
