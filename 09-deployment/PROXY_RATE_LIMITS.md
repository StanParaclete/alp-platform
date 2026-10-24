# Proxy and Rate-Limit Acceptance

Status: configuration support only. No production proxy allowlist is approved.

ALP uses Express `req.ip` to derive hashed rate-limit keys. With no allowlist,
forwarded headers are ignored and the socket peer is used. This resists spoofing,
but users behind a shared ingress can share a global/recovery limit.

`ALP_TRUSTED_PROXY_CIDRS` accepts comma-separated explicit IPv4/IPv6 addresses or
CIDRs. It rejects universal networks, hop counts, booleans, names and empty list
entries. Leave it blank unless each trusted proxy and header-rewriting boundary
has been verified. An IP range is not trustworthy merely because it is private
or belongs to a hosting provider. Never copy the loopback test settings to hosted
production. Do not use `trust proxy=true` or a guessed hop count.

## Staging Verification

1. Document every route: browser to Netlify gateway to Render ingress to API,
   and direct access to the Render hostname. Confirm supported ingress source
   ranges with the providers; account for autoscaling and range changes.
2. Verify how each trusted boundary removes, replaces or appends forwarded
   headers. Use a temporary restricted diagnostic if necessary; do not publish
   a raw client-IP endpoint or retain personal IP logs as test artifacts.
3. Configure only the verified proxy addresses. If trustworthy address attribution
   cannot be established, keep the default and resolve topology before rollout.
4. From two controlled client networks, verify that limits are separate when
   they should be, while repeated requests from one caller still share a limit.
5. Repeat through the gateway and the direct origin. Inject forged leftmost
   `X-Forwarded-For` values and confirm they cannot evade limits. Direct-origin
   access must not offer a shorter trusted path that permits spoofing.
6. Confirm Redis outages fail closed and rate-limit responses contain no codes,
   tokens or personal information. Keep account/email-specific limits enabled.

Unit tests cover default denial, parsing and nearest-untrusted-hop behavior.
They do not prove the hosting providers' real header behavior or production capacity.

Reference: [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/).

Built by [Stan Paraclete](https://www.stanparaclete.com/).
