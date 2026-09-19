# School Onboarding

This workflow belongs only to the parallel Express/PostgreSQL ecosystem. It does
not create or modify Supabase users, and is not a migration of existing accounts.

## First School

Apply the new database migrations and generate Prisma's client first. The
operator-only bootstrap command creates one school and one `SCHOOL_ADMIN` in an
otherwise empty ecosystem database. It refuses databases with existing users or
schools, runs atomically at serializable isolation, and records an audit event.
It does not create a global administrator or demo accounts.

Inject these variables using the approved secret manager or a protected process
environment. Do not put passwords in shell history, command-line arguments, Git,
chat, screenshots or CI logs:

| Variable | Value |
| --- | --- |
| `ALP_BOOTSTRAP_DATABASE_URL` | Explicit connection to the separate ecosystem database |
| `ALP_BOOTSTRAP_EMAIL` | Verified first administrator's email |
| `ALP_BOOTSTRAP_NAME` | Administrator's name |
| `ALP_BOOTSTRAP_PASSWORD` | Unique password, 12-256 characters |
| `ALP_BOOTSTRAP_SCHOOL` | Institution name |
| `ALP_BOOTSTRAP_COUNTRY` | Two-letter uppercase country code |
| `ALP_BOOTSTRAP_TIMEZONE` | IANA time zone, for example `Africa/Accra` |

From `05-backend`, run `npm run bootstrap`. This validates configuration without
connecting or writing. Set `ALP_BOOTSTRAP_CONFIRM` to the exact host, port and
database path it reports, then run `npm run bootstrap -- --apply`. Success prints
only school/user IDs. Remove the bootstrap variables from the runtime afterward.
Use `/auth/login` and `/me` to verify the new account. Credentials should be
handed over through the institution's approved secure channel.

A failed or concurrent attempt does not partially create a school. Do not rerun
test seeds to recover it. Investigate the failure, check the audit event and
account state, and avoid resetting existing credentials.

## Invitations

In the configured mobile app, a school administrator opens Settings > School
invitations. Choose the invited email and role. Parent/guardian invitations need
one or more active learner links; student invitations need exactly one. Staff
invitations do not take learner links. The server checks every linked learner
against the administrator's school, regardless of the submitted client values.

Invitations can grant school-administrator, teacher, specialist, therapist,
psychologist, parent or student membership. They cannot grant `SUPER_ADMIN` or
`DISTRICT_MANAGER`. District managers cannot create, list or revoke invitations.
School administrators can invite other school administrators; institutions must
approve this delegation policy before rollout.

The randomly generated 384-bit invitation code is shown once. Share it only with
the verified recipient through an approved private channel. Only its SHA-256 hash
is stored in the database. The code expires after 72 hours and is single-use.
The native share sheet does not prove delivery, and no automated invitation email
is sent. Lost codes can be revoked and replaced. Revocation affects a pending
invitation, not an already accepted membership.

The recipient opens Join a school. New users supply the invited email, their name
and a password. Existing users must sign in first and use Settings > Join another
school; an invitation cannot reset their password or change an existing school
role. Membership, learner links, consumption and audit records commit together.
The issuer must still be an enabled administrator when acceptance happens.

Codes are deliberately not embedded in URLs, deep links or analytics. The mobile
app keeps the one-time code in memory, not persistent storage. Recipient identity
and any consent needed for learner/family access are the institution's
responsibility; code possession is not an independent verification of legal
guardianship. Parents and students still see only linked learners and approved
plans under the existing API rules.

## API Contract

| Endpoint | Access / response |
| --- | --- |
| `POST /auth/invitations/register` | Code, email, name, password; new account only; 204 then normal sign-in |
| `POST /auth/invitations/accept` | Authenticated matching email + code; returns joined school ID |
| `GET /v1/invitations?offset=0` | School administrator; 50-item pages; never returns codes or hashes |
| `POST /v1/invitations` | School administrator; email, role, studentIds; returns code once |
| `PATCH /v1/invitations/:id/revoke` | Administrator of the same school; pending invitations only |

The `/v1` endpoints require `X-School-Id` and an active bearer session. Rate limits
apply to creation and redemption in addition to the global IP limiter.

## Remaining Gates

This is not complete identity administration. Password recovery, MFA, social
identity, email verification/delivery, additional-school provisioning, membership
removal/role changes and parent consent management remain separate work. The new
React/Vite browser interface is not yet connected. Native acceptance on real
devices, staging onboarding with institution-approved identities and migration
rehearsal are required before rollout.

Concurrency design follows Prisma's
[transaction and isolation guidance](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions).

Built by [Stan Paraclete](https://www.stanparaclete.com).
