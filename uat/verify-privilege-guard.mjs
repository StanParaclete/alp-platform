#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// ALP — verify the profiles privilege guard on a REAL project
//
//   node uat/verify-privilege-guard.mjs
//
// Run this AFTER applying 20260814000003_profiles_privilege_guard.sql
// to the actual Supabase project. The mock proves the probe works; only
// this proves YOUR database is fixed.
//
// It runs the exact attacks, one at a time, and checks the protected
// fields after each — not once at the end, because a later attack can
// mask an earlier one by writing a value back.
//
//   1. role = admin   AND org_id = School B     (the full escalation)
//   2. role = director                          (privilege only)
//   3. org_id = School B                        (tenancy only)
//   4. status = active, invited_by = self       (the quiet ones)
//
// After every attempt: role, org_id and status must be unchanged.
// Then it checks the consequence rather than just the field — student
// access must still be School A and nothing else.
//
// Finally it proves the guard is not simply blocking all writes:
// full_name and school must still save, and it restores them after.
//
// WHY THE LEGITIMATE-FIELD CHECK MATTERS
// A trigger that froze every column would pass all four attacks and
// silently break the profile screen. "The attack failed" and "the guard
// is correct" are different claims.
//
// SETUP
//   export SUPABASE_URL=https://<ref>.supabase.co
//   export SUPABASE_ANON_KEY=<anon key>
//   export A_EMAIL=teacher.a@school-a.edu  A_PASSWORD=...
//
//   # School B's org id, either directly or by signing in as Teacher B:
//   export B_ORG_ID=<uuid>
//   #   or
//   export B_EMAIL=teacher.b@school-b.edu  B_PASSWORD=...
//
// SAFETY
// Every write here targets the caller's OWN profile row and nothing
// else. Legitimate fields are restored to their original values before
// the script exits, including on failure.
// ═══════════════════════════════════════════════════════════════════

import { rowsOf } from "./detectors.mjs";

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, "");
const ANON = process.env.SUPABASE_ANON_KEY;

const need = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "A_EMAIL", "A_PASSWORD"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}\nSee the header of this file.`);
  process.exit(2);
}
if (!process.env.B_ORG_ID && !(process.env.B_EMAIL && process.env.B_PASSWORD)) {
  console.error("Need either B_ORG_ID, or B_EMAIL and B_PASSWORD to look it up.");
  process.exit(2);
}

let failures = 0, checks = 0, skipped = 0;
const pass = (n, d = "") => { checks++; console.log(`  ok      ${n}${d ? "  (" + d + ")" : ""}`); };
const fail = (n, d = "") => { checks++; failures++; console.log(`  BREACH  ${n}${d ? "  — " + d : ""}`); };
const skip = (n, d = "") => { skipped++; console.log(`  skip    ${n}${d ? "  — " + d : ""}`); };

async function signIn(email, password) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const b = await r.json();
  if (!r.ok || !b.access_token) {
    console.error(`Sign-in failed for ${email}: ${b.error_description || b.msg || r.status}`);
    process.exit(2);
  }
  return b.access_token;
}
const uidOf = (t) => {
  try { return JSON.parse(Buffer.from(t.split(".")[1], "base64").toString()).sub; }
  catch { return null; }
};
async function q(token, path) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  const t = await r.text();
  let data = null; try { data = JSON.parse(t); } catch {}
  return { status: r.status, data };
}
async function patch(token, path, body) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: ANON, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let data = null; try { data = JSON.parse(t); } catch {}
  return { status: r.status, data };
}

// ═══════════════════════════════════════════════════════════════════
console.log("\nALP — profiles privilege guard verification");
console.log(`Target: ${URL_BASE}\n`);

const tokenA = await signIn(process.env.A_EMAIL, process.env.A_PASSWORD);
const aId = uidOf(tokenA);
if (!aId) { console.error("Could not read the caller's uuid from the JWT."); process.exit(2); }

let bOrg = process.env.B_ORG_ID;
if (!bOrg) {
  const tokenB = await signIn(process.env.B_EMAIL, process.env.B_PASSWORD);
  const bp = await q(tokenB, `profiles?id=eq.${uidOf(tokenB)}&select=org_id`);
  bOrg = rowsOf(bp)[0]?.org_id;
}
if (!bOrg) { console.error("Could not determine School B's org id."); process.exit(2); }

const FIELDS = "id,role,org_id,status,full_name,school,invited_by";
const read = async () => rowsOf(await q(tokenA, `profiles?id=eq.${aId}&select=${FIELDS}`))[0] || null;

const original = await read();
if (!original) {
  console.error("Could not read Teacher A's own profile row. Is the account provisioned?");
  process.exit(2);
}
if (original.org_id === bOrg) {
  console.error("Teacher A is already in School B. Point B_ORG_ID at a different school.");
  process.exit(2);
}
if (["admin", "director"].includes(original.role)) {
  console.error(`Teacher A has role '${original.role}'. This must run as a plain teacher — ` +
    "an admin is allowed to change roles inside their own school, so the result would be meaningless.");
  process.exit(2);
}

console.log(`  Teacher A: role=${original.role}, org=${original.org_id}`);
console.log(`  School B:  ${bOrg}\n`);

// ── The attacks ────────────────────────────────────────────────────
const ATTACKS = [
  { label: "role=admin + org_id=School B", body: { role: "admin", org_id: bOrg } },
  { label: "role=director",                body: { role: "director" } },
  { label: "org_id=School B",              body: { org_id: bOrg } },
  { label: "status + invited_by",          body: { status: "active", invited_by: aId } },
];

console.log("── attacks on protected fields ──────────────────────────────");
for (const a of ATTACKS) {
  const res = await patch(tokenA, `profiles?id=eq.${aId}`, a.body);
  const now = await read();

  // The write may be rejected outright, or accepted and neutralised by
  // the trigger. Both are correct — the guard reverts rather than
  // erroring so that legitimate fields in the same request still save.
  // What matters is the state afterwards, not the HTTP status.
  const drift = ["role", "org_id", "status", "invited_by"]
    .filter((f) => String(now?.[f]) !== String(original[f]));

  drift.length === 0
    ? pass(`${a.label} left every protected field unchanged`, `HTTP ${res.status}`)
    : fail(`${a.label} CHANGED a protected field`,
           drift.map((f) => `${f}: ${original[f]} → ${now?.[f]}`).join(", "));
}

// ── The consequence, not just the field ────────────────────────────
console.log("\n── consequence: student access is still School A ─────────────");
{
  const s = await q(tokenA, "students?select=id,org_id&limit=1000");
  const rows = rowsOf(s);
  const foreign = rows.filter((r) => r.org_id !== original.org_id);
  foreign.length === 0
    ? pass("every visible student is still in School A", `${rows.length} rows`)
    : fail("students from another school are now visible", `${foreign.length} foreign rows`);

  const b = await q(tokenA, `students?org_id=eq.${bOrg}&select=id`);
  rowsOf(b).length === 0
    ? pass("filtering explicitly by School B returns nothing")
    : fail("School B's students are readable", `${rowsOf(b).length} rows`);
}

// ── Prove the guard is not just blocking everything ────────────────
console.log("\n── legitimate fields still work ─────────────────────────────");
const marker = `guard-check-${Date.now()}`;
try {
  const res = await patch(tokenA, `profiles?id=eq.${aId}`, { full_name: marker, school: marker });
  const now = await read();
  now?.full_name === marker && now?.school === marker
    ? pass("full_name and school still save normally", `HTTP ${res.status}`)
    : fail("the guard is blocking LEGITIMATE profile edits",
           `full_name=${now?.full_name}, school=${now?.school} — the profile screen is broken`);

  // And a mixed request: legitimate field alongside a forged one. The
  // legitimate part must land, the forged part must not.
  const mixedName = `${marker}-mixed`;
  await patch(tokenA, `profiles?id=eq.${aId}`, { full_name: mixedName, role: "admin" });
  const after = await read();
  after?.full_name === mixedName && after?.role === original.role
    ? pass("a mixed request saves the safe field and drops the forged one")
    : fail("mixed request handled wrongly",
           `full_name=${after?.full_name}, role=${after?.role}`);
} finally {
  // Always restore, including on failure above.
  // Coerce undefined to null: JSON.stringify drops undefined keys, so a
  // field that was empty to begin with would silently not be restored
  // and the marker value would be left in the row.
  await patch(tokenA, `profiles?id=eq.${aId}`, {
    full_name: original.full_name ?? null,
    school: original.school ?? null,
  });
  const restored = await read();
  restored?.full_name === original.full_name && restored?.school === original.school
    ? console.log(`  restored full_name and school to their original values`)
    : console.log(`  ⚠ could not restore full_name/school — set them back by hand ` +
        `(was full_name=${original.full_name}, school=${original.school})`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("");
if (failures > 0) {
  console.log(`✗ ${failures} failure(s) across ${checks} checks — the guard is NOT in place. Do not start UAT.`);
} else if (skipped > 0) {
  console.log(`~ ${checks} checks passed, ${skipped} skipped — INCOMPLETE`);
} else {
  console.log(`✓ ${checks} checks passed — role and org_id are server-controlled on this project`);
}
console.log("");
process.exit(failures === 0 ? (skipped > 0 ? 3 : 0) : 1);
