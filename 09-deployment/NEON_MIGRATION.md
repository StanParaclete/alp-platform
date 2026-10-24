# Render to Neon pilot migration

Status: preparation only. Production still uses Render PostgreSQL.

Target project created: `shy-glade-95234557` (ALP), AWS Oregon,
PostgreSQL 18, database `alp_svpq`. No school records copied yet.

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
