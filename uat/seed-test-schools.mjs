#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// ALP — seed the two-school test fixture
//
//   node uat/seed-test-schools.mjs
//
// The security gate cannot run without two teachers in two different
// schools, each with a student, a guardian and a goal. Creating that by
// hand through the UI takes twenty minutes and is easy to get subtly
// wrong — a teacher provisioned into the wrong org makes the probe
// report "same organisation" and refuse to run.
//
// This builds it in about ten seconds, and prints the exact environment
// variables the probe and the privilege-guard check expect.
//
// WHAT IT CREATES
//   School A ── Teacher A ── Student A ── Guardian A + Goal A
//   School B ── Teacher B ── Student B ── Guardian B + Goal B
//   plus one pending account with no org, for the lifecycle layer.
//
// It uses the SERVICE ROLE key, which bypasses RLS. That is correct
// here and only here: this script stands in for the provisioning that
// invite-user normally performs. It is the one legitimate path for
// setting role and org_id, exactly as SECURITY_RULES.md rule 1 says.
//
// ── RUN IT AGAINST A STAGING PROJECT IF YOU HAVE ONE ───────────────
// It writes real rows. Against production it adds two fake schools you
// will want to delete afterwards. It refuses to touch anything it did
// not create, and --clean removes exactly what it made.
//
// SETUP
//   export SUPABASE_URL=https://<ref>.supabase.co
//   export SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # never VITE_
//   node uat/seed-test-schools.mjs
//
//   node uat/seed-test-schools.mjs --clean    # remove the fixture
// ═══════════════════════════════════════════════════════════════════

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLEAN = process.argv.includes("--clean");

if (!URL_BASE || !SERVICE) {
  console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. See the header of this file.");
  process.exit(2);
}
// ── Refuse to touch production ──────────────────────────────────────
// This script writes fake schools and deletes rows. Production holds
// real children's records. The refusal is deliberate friction: set
// ALLOW_PRODUCTION_SEED=yes only if you genuinely mean it.
const PRODUCTION_REFS = ["sjutbbpajmqchrccdmwb"];
const ref = (URL_BASE.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
if (PRODUCTION_REFS.includes(ref) && process.env.ALLOW_PRODUCTION_SEED !== "yes") {
  console.error(`Refusing to run: ${ref} is the PRODUCTION project.\n` +
    "Point SUPABASE_URL at staging. Fixtures do not belong beside real student records.\n" +
    "If you are certain, set ALLOW_PRODUCTION_SEED=yes.");
  process.exit(2);
}

if (SERVICE.startsWith("sb_publishable_")) {
  console.error("That is the PUBLISHABLE key. Seeding needs the secret/service_role key.");
  process.exit(2);
}
if (SERVICE.length < 100) {
  console.error("That does not look like a service_role key. The anon key will not work — " +
    "it cannot create users and every insert will be refused by RLS.");
  process.exit(2);
}

// Everything this script creates carries this marker, so --clean can
// find its own rows and nothing else.
const TAG = "alp-uat-fixture";
const PASSWORD = "AlpUat!2026-probe";

const H = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

async function rest(method, path, body) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: { ...H, Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 300)}`);
  return data;
}

/** Sign in as a seeded teacher so their inserts carry their own org. */
async function signIn(email) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const b = await r.json();
  if (!r.ok || !b.access_token) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(b).slice(0,200)}`);
  return b.access_token;
}

/** PostgREST call as a signed-in user rather than the service role. */
async function asUser(token, method, path, body) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error(`${method} ${path} (as user) → ${r.status} ${text.slice(0,300)}`);
  return data;
}

async function admin(method, path, body) {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/${path}`, {
    method, headers: H,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { ok: r.ok, status: r.status, data, text };
}

/** Create the auth user, or reuse it if a previous run left one behind. */
async function ensureUser(email) {
  const made = await admin("POST", "users", {
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: email.split("@")[0], fixture: TAG },
  });
  if (made.ok) return made.data.id;

  if (/already|exists|registered/i.test(made.text)) {
    const list = await admin("GET", `users?filter=${encodeURIComponent(email)}`);
    const found = (list.data?.users || []).find((u) => u.email === email);
    if (found) { console.log(`    reusing existing ${email}`); return found.id; }
  }
  throw new Error(`could not create ${email}: ${made.status} ${made.text.slice(0, 200)}`);
}

// ═══════════════════════════════════════════════════════════════════
const ACCOUNTS = {
  a: "alp-uat-teacher-a@example.invalid",
  b: "alp-uat-teacher-b@example.invalid",
  p: "alp-uat-pending@example.invalid",
};

if (CLEAN) {
  console.log("\nRemoving the fixture…\n");
  // orgs cascade to students → guardians → goals, so orgs go last.
  const orgs = await rest("GET", `orgs?slug=like.${TAG}%25&select=id,name`);
  for (const email of Object.values(ACCOUNTS)) {
    const list = await admin("GET", `users?filter=${encodeURIComponent(email)}`);
    const u = (list.data?.users || []).find((x) => x.email === email);
    if (u) { await admin("DELETE", `users/${u.id}`); console.log(`  deleted account ${email}`); }
  }
  for (const o of orgs) {
    await rest("DELETE", `orgs?id=eq.${o.id}`);
    console.log(`  deleted school ${o.name} (and its students, guardians, goals)`);
  }
  console.log("\nDone. Nothing outside the fixture was touched.\n");
  process.exit(0);
}

console.log(`\nSeeding the two-school fixture on ${URL_BASE}\n`);

const schools = {};
for (const [key, name] of [["a", "UAT School A"], ["b", "UAT School B"]]) {
  const slug = `${TAG}-${key}`;
  const existing = await rest("GET", `orgs?slug=eq.${slug}&select=id`);
  schools[key] = existing.length
    ? existing[0].id
    : (await rest("POST", "orgs", { name, slug, country: "GH", plan: "free" }))[0].id;
  console.log(`  school ${name}  ${schools[key]}`);
}

if (schools.a === schools.b) {
  console.error("Both schools resolved to the same id — the probe would refuse to run.");
  process.exit(1);
}

const out = {};
for (const key of ["a", "b"]) {
  const email = ACCOUNTS[key];
  const uid = await ensureUser(email);

  // The one legitimate privilege write: service-role provisioning.
  // The guard trigger exempts service_role precisely for this.
  await rest("PATCH", `profiles?id=eq.${uid}`, {
    org_id: schools[key], role: "teacher", status: "active",
    full_name: `Teacher ${key.toUpperCase()}`, school: `UAT School ${key.toUpperCase()}`,
  });

  const check = await rest("GET", `profiles?id=eq.${uid}&select=org_id,role,status`);
  if (check[0]?.org_id !== schools[key] || check[0]?.status !== "active") {
    console.error(`  provisioning did not stick for ${email}:`, check[0]);
    console.error("  If org_id came back null, the privilege guard is rejecting the " +
      "service role — check current_user in guard_profile_privileges().");
    process.exit(1);
  }

  // From here on, act as the teacher. org_id is deliberately omitted —
  // the stamp_org_id trigger derives it from the caller, which is the
  // behaviour the tenant-isolation probe later tries to defeat.
  const token = await signIn(email);

  let students = await asUser(token, "GET",
    `students?name=eq.UAT%20Student%20${key.toUpperCase()}&select=id`);
  if (!students.length) {
    students = await asUser(token, "POST", "students", {
      teacher_id: uid, name: `UAT Student ${key.toUpperCase()}`,
      grade: "4", plan_type: "ALP",
    });
  }
  const sid = students[0].id;

  const g = await asUser(token, "GET", `student_guardians?student_id=eq.${sid}&select=id`);
  if (!g.length) {
    await asUser(token, "POST", "student_guardians", {
      student_id: sid, parent_name: `Guardian ${key.toUpperCase()}`,
      relationship: "mother", is_primary: true, created_by: uid,
    });
  }

  const gl = await asUser(token, "GET", `goals?student_id=eq.${sid}&select=id`);
  if (!gl.length) {
    await asUser(token, "POST", "goals", {
      student_id: sid,
      goal_text: "Read 60 words per minute with 95% accuracy",
      baseline: "42 wpm", target: "60 wpm", created_by: uid,
    });
  }

  out[key] = { email, uid, sid };
  console.log(`  teacher ${email}  student ${sid}  + guardian + goal`);
}

// A pending account for the lifecycle layer: authenticates, reaches nothing.
const pid = await ensureUser(ACCOUNTS.p);
console.log(`  pending account ${ACCOUNTS.p} (no org, status pending)`);

// ═══════════════════════════════════════════════════════════════════
console.log(`
Fixture ready. Export these, then run the gate:

  export SUPABASE_URL=${URL_BASE}
  export SUPABASE_ANON_KEY=<anon public key>
  export A_EMAIL=${ACCOUNTS.a}  A_PASSWORD='${PASSWORD}'
  export B_EMAIL=${ACCOUNTS.b}  B_PASSWORD='${PASSWORD}'
  export P_EMAIL=${ACCOUNTS.p}  P_PASSWORD='${PASSWORD}'  P_EXPECT=pending

  node uat/verify-privilege-guard.mjs
  node uat/tenant-isolation-probe.mjs

Afterwards:  node uat/seed-test-schools.mjs --clean
`);
