#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# Run the ALP RLS tests against a throwaway local Postgres.
#
#   ./supabase/tests/run-local.sh
#
# The supported path is `supabase test db`, which needs Docker. This
# script is the fallback for CI runners and machines without it: plain
# Postgres 16 + pgTAP, no containers.
#
# Requires: postgresql-16, postgresql-16-pgtap
#   sudo apt-get install -y postgresql-16 postgresql-16-pgtap
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

DB="${ALP_TEST_DB:-alp_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"
PSQL_HOST="${PGHOST:-/tmp}"

run() { psql -h "$PSQL_HOST" -X -q -v ON_ERROR_STOP=1 "$@"; }

echo "▸ Recreating $DB"
psql -h "$PSQL_HOST" -X -q -c "drop database if exists $DB;" -c "create database $DB;"

echo "▸ Installing extensions"
run -d "$DB" -c 'create extension if not exists pgcrypto;' \
             -c 'create extension if not exists pgtap;'

# ── Supabase-managed objects ──────────────────────────────────────
# A hosted project provides these. Recreated here so the migrations can
# be exercised without a Supabase instance. This is the ONLY place the
# test environment diverges from production — keep it in sync with
# Supabase's own definitions if you extend it.
echo "▸ Stubbing Supabase objects (auth schema, auth.uid, realtime)"
run -d "$DB" <<'SQL'
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Matches Supabase's definition: reads either claim shape.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
SQL

echo "▸ Applying migrations"
for m in "$MIGRATIONS"/*.sql; do
  printf '    %s\n' "$(basename "$m")"
  run -d "$DB" -f "$m"
done

echo "▸ Running tests"
echo
FAILED=0
for t in "$HERE"/*.test.sql; do
  name="$(basename "$t")"
  echo "── $name ──"
  out="$(psql -h "$PSQL_HOST" -X -q -t -A -d "$DB" -f "$t" 2>&1)" || FAILED=1

  # psql exits 0 even when a pgTAP assertion fails: a failed assertion is
  # a row of output, not a SQL error. Checking only the exit code gives a
  # green build over a red test suite — which is worse than no tests at
  # all, because it is trusted. Parse the TAP stream instead.
  if grep -qE '^\s*not ok' <<<"$out"; then FAILED=1; fi
  if grep -qE 'Looks like you (failed|planned)' <<<"$out"; then FAILED=1; fi

  # A file that runs clean but asserts nothing is also a failure.
  if ! grep -qE '^\s*ok 1' <<<"$out"; then
    echo "    no assertions ran in $name"
    FAILED=1
  fi

  grep -E '^\s*(not )?ok |^# ' <<<"$out" | sed 's/^/    /'
  echo
done

if [ "$FAILED" -ne 0 ]; then
  echo "✗ RLS tests FAILED — do not deploy."
  exit 1
fi
echo "✓ All RLS tests passed."
