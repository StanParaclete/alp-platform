# ALP Desktop

Use Node 24, `npm ci`, then `npm start`. `npm test` checks navigation, download
and IPC policy. `npm run pack` creates an unpacked application for the current
platform. `npm run dist` creates installers without publishing. Build each OS
on a suitable runner and provide the owner's signing identities securely.

`release-config.json` points to the existing ALP login. Updates are disabled.
Enable them only after signed artifacts and a tested update feed are available.
The shell is local; remote content has no Node.js or preload access. The learner
session is memory-only, so the desktop requires a network connection. External
OAuth flows and offline caching are not yet supported.

Built by [Stan Paraclete](https://www.stanparaclete.com).
