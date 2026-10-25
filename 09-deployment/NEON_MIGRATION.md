# Render to Neon pilot migration

Status: rehearsal backup and restore verified on 2026-10-25. Production still
uses Render PostgreSQL; no live cutover or source deletion has occurred.

Target project created: `shy-glade-95234557` (ALP), AWS Oregon,
PostgreSQL 18, database `alp_svpq`. Approved snapshot copy restored and verified.

## Rehearsal Evidence: 25 October

- Consistent read-only source snapshot: 28 public tables, 36 total rows.
- Both servers: PostgreSQL 18. Both client TLS sessions encrypted with verified
  certificates using an explicit CA bundle. Neon's internal backend reports
  non-TLS; that is distinct from the verified encrypted client connection.
- Custom-format pg_dump streamed directly into AES-256-GCM encryption. No
  plaintext archive was written to disk. Archive authenticated before restore.
- Restored with pg_restore --single-transaction --exit-on-error --no-owner
  --no-acl into the previously empty Neon database.
- Every table's exact count and sorted record fingerprint, constraint definitions
  and sequence state matched the exported snapshot, including migration history.
- A separate verifier authenticated the saved archive; synthetic tests also
  confirmed that corruption and wrong keys release no plaintext to restore output.

Encrypted archive (owner-read/write only):
`/Users/hamzaobi/Documents/ALP-Backups/alp-render-2026-10-25T04-29-31.431Z.pgdump.aesgcm`

Recovery key (owner-read/write only, in a separate restricted directory):
`/Users/hamzaobi/Documents/ALP-Backup-Keys/alp-render-2026-10-25T04-29-31.431Z.key`

Aggregate verification report:
`/Users/hamzaobi/Documents/ALP-Backups/alp-render-2026-10-25T04-29-31.431Z.verification.json`

These local files are not committed. Keep key contents out of chat, logs and Git.
The key and archive are still on the same Mac: this is not protection against a
full host compromise or loss. An approved off-device archive and separate key
custody, retention and scheduled backup policy remain operational requirements.

### Actual Application Adapter Check

On 2026-10-25 ALP's Prisma/pg adapter successfully connected to the copied Neon
database using verified TLS and ran an explicitly read-only transaction. ORM
counts and user/membership/school and learner/plan/goal relationship queries
passed. All three migration records were completed. The aggregate report is
`/Users/hamzaobi/Documents/ALP-Backups/neon-prisma-readonly-2026-10-25.verification.json`.
No account passwords, names, emails or learner details were logged. The local
credential helper was stopped afterward. This does not verify login, writes,
rate limiting, queues, tenant authorization or capacity against Neon.

The connection factory now enforces certificate and hostname verification for
remote databases, rejects TLS-disable/bypass settings, and keeps local disposable
test connections non-TLS by default. `PGSSLROOTCERT` can supply an approved CA
bundle. Verify-full is enforced even for legacy require/verify-ca settings;
there is no compatibility switch that disables certificate checks. These code
changes are readiness-branch work, not a live deployment change.

From the repository root, authenticate without printing data:

```sh
node 09-deployment/verify-backup.mjs BACKUP_PATH KEY_PATH
```

For an approved restore, `--stream` authenticates first and then emits the custom
pg_dump archive to stdout. Pipe it directly to a compatible pg_restore process;
never display or redirect plaintext to an unencrypted file. Configure target
credentials through protected process environment/password files, not arguments.
Use a new empty target and transactional restore. Check both pipeline exit codes.

This is a rehearsal snapshot, not ongoing replication. Later Render writes are
not included. Before cutover, freeze writes, make a fresh final copy and verify
again. The existing populated Neon copy must not be silently overwritten; use an
approved fresh destination or an explicitly approved replacement procedure.

## Read-only preflight

Run `node --test 09-deployment/migration-preflight.test.mjs` for local checks.
Run `node 09-deployment/migration-preflight.mjs` with source and target URLs
provided securely as `ALP_SOURCE_DATABASE_URL` and `ALP_TARGET_DATABASE_URL`.
Both require verified TLS and direct connections. Optional `PG_DUMP_BIN` and
`PG_RESTORE_BIN` select compatible tools. The checker uses read-only transactions,
rejects nonempty targets, and outputs aggregate size/version metadata only.
It does not export data, prove authorization isolation, or authorize cutover.
Compare source size with the console quota and leave substantial growth headroom.

## Preconditions

- Create a dedicated ALP Neon Free project under the owner's account; select
  PostgreSQL 18 to match the source and a region near the Render API.
- Confirm the entire database fits within the project's current storage quota,
  leaving room for growth. User-count allowances do not establish capacity.
- Record target project, database, region, roles and approved data location.
- Enable MFA for hosting accounts. Keep connection strings in secret managers.
- Use direct, unpooled connections for export/restore. Use TLS with certificate
  verification; never set rejectUnauthorized=false to solve connection errors.
- Use PostgreSQL 18 or newer dump tools for the PostgreSQL 18 source.

## Copy and verify

1. Schedule a maintenance window and block application writes before the final
   export. An earlier rehearsal copy does not include subsequent writes.
2. Export with pg_dump custom format into an encrypted destination. Pass
   credentials through a protected password file or process environment rather
   than command-line URLs, shell history, logs or Git. Restrict file permissions.
3. Restore into a new, empty Neon database with pg_restore --no-owner --no-acl
   --exit-on-error. Do not use --clean against an existing database.
4. Compare every application table's exact row counts, constraints, sequences,
   Prisma migration history and representative record relationships. Do not
   print student records or password hashes in verification output.
5. Create a runtime role with only required schema usage, table operations and
   sequence permissions. Keep ownership, DDL and role administration with a
   separate migration identity. Check default privileges for future migrations.
6. Run migrations and integration checks on the target's isolated test data.
   Verify cross-school denial, role restrictions, session rotation and invitation
   acceptance. Never run destructive test seeds against copied school data.
7. Test an actual restore from the encrypted backup before accepting the copy.

## Cutover and rollback

- Record the existing Render DATABASE_URL securely before changing it.
- Keep writes blocked, update only the API's database secret and redeploy.
- Check readiness, sign-in, school-scoped reads, draft writes and invitation
  delivery. Re-enable writes only after these checks pass.
- If verification fails before writes resume, restore the former database
  configuration and redeploy. After target writes begin, switching back alone
  loses new changes: reconcile/export those writes first.
- Retain the source until migration acceptance and backup verification. Do not
  delete it as part of the initial cutover.

## School data and free-plan limits

- The application runtime can access multiple schools. Current tenant isolation
  depends on server-side authorization; do not claim database RLS protection
  without implementing and testing it.
- Do not copy identifiable school data into development branches, public CI,
  screenshots, analytics or AI prompts. Confirm the school's permission and
  applicable retention/data-location requirements before migration.
- Neon Free's short restore history does not replace an independent encrypted
  backup. Define backup frequency, storage, retention, operator and restore test.
- Monitor storage, connections, compute quota, errors and cold-start latency.
  Keep the pilot limited until measured concurrency and recovery tests pass.

References:
- https://neon.com/docs/import/migrate-from-postgres
- https://neon.com/docs/manage/backup-pg-dump
- https://neon.com/docs/introduction/plans
