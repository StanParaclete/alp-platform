#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// ALP — mock Supabase, for testing the probe itself
//
//   node uat/mock-supabase.mjs --port 8099 --mode secure
//   node uat/mock-supabase.mjs --port 8099 --mode leaky
//
// WHY THIS EXISTS
// probe-selftest.mjs proves the detectors fire, but it feeds them
// fixtures — it never touches the probe's HTTP layer. A probe can have
// perfect detectors and still be useless because it built the wrong
// URL, sent the wrong header, or swallowed a response. This is a
// deliberately fake Supabase that speaks enough PostgREST and GoTrue
// for the probe to run against.
//
//   --mode secure  behaves like a correctly isolated project
//   --mode leaky   ignores tenancy entirely
//
// The probe must come out clean against secure and report BREACHes
// against leaky. If it passes against leaky, the probe is broken.
//
// This is a TEST FIXTURE. It is not a Supabase emulator, it holds no
// real data, and it must never be pointed at by the application.
// ═══════════════════════════════════════════════════════════════════

import { createServer } from "node:http";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const PORT = Number(arg("--port", 8099));
const MODE = arg("--mode", "secure");
const LEAKY = MODE === "leaky";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER_P = "pppppppp-pppp-pppp-pppp-pppppppppppp";

// ── The fake database ──────────────────────────────────────────────
const db = {
  orgs: [{ id: ORG_A, name: "School A" }, { id: ORG_B, name: "School B" }],
  profiles: [
    { id: USER_A, email: "a@a.edu", role: "teacher", org_id: ORG_A, status: "active", full_name: "Teacher A", school: "School A" },
    { id: USER_B, email: "b@b.edu", role: "teacher", org_id: ORG_B, status: "active", full_name: "Teacher B", school: "School B" },
    { id: USER_P, email: "p@p.edu", role: "teacher", org_id: null, status: "pending" },
  ],
  students: [
    { id: "stu-a", org_id: ORG_A, name: "Kwame" },
    { id: "stu-b", org_id: ORG_B, name: "Ama" },
  ],
  student_guardians: [
    { id: "grd-a", org_id: ORG_A, student_id: "stu-a", parent_name: "Akua", is_primary: true },
    { id: "grd-b", org_id: ORG_B, student_id: "stu-b", parent_name: "Yaa", is_primary: true },
  ],
  goals: [
    { id: "goal-a", org_id: ORG_A, student_id: "stu-a", goal_text: "Read 40 wpm" },
    { id: "goal-b", org_id: ORG_B, student_id: "stu-b", goal_text: "Count to 100" },
  ],
  progress_entries: [{ id: "p-b", org_id: ORG_B, student_id: "stu-b" }],
  alp_documents: [{ id: "d-b", org_id: ORG_B, student_id: "stu-b" }],
  alp_versions: [{ id: "v-b", org_id: ORG_B, student_id: "stu-b" }],
  family_messages: [{ id: "m-b", org_id: ORG_B, student_id: "stu-b" }],
  alp_consents: [{ id: "c-b", org_id: ORG_B, student_id: "stu-b" }],
  notifications: [
    { id: "n-a", user_id: USER_A },
    { id: "n-b", user_id: USER_B },
  ],
  audit_log: [{ id: "e-a", org_id: ORG_A }, { id: "e-b", org_id: ORG_B }],
};

// ── Fake JWTs. Only the payload matters; nothing verifies a signature ──
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const mint = (sub) => `header.${b64url({ sub })}.signature`;
const sessions = new Map([
  ["a@a.edu", { pw: "pass-a", sub: USER_A }],
  ["b@b.edu", { pw: "pass-b", sub: USER_B }],
  ["p@p.edu", { pw: "pass-p", sub: USER_P }],
]);

function callerOf(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  try {
    const sub = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
    return db.profiles.find((p) => p.id === sub) || null;
  } catch { return null; }
}

/** The tenancy rule the whole probe exists to test. Disabled in leaky mode. */
function visible(table, rows, caller) {
  if (LEAKY) return rows;
  if (!caller) return [];
  if (table === "notifications") return rows.filter((r) => r.user_id === caller.id);
  if (table === "orgs") return rows.filter((r) => r.id === caller.org_id);
  // profiles_select is "id = auth.uid() OR org_id = current_org_id()" —
  // a user can always read their own row, even while pending.
  if (table === "profiles") {
    return rows.filter((r) => r.id === caller.id ||
      (caller.status === "active" && caller.org_id && r.org_id === caller.org_id));
  }
  if (caller.status !== "active" || !caller.org_id) return [];
  return rows.filter((r) => r.org_id === caller.org_id);
}

function applyFilters(rows, params) {
  let out = rows;
  for (const [key, raw] of params) {
    if (["select", "limit", "order", "offset"].includes(key)) continue;
    const [op, ...rest] = raw.split(".");
    const val = rest.join(".");
    if (op === "eq") out = out.filter((r) => String(r[key]) === val);
  }
  return out;
}

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve) => {
  let s = ""; req.on("data", (c) => (s += c));
  req.on("end", () => { try { resolve(JSON.parse(s || "{}")); } catch { resolve({}); } });
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const caller = callerOf(req);

  // ── GoTrue ───────────────────────────────────────────────────────
  if (path === "/auth/v1/token") {
    const body = await readBody(req);
    const acc = sessions.get(body.email);
    if (!acc || acc.pw !== body.password) return json(res, 400, { msg: "Invalid login credentials" });
    return json(res, 200, { access_token: mint(acc.sub) });
  }

  if (path === "/auth/v1/signup") {
    const body = await readBody(req);
    const meta = body.data || {};
    const sub = `new-${Math.random().toString(36).slice(2, 8)}`;
    // The trigger under test. In secure mode client metadata is ignored
    // for anything security-relevant; in leaky mode it becomes the profile.
    db.profiles.push(LEAKY
      ? { id: sub, email: body.email, role: meta.role || "teacher", org_id: meta.org_id || null, status: meta.status || "pending" }
      : { id: sub, email: body.email, role: "teacher", org_id: null, status: "pending" });
    sessions.set(body.email, { pw: body.password, sub });
    return json(res, 200, { user: { id: sub } });
  }

  // ── Edge Function ────────────────────────────────────────────────
  if (path.endsWith("/invite-user")) {
    if (LEAKY) return json(res, 200, { success: true, userId: "escalated" });
    if (!caller) return json(res, 401, { error: "Missing session" });
    if (caller.status !== "active") return json(res, 403, { error: "Account is not active" });
    if (!["director", "admin"].includes(caller.role)) {
      return json(res, 403, { error: "Only a director or administrator may invite" });
    }
    return json(res, 200, { success: true, userId: "invited" });
  }

  // ── RPC ──────────────────────────────────────────────────────────
  if (path === "/rest/v1/rpc/set_primary_guardian") {
    const body = await readBody(req);
    const g = db.student_guardians.find((x) => x.id === body.p_guardian_contact_id);
    if (LEAKY) {
      // No ownership check at all: the guardian is reassigned to whatever
      // student the caller named and made primary. This is what an
      // unhardened set_primary_guardian() does, and it is why the
      // function was hardened — the ALP notice then goes to the wrong family.
      if (g) {
        g.student_id = body.p_student_id;
        for (const o of db.student_guardians) {
          if (o.student_id === body.p_student_id && o.id !== g.id) o.is_primary = false;
        }
        g.is_primary = true;
      }
      return json(res, 200, g || {});
    }
    const student = db.students.find((s) => s.id === body.p_student_id);
    if (!caller || !student || student.org_id !== caller.org_id) {
      return json(res, 400, { code: "42501", message: "not permitted" });
    }
    if (!g || g.student_id !== body.p_student_id) {
      return json(res, 400, { code: "23503", message: "Guardian does not belong to student" });
    }
    return json(res, 200, g);
  }

  // ── PostgREST ────────────────────────────────────────────────────
  const m = path.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (!m) return json(res, 404, { message: "not found" });
  const table = m[1];
  if (!db[table]) return json(res, 404, { message: `relation ${table} does not exist` });

  const params = [...url.searchParams.entries()];
  const scoped = visible(table, db[table], caller);

  if (req.method === "GET") {
    let rows = applyFilters(scoped, params);
    const select = url.searchParams.get("select") || "*";
    // Resource embedding — a separate code path in real PostgREST, so
    // the mock must model it separately too.
    if (select.includes("students!inner")) {
      rows = rows.map((r) => ({
        id: r.id,
        students: db.students.find((s) => s.id === r.student_id) || null,
      })).filter((r) => r.students);
      if (!LEAKY) rows = rows.filter((r) => r.students.org_id === caller?.org_id);
    }
    return json(res, 200, rows);
  }

  if (req.method === "PATCH") {
    const body = await readBody(req);
    const targets = applyFilters(scoped, params);
    for (const t of targets) {
      let patchBody = body;
      // Models guard_profile_privileges(): privileged columns are frozen
      // against CLIENT writes. Without this the mock's "secure" mode is
      // not actually secure — which is how the real hole was found.
      // Every request the probe makes is a client request, so the
      // service_role/postgres exemption in the real trigger has no
      // equivalent here.
      if (table === "profiles" && !LEAKY) {
        const { role, org_id, status, invited_by, id, ...rest } = body;
        patchBody = rest;
      }
      Object.assign(t, patchBody);
    }
    return json(res, 200, targets);
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const parent = body.student_id && db.students.find((s) => s.id === body.student_id);
    // WITH CHECK: the caller may only insert into their own org.
    if (!LEAKY && (!caller || !parent || parent.org_id !== caller.org_id)) {
      return json(res, 403, { message: "new row violates row-level security policy" });
    }
    const row = { id: `ins-${Math.random().toString(36).slice(2, 8)}`, ...body, org_id: parent?.org_id };
    db[table].push(row);
    return json(res, 201, [row]);
  }

  if (req.method === "DELETE") {
    const targets = applyFilters(scoped, params);
    db[table] = db[table].filter((r) => !targets.includes(r));
    return json(res, 200, targets);
  }

  return json(res, 405, { message: "method not allowed" });
});

server.listen(PORT, () => {
  console.log(`mock supabase (${MODE}) on http://localhost:${PORT}`);
});
