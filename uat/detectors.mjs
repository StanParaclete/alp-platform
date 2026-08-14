// ═══════════════════════════════════════════════════════════════════
// ALP — leak-detection predicates
//
// Pure functions, no network. Imported by BOTH tenant-isolation-probe
// (which feeds them real responses) and probe-selftest (which feeds
// them fixtures).
//
// They live here rather than inside the probe for one reason: the
// self-test used to re-declare its own copy of every predicate, so it
// proved that a *copy* of the logic worked. The probe could drift and
// the self-test would stay green. One definition, two callers.
//
// CONVENTION: every predicate returns true when the system behaved
// correctly (no breach) and false when it leaked. Never throw —
// a predicate that throws on a malformed response would be read as a
// crash rather than as a finding.
// ═══════════════════════════════════════════════════════════════════

/** Rows from a response, treating an error/non-array as zero rows. */
export const rowsOf = (res) =>
  Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];

// ── READ ISOLATION ─────────────────────────────────────────────────

/** A fetch by another org's record id must return nothing. */
export const directFetch = (rows) => rowsOf(rows).length === 0;

/** An unfiltered scan must return only the caller's own org. */
export const unfilteredScan = (rows, myOrg) =>
  rowsOf(rows).filter((r) => r.org_id !== myOrg).length === 0;

/** Filtering explicitly by another org's id must return nothing. */
export const orgFilter = (rows) => rowsOf(rows).length === 0;

/** Guardian contacts for a foreign student must return nothing. */
export const guardians = (rows) => rowsOf(rows).length === 0;

/** Any child table keyed by a foreign student_id must return nothing. */
export const childTable = (rows) => rowsOf(rows).length === 0;

/**
 * PostgREST resource embedding is a separate code path from the
 * top-level table, so a policy that guards `goals` may still expose
 * `students` through the join.
 */
export const embeddedJoin = (rows, myOrg) =>
  rowsOf(rows).filter((r) => r.students && r.students.org_id !== myOrg).length === 0;

/**
 * Staff roster. A null org_id is a pending account, not a foreign one —
 * counting it as foreign would produce a false breach on every project
 * that has an unprovisioned signup sitting in it.
 */
export const roster = (rows, myOrg) =>
  rowsOf(rows).filter((r) => r.org_id && r.org_id !== myOrg).length === 0;

/** The orgs table must expose only the caller's own school. */
export const orgs = (rows, myOrg) =>
  rowsOf(rows).filter((r) => r.id !== myOrg).length === 0;

/** Audit log must expose no other school's activity. */
export const auditLog = (rows, myOrg) =>
  rowsOf(rows).filter((r) => r.org_id && r.org_id !== myOrg).length === 0;

/**
 * Notifications are scoped by user_id, not org_id — so the org-based
 * predicates do not apply and a caller-id comparison is the only real
 * check.
 *
 * Returns null (not true) when the caller's own uuid is unknown. The
 * previous version of this predicate computed a `foreign` list and then
 * ignored it, calling pass() unconditionally — it could not fail. A
 * check that cannot fail is reported as SKIPPED here, never as ok.
 */
export const notifications = (rows, myUserId) => {
  if (!myUserId) return null;
  return rowsOf(rows).filter((r) => r.user_id && r.user_id !== myUserId).length === 0;
};

/** An unauthenticated request carrying only the anon key must return nothing. */
export const anonymous = (rows) => rowsOf(rows).length === 0;

// ── WRITE ISOLATION ────────────────────────────────────────────────
// Read isolation and write isolation are separate properties. A policy
// set can have a correct USING clause and a missing WITH CHECK clause,
// which reads clean and writes wide open.

/**
 * A cross-tenant UPDATE/INSERT. Requests are sent with
 * `Prefer: return=representation`, so RLS refusing the row yields an
 * empty array and a successful write yields the row it touched.
 *
 * A 2xx with zero rows is the correct outcome — PostgREST reports "no
 * rows matched the policy", not an error.
 */
export const writeRefused = (res) => {
  const rows = rowsOf(res);
  if (rows.length > 0) return false;              // it wrote something
  return true;
};

/**
 * A cross-tenant DELETE. Same shape as writeRefused, kept separate
 * because a false here means data has ALREADY been destroyed — the
 * probe cannot undo it, and the caller needs to say so differently.
 */
export const deleteRefused = (res) => rowsOf(res).length === 0;

// ── RPC ────────────────────────────────────────────────────────────

/**
 * set_primary_guardian() must refuse a guardian that belongs to another
 * student. Correct behaviour is an error object (23503) or an empty
 * result — anything that returns a guardian row is the breach.
 */
export const rpcRefused = (res) => {
  const body = res?.data ?? res;
  if (body && typeof body === "object" && !Array.isArray(body) && body.code) return true;
  if (res?.status >= 400) return true;
  return rowsOf(res).length === 0 && !(body && body.id);
};

// ── PRIVILEGE ESCALATION ───────────────────────────────────────────

/**
 * The original vulnerability: a client-supplied organisation identifier
 * becoming authorization. Any endpoint handed `org_id`/`role` by the
 * caller must refuse — a 2xx here is the breach, whatever the body says.
 */
export const escalationRefused = (res) => {
  const status = res?.status ?? 0;
  // Status 0 means the request never landed. "Nothing came back" is not
  // evidence of a refusal — returning true here would turn an
  // unreachable Edge Function into a silent pass on the single most
  // important regression test in the suite.
  if (status === 0) return null;
  if (status >= 400) return true;
  const body = res?.data ?? {};
  return body?.success !== true && !body?.userId;
};

/**
 * A signup that carried forged metadata must produce an UNPRIVILEGED
 * profile: no org, default role, pending. The account being created is
 * expected — signup is public. What must not survive is the metadata.
 */
export const signupNotEscalated = (profile) => {
  // No readable profile row is NOT evidence of safety — it may simply
  // mean the account cannot see itself. Undetermined, so the probe
  // reports a skip and the operator checks by hand.
  if (!profile) return null;
  if (profile.org_id) return false;                // took a school
  if (profile.role && profile.role !== "teacher") return false;
  if (profile.status && profile.status !== "pending") return false;
  return true;
};

/** A caller must not be able to rewrite their own role or org_id. */
export const selfEscalationRefused = (res, myOrg) => {
  const rows = rowsOf(res);
  if (rows.length === 0) return true;
  return !rows.some((r) => (r.role && r.role !== "teacher") || (r.org_id && r.org_id !== myOrg));
};

// ── ACCOUNT LIFECYCLE ──────────────────────────────────────────────

/**
 * A pending or suspended account authenticates but must reach nothing.
 * Authentication succeeding is not a finding; data arriving is.
 */
export const noAccessAtAll = (results) =>
  Object.values(results || {}).every((r) => rowsOf(r).length === 0);

/** An active account must reach its own org's data — the negative control. */
export const hasOwnAccess = (rows) => rowsOf(rows).length > 0;
