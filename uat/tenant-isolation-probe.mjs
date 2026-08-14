#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// ALP — Cross-tenant isolation probe
//
//   node uat/tenant-isolation-probe.mjs
//
// Runs against a REAL Supabase project with REAL accounts. It is the
// direct-API half of the tenant-isolation test: it signs in as Teacher
// A and then asks PostgREST for Teacher B's data by id, skipping the
// application entirely.
//
// This is deliberately not a browser test. Clicking through the UI
// proves the UI filters correctly; it does not prove the database
// refuses. The original org_id vulnerability was reachable by anyone
// who could type a URL — no UI involved — so the UI is the wrong place
// to look for it.
//
// SIX LAYERS
//   1. Reads      — can A see B's rows?
//   2. Writes     — can A change B's rows? (a separate property from 1)
//   3. RPC        — set_primary_guardian across a tenant boundary
//   4. Escalation — client-supplied org_id/role becoming authorization
//   5. Lifecycle  — pending / active / suspended accounts
//   6. Anonymous  — no session at all
//
// OUTCOMES: ok, BREACH, skip. A skip is never counted as a pass. If any
// probe could not run, the whole run is reported INCOMPLETE, because
// the point of this file is that a green result means something.
//
// SAFETY
// Reads are harmless. Writes are attempted as no-op rewrites (a field
// set to the value it already holds), so a successful write proves the
// breach without altering data. Inserts that succeed are deleted again
// using School B's own session. DELETE is destructive by nature and is
// skipped unless you pass --allow-delete.
//
//   --skip-writes    layers 2-4 read-only; reads and anonymous still run
//   --allow-delete   include the cross-tenant DELETE probe
//
// SETUP — two accounts in two different organisations, each with at
// least one student on their caseload:
//
//   export SUPABASE_URL=https://<ref>.supabase.co
//   export SUPABASE_ANON_KEY=<anon key>
//   export A_EMAIL=teacher.a@school-a.edu   A_PASSWORD=...
//   export B_EMAIL=teacher.b@school-b.edu   B_PASSWORD=...
//
// OPTIONAL — each unlocks a layer that is otherwise skipped:
//
//   export PROBE_SIGNUP_EMAIL=alp-probe-01@example.invalid
//        A disposable address. Layer 4 signs up with forged metadata
//        and checks the resulting profile is unprivileged. This leaves
//        a pending account behind — delete it afterwards.
//
//   export P_EMAIL=... P_PASSWORD=... P_EXPECT=pending|active|suspended
//        Layer 5. Run it three times as an administrator moves the
//        account through the states; the transitions themselves need a
//        human, the assertions do not.
//
// Use throwaway accounts on a staging project if you can.
// ═══════════════════════════════════════════════════════════════════

import * as D from "./detectors.mjs";

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, "");
const ANON = process.env.SUPABASE_ANON_KEY;
const SKIP_WRITES = process.argv.includes("--skip-writes");
const ALLOW_DELETE = process.argv.includes("--allow-delete");
const FUNCTIONS_URL = process.env.FUNCTIONS_URL?.replace(/\/$/, "") ||
  (URL_BASE ? URL_BASE.replace(".supabase.co", ".functions.supabase.co") : "");

const need = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "A_EMAIL", "A_PASSWORD", "B_EMAIL", "B_PASSWORD"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}\nSee the header of this file.`);
  process.exit(2);
}

let failures = 0;
let checks = 0;
let skipped = 0;

function pass(name, detail = "") {
  checks++;
  console.log(`  ok      ${name}${detail ? "  (" + detail + ")" : ""}`);
}
function fail(name, detail = "") {
  checks++; failures++;
  console.log(`  BREACH  ${name}${detail ? "  — " + detail : ""}`);
}
/** Not a pass. Counted separately so a run full of skips cannot read as green. */
function skip(name, why = "") {
  skipped++;
  console.log(`  skip    ${name}${why ? "  — " + why : ""}`);
}
/**
 * Applies a verdict. A predicate returning null means "could not be
 * determined" — reported as a skip, never as a pass.
 */
function assess(verdict, okName, badName, detail = "") {
  if (verdict === null) return skip(okName, "could not be determined");
  return verdict ? pass(okName, detail) : fail(badName, detail);
}
function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(2, 58 - title.length))}`);
}

// ── HTTP ───────────────────────────────────────────────────────────

async function signIn(email, password) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await r.json();
  if (!r.ok || !body.access_token) {
    console.error(`Sign-in failed for ${email}: ${body.error_description || body.msg || r.status}`);
    process.exit(2);
  }
  return body.access_token;
}

/** Sign in without exiting the process — for the optional accounts. */
async function trySignIn(email, password) {
  try {
    const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await r.json();
    return r.ok && body.access_token ? body.access_token : null;
  } catch { return null; }
}

/** The caller's own uuid, from the `sub` claim. No extra round trip. */
function userIdFrom(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")).sub || null;
  } catch { return null; }
}

/** Raw PostgREST call — no client library, no UI, no filtering. */
async function q(token, path) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, data, text };
}

async function write(method, token, path, body) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, data };
}

const patch = (t, p, b) => write("PATCH", t, p, b);
const post = (t, p, b) => write("POST", t, p, b);
const del = (t, p) => write("DELETE", t, p);

async function rpc(token, fn, args) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, data };
}

async function callFunction(token, name, body) {
  try {
    const r = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers: {
        apikey: ANON, Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    return { status: r.status, data, reachable: true };
  } catch (e) {
    return { status: 0, data: null, reachable: false, error: String(e) };
  }
}

const count = (res) => D.rowsOf(res).length;

// ═══════════════════════════════════════════════════════════════════
console.log("\nALP — cross-tenant isolation probe");
console.log(`Target: ${URL_BASE}\n`);

const tokenA = await signIn(process.env.A_EMAIL, process.env.A_PASSWORD);
const tokenB = await signIn(process.env.B_EMAIL, process.env.B_PASSWORD);
const aUserId = userIdFrom(tokenA);

// ── What each side legitimately holds ──────────────────────────────
const aStudents = await q(tokenA, "students?select=id,name,org_id");
const bStudents = await q(tokenB, "students?select=id,name,org_id");

if (count(aStudents) === 0 || count(bStudents) === 0) {
  console.error("Both accounts need at least one visible student. " +
    `A sees ${count(aStudents)}, B sees ${count(bStudents)}.`);
  process.exit(2);
}

// Each org comes from the caller's OWN profiles row, never from the
// first student they happen to see. Reading it off a student is
// circular: against a badly leaking database both accounts see the same
// rows, both "orgs" come out identical, and the probe aborts with
// "same organisation" at the exact moment it should be screaming. The
// profile row is authoritative and a leak cannot forge it.
const aProfile = await q(tokenA, `profiles?id=eq.${aUserId}&select=org_id`);
const bProfile = await q(tokenB, `profiles?id=eq.${userIdFrom(tokenB)}&select=org_id`);
const aOrg = D.rowsOf(aProfile)[0]?.org_id;
const bOrg = D.rowsOf(bProfile)[0]?.org_id;

console.log(`  Teacher A: ${count(aStudents)} student(s) visible, org ${aOrg}`);
console.log(`  Teacher B: ${count(bStudents)} student(s) visible, org ${bOrg}`);

if (!aOrg || !bOrg) {
  console.error("\nCould not read one of the accounts' own profile rows. " +
    "Both must be provisioned into a school before this probe can run.");
  process.exit(2);
}
if (aOrg === bOrg) {
  console.error("\nBoth accounts are in the SAME organisation. This probe needs two different schools.");
  process.exit(2);
}

// Pick targets by org, not by position — in a leaking database the
// first row either account sees may belong to the other school.
const victim = D.rowsOf(bStudents).find((s) => s.org_id === bOrg);
const mine = D.rowsOf(aStudents).find((s) => s.org_id === aOrg);

if (!victim || !mine) {
  console.error("\nEach account needs at least one student in its OWN school.");
  process.exit(2);
}

// Attack targets are enumerated with B's OWN session, because A is not
// supposed to be able to find them. Using B's token here is not
// cheating — it is how the probe learns which ids to aim at.
const bGuardians = await q(tokenB, `student_guardians?student_id=eq.${victim.id}&select=id,is_primary,parent_name`);
const bGoals = await q(tokenB, `goals?student_id=eq.${victim.id}&select=id,goal_text`);
const aGuardians = await q(tokenA, `student_guardians?student_id=eq.${mine.id}&select=id,is_primary`);

console.log(`\nProbing as Teacher A against School B's student ${victim.id}`);

// ═══════════════════════════════════════════════════════════════════
section("LAYER 1 — read isolation");

// ── 1. Direct fetch by id — the URL-manipulation case ──────────────
{
  const r = await q(tokenA, `students?id=eq.${victim.id}&select=*`);
  assess(D.directFetch(r),
    "direct student fetch by id returns nothing",
    "direct student fetch by id LEAKED a record",
    count(r) ? JSON.stringify(r.data).slice(0, 160) : "");
}

// ── 2. Unfiltered table scan ───────────────────────────────────────
{
  const r = await q(tokenA, "students?select=id,org_id&limit=1000");
  assess(D.unfilteredScan(r, aOrg),
    "unfiltered student scan returns only own org",
    "unfiltered student scan LEAKED foreign rows",
    `${count(r)} rows`);
}

// ── 3. Filtering by the other org's id directly ────────────────────
{
  const r = await q(tokenA, `students?org_id=eq.${bOrg}&select=*`);
  assess(D.orgFilter(r),
    "filtering by another org's id returns nothing",
    "org_id filter LEAKED another school's students",
    `${count(r)} rows`);
}

// ── 4. Guardian contacts — family PII ──────────────────────────────
{
  const r = await q(tokenA, `student_guardians?student_id=eq.${victim.id}&select=*`);
  assess(D.guardians(r),
    "guardian contacts for a foreign student return nothing",
    "guardian contacts LEAKED",
    count(r) ? JSON.stringify(r.data).slice(0, 160) : "");
}

// ── 5. Everything hanging off the student ──────────────────────────
for (const table of ["goals", "progress_entries", "alp_documents", "alp_versions",
                     "family_messages", "alp_consents"]) {
  const r = await q(tokenA, `${table}?student_id=eq.${victim.id}&select=*`);
  assess(D.childTable(r),
    `${table} for a foreign student returns nothing`,
    `${table} LEAKED`,
    `${count(r)} rows`);
}

// ── 6. Embedded resource — the join is a separate code path ────────
{
  const r = await q(tokenA, `goals?select=id,students!inner(id,name,org_id)&limit=1000`);
  assess(D.embeddedJoin(r, aOrg),
    "embedded student join exposes no foreign rows",
    "embedded join LEAKED foreign students");
}

// ── 7. The staff roster ────────────────────────────────────────────
{
  const r = await q(tokenA, "profiles?select=id,email,role,org_id&limit=1000");
  const foreign = D.rowsOf(r).filter((p) => p.org_id && p.org_id !== aOrg);
  assess(D.roster(r, aOrg),
    "profiles exposes no staff from other schools",
    "profiles LEAKED staff from other schools",
    foreign.length ? `${foreign.length} rows incl. ${foreign[0]?.email}` : `${count(r)} rows`);
}

// ── 8. Organisations ───────────────────────────────────────────────
{
  const r = await q(tokenA, "orgs?select=id,name&limit=1000");
  const foreign = D.rowsOf(r).filter((o) => o.id !== aOrg);
  assess(D.orgs(r, aOrg),
    "orgs exposes only the caller's own school",
    "orgs LEAKED other schools",
    foreign.map((o) => o.name).join(", ").slice(0, 120));
}

// ── 9. Audit log ───────────────────────────────────────────────────
{
  const r = await q(tokenA, "audit_log?select=id,org_id&limit=1000");
  assess(D.auditLog(r, aOrg),
    "audit_log exposes no foreign activity",
    "audit_log LEAKED foreign activity");
}

// ── 10. Notifications ──────────────────────────────────────────────
// Scoped by user_id, not org_id. The previous version of this probe
// computed a foreign-row list and then never used it, calling pass()
// unconditionally — it could not fail. It now compares against the
// caller's own uuid, taken from the JWT `sub` claim, and reports a skip
// rather than a pass when that uuid is unavailable.
{
  const r = await q(tokenA, "notifications?select=id,user_id&limit=1000");
  const verdict = D.notifications(r, aUserId);
  if (verdict === null) {
    skip("notifications scoped to the caller", "could not read the caller's uuid from the JWT");
  } else {
    const foreign = D.rowsOf(r).filter((n) => n.user_id && n.user_id !== aUserId);
    assess(verdict,
      "notifications returns only the caller's own rows",
      "notifications LEAKED another user's rows",
      foreign.length ? `${foreign.length} foreign rows` : `${count(r)} rows`);
  }
}

// ═══════════════════════════════════════════════════════════════════
section("LAYER 2 — write isolation");
// Read isolation and write isolation are separate properties. A policy
// with a correct USING clause and a missing WITH CHECK reads clean and
// writes wide open, so every probe above can pass while these fail.

if (SKIP_WRITES) {
  skip("all write probes", "--skip-writes");
} else {
  // ── W1. UPDATE a foreign student ─────────────────────────────────
  // Rewrites the name to the value it already holds: a successful write
  // proves the breach without altering anything.
  {
    const r = await patch(tokenA, `students?id=eq.${victim.id}`, { name: victim.name });
    assess(D.writeRefused(r),
      "UPDATE on a foreign student is refused",
      "cross-tenant UPDATE on students SUCCEEDED",
      `HTTP ${r.status}, ${count(r)} rows`);
  }

  // ── W2. INSERT a guardian onto a foreign student ─────────────────
  // org_id is deliberately omitted — the stamp_org_id trigger derives
  // it from the caller, which is exactly the behaviour under test.
  {
    const r = await post(tokenA, "student_guardians", {
      student_id: victim.id,
      parent_name: "ALP probe — delete me",
      relationship: "probe",
    });
    const wrote = D.rowsOf(r);
    assess(D.writeRefused(r),
      "INSERT of a guardian onto a foreign student is refused",
      "cross-tenant INSERT into student_guardians SUCCEEDED",
      `HTTP ${r.status}`);
    for (const row of wrote) {
      await del(tokenB, `student_guardians?id=eq.${row.id}`);
      console.log(`          cleaned up inserted guardian ${row.id}`);
    }
  }

  // ── W3. INSERT a goal onto a foreign student ─────────────────────
  {
    const r = await post(tokenA, "goals", {
      student_id: victim.id,
      goal_text: "ALP probe — delete me",
    });
    const wrote = D.rowsOf(r);
    assess(D.writeRefused(r),
      "INSERT of a goal onto a foreign student is refused",
      "cross-tenant INSERT into goals SUCCEEDED",
      `HTTP ${r.status}`);
    for (const row of wrote) {
      await del(tokenB, `goals?id=eq.${row.id}`);
      console.log(`          cleaned up inserted goal ${row.id}`);
    }
  }

  // ── W4. UPDATE a foreign guardian ────────────────────────────────
  // is_primary rewritten to its current value. Guardian records are the
  // family PII, and changing one silently redirects an ALP notice.
  if (count(bGuardians) === 0) {
    skip("UPDATE on a foreign guardian", "School B's student has no guardian contacts — add one");
  } else {
    const g = bGuardians.data[0];
    const r = await patch(tokenA, `student_guardians?id=eq.${g.id}`, { is_primary: g.is_primary });
    assess(D.writeRefused(r),
      "UPDATE on a foreign guardian is refused",
      "cross-tenant UPDATE on student_guardians SUCCEEDED",
      `HTTP ${r.status}`);
  }

  // ── W5. UPDATE a foreign goal ────────────────────────────────────
  if (count(bGoals) === 0) {
    skip("UPDATE on a foreign goal", "School B's student has no goals — add one");
  } else {
    const g = bGoals.data[0];
    const r = await patch(tokenA, `goals?id=eq.${g.id}`, { goal_text: g.goal_text });
    assess(D.writeRefused(r),
      "UPDATE on a foreign goal is refused",
      "cross-tenant UPDATE on goals SUCCEEDED",
      `HTTP ${r.status}`);
  }

  // ── W6. DELETE a foreign student ─────────────────────────────────
  // Destructive by nature: there is no no-op form of a delete. If it
  // succeeds the record is gone, and this probe cannot put it back.
  if (!ALLOW_DELETE) {
    skip("DELETE on a foreign student",
      "destructive — pass --allow-delete, ideally against a throwaway student in School B");
  } else {
    const r = await del(tokenA, `students?id=eq.${victim.id}`);
    assess(D.deleteRefused(r),
      "DELETE on a foreign student is refused",
      "cross-tenant DELETE SUCCEEDED — School B's student record has been destroyed",
      `HTTP ${r.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
section("LAYER 3 — set_primary_guardian() across the boundary");
// This RPC was hardened specifically. It runs an update, so a gap here
// rewrites which family an ALP notice is addressed to.

if (SKIP_WRITES) {
  skip("all RPC probes", "--skip-writes");
} else if (count(bGuardians) === 0) {
  skip("all set_primary_guardian probes",
    "School B's student has no guardian contacts — add one and re-run");
} else {
  const snapshot = async () => {
    const r = await q(tokenB, `student_guardians?student_id=eq.${victim.id}&select=id,is_primary`);
    return new Map(D.rowsOf(r).map((g) => [g.id, g.is_primary]));
  };
  let baseline = new Map(D.rowsOf(bGuardians).map((g) => [g.id, g.is_primary]));

  /**
   * Did School B's guardian records move? Run after EVERY attempt, and
   * compared against the state immediately BEFORE that attempt — not
   * against the original.
   *
   * Two reasons, both found by running this against a deliberately
   * leaking database. A single check at the end sees R1 reassign the
   * guardian away and R2 reassign it back, and reports "unchanged"
   * through a live breach. Comparing every attempt to the original
   * baseline has the same blind spot for the second attempt. Each
   * attempt has to be a no-op on its own.
   */
  async function assertUnmoved(label) {
    const now = await snapshot();
    // Three ways a record can have moved: a flag flipped, a guardian
    // vanished (reassigned to another student), or one appeared.
    const flipped = [...now].filter(([id, v]) => baseline.has(id) && baseline.get(id) !== v);
    const vanished = [...baseline.keys()].filter((id) => !now.has(id));
    const appeared = [...now.keys()].filter((id) => !baseline.has(id));
    const moved = flipped.length + vanished.length + appeared.length;
    moved === 0
      ? pass(`School B's guardian records are untouched after ${label}`, `${baseline.size} rows`)
      : fail(`${label} CHANGED School B's guardian records`,
             `${flipped.length} flipped, ${vanished.length} vanished, ${appeared.length} appeared`);
    // Re-baseline, so the next attempt is judged on its own effect
    // rather than inheriting damage this one already did.
    baseline = now;
  }

  // ── R1. Own student, foreign guardian ────────────────────────────
  // The case the hardening was written for: a guardian id from another
  // student would clear this student's primary and then set a stranger
  // as their primary contact.
  if (count(aGuardians) === 0) {
    skip("set_primary_guardian(own student, foreign guardian)",
      "School A's student has no guardian contacts");
  } else {
    const r = await rpc(tokenA, "set_primary_guardian", {
      p_student_id: mine.id,
      p_guardian_contact_id: D.rowsOf(bGuardians)[0].id,
    });
    assess(D.rpcRefused(r),
      "set_primary_guardian refuses a guardian from another student",
      "set_primary_guardian ACCEPTED a foreign guardian",
      `HTTP ${r.status}`);
    await assertUnmoved("the foreign-guardian attempt");
  }

  // ── R2. Foreign student, foreign guardian ────────────────────────
  {
    const r = await rpc(tokenA, "set_primary_guardian", {
      p_student_id: victim.id,
      p_guardian_contact_id: D.rowsOf(bGuardians)[0].id,
    });
    assess(D.rpcRefused(r),
      "set_primary_guardian refuses a foreign student entirely",
      "set_primary_guardian ACCEPTED a foreign student",
      `HTTP ${r.status}`);
    await assertUnmoved("the foreign-student attempt");
  }
}

// ═══════════════════════════════════════════════════════════════════
section("LAYER 4 — client-supplied org_id/role as authorization");
// The original vulnerability, kept as a permanent regression test. The
// SQL suite covers it inside Postgres; this covers it against the
// deployed endpoints, which is where it was actually reachable.

// ── E1. Self-escalation through profiles ─────────────────────────────
if (SKIP_WRITES) {
  skip("self-escalation via profiles", "--skip-writes");
} else if (!aUserId) {
  skip("self-escalation via profiles", "could not read the caller's uuid from the JWT");
} else {
  const r = await patch(tokenA, `profiles?id=eq.${aUserId}`, { role: "admin", org_id: bOrg });
  const verdict = D.selfEscalationRefused(r, aOrg);
  assess(verdict,
    "a teacher cannot rewrite their own role or org_id",
    "SELF-ESCALATION SUCCEEDED — a teacher rewrote their own profile",
    `HTTP ${r.status}`);
  if (verdict === false) {
    // Put it back. Best effort — if the breach is real this may also fail.
    await patch(tokenA, `profiles?id=eq.${aUserId}`, { role: "teacher", org_id: aOrg });
    console.log("          attempted to revert the escalated profile");
  }
}

// ── E2-E5. The invite/provisioning endpoint ──────────────────────────
{
  const target = process.env.PROBE_SIGNUP_EMAIL || `alp-probe-${Date.now()}@example.invalid`;

  const attempts = [
    { label: "role=admin, orgId=School B",   body: { email: target, role: "admin", orgId: bOrg } },
    { label: "role=teacher, orgId=School B", body: { email: target, role: "teacher", orgId: bOrg } },
    { label: "orgId=School B, no role",      body: { email: target, orgId: bOrg } },
    { label: "role=admin, own org",          body: { email: target, role: "admin", orgId: aOrg } },
  ];

  let reachable = true;
  for (const a of attempts) {
    const r = await callFunction(tokenA, "invite-user", a.body);
    if (!r.reachable) { reachable = false; break; }
    assess(D.escalationRefused(r),
      `invite-user refuses a teacher sending ${a.label}`,
      `invite-user ACCEPTED ${a.label}`,
      `HTTP ${r.status}`);
  }
  if (!reachable) {
    skip("invite-user escalation probes", `could not reach ${FUNCTIONS_URL}/invite-user`);
  }
}

// ── E6. Public signup carrying forged metadata ───────────────────────
// The trigger builds the profile from auth metadata, and a public
// signup controls that metadata entirely. The account being created is
// expected; what must not survive is the org and role inside it.
if (!process.env.PROBE_SIGNUP_EMAIL) {
  skip("public signup with forged org_id/role",
    "set PROBE_SIGNUP_EMAIL to a disposable address to run this");
} else {
  const email = process.env.PROBE_SIGNUP_EMAIL;
  const password = `Probe!${Math.random().toString(36).slice(2)}Aa1`;
  const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({
      email, password,
      data: { org_id: bOrg, role: "admin", status: "active", full_name: "ALP probe" },
    }),
  });
  const body = await r.json().catch(() => null);

  if (!r.ok) {
    skip("public signup with forged org_id/role",
      `signup did not complete: ${body?.msg || body?.error_description || r.status}`);
  } else {
    const probeToken = await trySignIn(email, password);
    if (!probeToken) {
      skip("public signup with forged org_id/role",
        "account created but not signable-in (email confirmation is on) — check its profiles row by hand");
    } else {
      const id = userIdFrom(probeToken);
      const p = await q(probeToken, `profiles?id=eq.${id}&select=org_id,role,status`);
      const profile = D.rowsOf(p)[0] || null;
      assess(D.signupNotEscalated(profile),
        "forged org_id/role in signup metadata is discarded",
        "SIGNUP ESCALATION — forged metadata became the profile",
        profile ? `org_id=${profile.org_id}, role=${profile.role}, status=${profile.status}` : "no profile row");

      const s = await q(probeToken, "students?select=id&limit=100");
      assess(D.anonymous(s),
        "the forged account can read no students",
        "the forged account CAN READ students",
        `${count(s)} rows`);
      console.log(`          leaves a pending account behind: ${email} — delete it in Authentication → Users`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
section("LAYER 5 — account lifecycle");
// Access must appear on provisioning and disappear on suspension, while
// the account survives for audit. The state transitions need an
// administrator; only the assertions are automated. Run this three
// times with P_EXPECT set to each state in turn.

if (!process.env.P_EMAIL || !process.env.P_PASSWORD) {
  skip("account lifecycle probes", "set P_EMAIL, P_PASSWORD and P_EXPECT to run this layer");
} else {
  const expect = (process.env.P_EXPECT || "pending").toLowerCase();
  const token = await trySignIn(process.env.P_EMAIL, process.env.P_PASSWORD);

  if (!token) {
    // For pending/suspended this looks harmless, but the spec says the
    // account stays intact and authenticates — so flag it, don't pass it.
    skip(`lifecycle (${expect})`, "the account could not sign in at all");
  } else {
    const reads = {};
    for (const t of ["students", "student_guardians", "goals", "orgs", "audit_log"]) {
      reads[t] = await q(token, `${t}?select=id&limit=100`);
    }

    if (expect === "active") {
      assess(D.hasOwnAccess(reads.students),
        "an active account can read its own school's students",
        "an active account can read NOTHING — provisioning did not take effect",
        `${count(reads.students)} rows`);
    } else {
      assess(D.noAccessAtAll(reads),
        `a ${expect} account reaches no data at all`,
        `a ${expect} account CAN READ data`,
        Object.entries(reads).map(([k, v]) => `${k}:${count(v)}`).join(" "));

      const inv = await callFunction(token, "invite-user", {
        email: `alp-probe-${Date.now()}@example.invalid`, role: "teacher",
      });
      inv.reachable
        ? assess(D.escalationRefused(inv),
            `a ${expect} account cannot invite anyone`,
            `a ${expect} account CAN INVITE`,
            `HTTP ${inv.status}`)
        : skip(`${expect} account invite probe`, "invite-user unreachable");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
section("LAYER 6 — no session at all");

for (const table of ["students", "student_guardians", "goals", "alp_documents",
                     "progress_entries", "orgs", "profiles", "audit_log"]) {
  const r = await fetch(`${URL_BASE}/rest/v1/${table}?select=*`, { headers: { apikey: ANON } });
  const data = await r.json().catch(() => null);
  assess(D.anonymous(data),
    `anonymous request to ${table} returns nothing`,
    `ANONYMOUS request to ${table} returned records`,
    `HTTP ${r.status}, ${D.rowsOf(data).length} rows`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("");
if (failures > 0) {
  console.log(`✗ ${failures} BREACH(es) across ${checks} probes — do not ship`);
} else if (skipped > 0) {
  console.log(`~ ${checks} probes passed, ${skipped} SKIPPED — run is INCOMPLETE`);
  console.log("  A skip is not a pass. The skipped layers are untested, not clean.");
} else {
  console.log(`✓ ${checks} probes, no cross-tenant leakage, nothing skipped`);
}
console.log("");

process.exit(failures === 0 ? (skipped > 0 ? 3 : 0) : 1);
