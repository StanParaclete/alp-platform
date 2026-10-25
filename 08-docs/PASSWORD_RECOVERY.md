# Password Recovery

This is part of the separate Express/PostgreSQL API and Expo app. It does not
change the live Supabase login or the existing Electron client's login flow.
Recovery is disabled by default. Implemented behavior is not evidence of SMTP
delivery or native-device acceptance; those staging gates are listed below.

## Enable in Staging

1. Apply all three ecosystem migrations to the separate database and regenerate
   Prisma's client. Do not point migration or test commands at production.
2. Generate a separate cryptographically random 32-byte key, encoded as 64 hex
   characters. Inject it as `PASSWORD_RECOVERY_KEY` into both API and worker
   through a secret manager. Never reuse `JWT_SECRET` or expose this key to Expo.
3. Configure `DATABASE_URL` and `REDIS_URL` on the worker. Choose the same mail
   provider used by invitations. For `MAIL_PROVIDER=zoho`, set `ZOHO_CLIENT_ID`,
   `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_ID`, `ZOHO_FROM` and
   the account's `ZOHO_REGION`. This uses HTTPS and needs no SMTP credentials.
   Otherwise set `MAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
   `SMTP_PASSWORD` and `SMTP_FROM`. SMTP uses verified TLS: port 465 is implicit
   TLS; other ports require STARTTLS. Do not use SMTP on a host that blocks it.
4. Set `PASSWORD_RECOVERY_ENABLED=true` on API and worker and start the supervised
   worker with `npm run worker`. `CONTACT_RECIPIENT` is only required when also
   sending website enquiries. Check worker health and queue failures before
   exposing recovery to users.
5. Point a configured native staging build at this API and complete the email
   and device checks below. Disabled recovery returns 503, not a success claim.

The worker verifies SMTP connectivity/authentication or obtains a Zoho OAuth
access token at startup. OAuth success does not prove message scope, sender
authorization or inbox delivery; an actual recovery and change-notice test is
still required. A separately supervised worker must be deployed; invitation
delivery by the API does not mean the worker is running. See
[Nodemailer's SMTP documentation](https://nodemailer.com/smtp).

## User and API Contract

Open Forgot password on the mobile sign-in screen. Request a code for the account
email, then enter the email, complete emailed code and matching new password.
Passwords must contain 12-256 characters. Codes stay in screen memory, never
URLs, deep links, analytics or persistent mobile storage. Success clears local
session state and returns to normal sign-in; recovery does not issue a session.

| Endpoint | Input and outcome |
| --- | --- |
| `POST /auth/password/request` | `{email}`; 202 generic acknowledgement for every valid address, whether known, unknown or disabled |
| `POST /auth/password/reset` | `{email,code,password,confirmPassword}`; 204 only after the password change commits |

Invalid, expired, revoked, consumed or account-mismatched codes receive a generic
400. Request and reset endpoints each allow eight attempts per IP per 15 minutes.
Requesting more than three codes for an address per hour still returns the same
202 but queues nothing. A Redis outage fails closed with 503. The global API
limiter also applies. Configure a trusted proxy policy before public exposure;
do not trust arbitrary forwarded IP headers.

## Storage and Concurrency

Every allowed request writes the same outbox shape without looking up an account
in the HTTP handler. The worker alone checks whether an enabled account exists.
Codes have 384 random bits, expire after 30 minutes and are single-use. PostgreSQL
stores a SHA-256 verifier plus an AES-256-GCM encrypted delivery copy bound to its
row ID. Redis jobs contain only row IDs, never codes, passwords or message bodies.

Successful reset atomically changes the password, increments the credential
version, consumes the code, revokes other pending codes and all refresh sessions,
and writes an audit event and password-change notification. Login and refresh
issuance lock the same user row and compare its credential version, preventing
stale verified credentials from creating an active session after the reset.
Credential-changing, login and refresh transactions use a bounded five-second
pool-acquisition wait and fifteen-second transaction budget, allowing row-lock
contention across a remote database without removing atomic session revocation.
These database budgets are not a guaranteed HTTP response deadline. A timeout still
rolls back; no partial reset or automatic unsafe retry is permitted.
Other accounts are unaffected. Existing requests already authorized before a
reset are not canceled, but subsequent requests using old sessions are rejected.

These choices follow the account-enumeration, token, notification and session
guidance in the [OWASP password recovery cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Delivery and Operations

The worker scans the durable outbox every ten seconds using keyset pagination.
Enquiries use the same timestamp-and-ID pagination as recovery and account
notices, so a retained full page of failed deliveries cannot hide newer rows.
Queue failures propagate to the dispatcher and are retried on the next scan;
existing job IDs retain their configured retry state.
It clears encrypted codes after provider acceptance, revocation, use or expiry.
Expired reset rows are deleted after another 24 hours while the recovery worker
is enabled. Password-change notices and audit records do not yet have automated
retention; agree a policy before production. Database backups need their own
retention and encryption controls.

Delivery uses five attempts with exponential backoff starting at 30 seconds.
After exhaustion, jobs stay failed until an operator retries them; the dispatcher
does not reset a retained failed job. Monitor oldest pending rows, worker liveness
and failed queues. Retry only unexpired recovery requests after fixing the cause;
an expired code requires a new request. Clear invalid/obsolete failed jobs under
the operator's retention policy. Do not enable provider or request-body debug
logging: it can expose codes and addresses.

Provider acceptance is not inbox delivery. A crash after acceptance but before the
database acknowledgement can cause duplicate email on retry. The stable message
ID assists diagnosis but does not guarantee exactly-once delivery. Worker errors
stored in Redis and application logs are sanitized and identify only queue/job ID.
Use restricted provider diagnostics for delivery failures, with secret redaction.

Key rotation is not automatic. For routine rotation, close public recovery ingress,
drain pending delivery jobs with the old key, confirm no encrypted delivery copies
remain, stop the worker, update both processes and reopen ingress after testing.
For suspected compromise, disable recovery, revoke all pending codes and clear
encrypted copies before installing a new key; restore recovery only after review.
Do not discard the old key while valid encrypted outbox rows still need delivery.

## Acceptance Gates

- Run backend/mobile unit tests and the isolated PostgreSQL/Redis CI suite.
  Database tests cover expiry, revocation, retry, address nondisclosure,
  concurrent code use, reset/login/refresh races and account-change rejection.
- Tests use an injected mail transport, not real SMTP. Verify a synthetic account
  receives a code and a change notice through the configured provider. Check
  bounce/rejection, outage/retry and duplicate-delivery handling without real
  learner data. Do not publish test credentials or codes.
- Test request/reset screens on physical iOS and Android devices: keyboard and
  password manager behavior, code pasting, large text, screen readers, dark/light
  themes, network errors, background privacy and old biometric-session rejection.
- Run a staging reset with two devices signed in, verify both old sessions fail,
  and verify normal sign-in with the new password. Never perform this check on
  another person's live account.

Built by [Stan Paraclete](https://www.stanparaclete.com/).
