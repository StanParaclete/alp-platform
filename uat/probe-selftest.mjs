#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Self-test for the leak-detection logic in tenant-isolation-probe.mjs
//
//   node uat/probe-selftest.mjs
//
// A probe that cannot detect a breach is worse than no probe, because
// a clean run gets trusted. This exercises each detector against both a
// correctly-isolated response and a leaking one, so a green probe run
// means something.
//
// IMPORTANT CHANGE FROM THE EARLIER VERSION
// This file used to re-declare its own copy of every predicate. That
// proved a *copy* of the logic worked — the probe could drift and this
// would stay green. It now imports the real detectors from
// detectors.mjs, the same module the probe uses. There is one
// definition and two callers.
//
// This does NOT contact a server. The probe's network layer is
// exercised only when you run it against a real Supabase project — see
// UAT_PLAN.md about what that does and does not prove.
// ═══════════════════════════════════════════════════════════════════

import * as D from "./detectors.mjs";

const A_ORG = "org-a";
const B_ORG = "org-b";
const A_USER = "user-a";
const B_USER = "user-b";

// Each entry: the real detector, a response it must call clean, and a
// response it must call a breach. Nothing here re-implements logic.
const CASES = {
  directFetch: {
    fn: (r) => D.directFetch(r),
    isolated: [],
    leaking: [{ id: "stu-b", name: "Ama", org_id: B_ORG }],
  },
  unfilteredScan: {
    fn: (r) => D.unfilteredScan(r, A_ORG),
    isolated: [{ id: "stu-a", org_id: A_ORG }],
    leaking: [{ id: "stu-a", org_id: A_ORG }, { id: "stu-b", org_id: B_ORG }],
  },
  orgFilter: {
    fn: (r) => D.orgFilter(r),
    isolated: [],
    leaking: [{ id: "stu-b", org_id: B_ORG }],
  },
  guardians: {
    fn: (r) => D.guardians(r),
    isolated: [],
    leaking: [{ id: "g-b", student_id: "stu-b", parent_name: "Yaa" }],
  },
  childTable: {
    fn: (r) => D.childTable(r),
    isolated: [],
    leaking: [{ id: "goal-b", student_id: "stu-b" }],
  },
  embeddedJoin: {
    fn: (r) => D.embeddedJoin(r, A_ORG),
    isolated: [{ id: "g1", students: { id: "stu-a", org_id: A_ORG } }],
    leaking: [{ id: "g1", students: { id: "stu-b", org_id: B_ORG } }],
  },
  roster: {
    fn: (r) => D.roster(r, A_ORG),
    isolated: [{ id: "u-a", email: "a@a.edu", org_id: A_ORG }],
    leaking: [{ id: "u-a", org_id: A_ORG }, { id: "u-b", email: "b@b.edu", org_id: B_ORG }],
  },
  orgs: {
    fn: (r) => D.orgs(r, A_ORG),
    isolated: [{ id: A_ORG, name: "School A" }],
    leaking: [{ id: A_ORG, name: "School A" }, { id: B_ORG, name: "School B" }],
  },
  auditLog: {
    fn: (r) => D.auditLog(r, A_ORG),
    isolated: [{ id: "e1", org_id: A_ORG }],
    leaking: [{ id: "e1", org_id: A_ORG }, { id: "e2", org_id: B_ORG }],
  },
  notifications: {
    fn: (r) => D.notifications(r, A_USER),
    isolated: [{ id: "n1", user_id: A_USER }],
    leaking: [{ id: "n1", user_id: A_USER }, { id: "n2", user_id: B_USER }],
  },
  anonymous: {
    fn: (r) => D.anonymous(r),
    isolated: [],
    leaking: [{ id: "stu-a" }, { id: "stu-b" }],
  },
  writeRefused: {
    fn: (r) => D.writeRefused(r),
    isolated: { status: 200, data: [] },
    leaking: { status: 200, data: [{ id: "stu-b", name: "Ama" }] },
  },
  deleteRefused: {
    fn: (r) => D.deleteRefused(r),
    isolated: { status: 200, data: [] },
    leaking: { status: 200, data: [{ id: "stu-b" }] },
  },
  rpcRefused: {
    fn: (r) => D.rpcRefused(r),
    isolated: { status: 400, data: { code: "23503", message: "Guardian does not belong to student" } },
    leaking: { status: 200, data: { id: "g-b", student_id: "stu-b", is_primary: true } },
  },
  escalationRefused: {
    fn: (r) => D.escalationRefused(r),
    isolated: { status: 403, data: { error: "Only a director or administrator may invite" } },
    leaking: { status: 200, data: { success: true, userId: "u-new" } },
  },
  signupNotEscalated: {
    fn: (p) => D.signupNotEscalated(p),
    isolated: { org_id: null, role: "teacher", status: "pending" },
    leaking: { org_id: B_ORG, role: "admin", status: "active" },
  },
  selfEscalationRefused: {
    fn: (r) => D.selfEscalationRefused(r, A_ORG),
    isolated: { status: 200, data: [] },
    leaking: { status: 200, data: [{ id: A_USER, role: "admin", org_id: B_ORG }] },
  },
  noAccessAtAll: {
    fn: (r) => D.noAccessAtAll(r),
    isolated: { students: [], goals: [], orgs: [] },
    leaking: { students: [{ id: "stu-a" }], goals: [], orgs: [] },
  },
  hasOwnAccess: {
    fn: (r) => D.hasOwnAccess(r),
    isolated: [{ id: "stu-a" }],
    leaking: [],
  },
};

let failed = 0;
function check(name, cond, detail = "") {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`);
  if (!cond) failed = 1;
}

console.log("\n── against correct behaviour (every detector must report clean) ──");
for (const [name, c] of Object.entries(CASES)) {
  check(`${name}: reports no breach`, c.fn(c.isolated) === true,
    "this detector would raise a false breach on a healthy database");
}

console.log("\n── against a breach (every detector must catch it) ──");
for (const [name, c] of Object.entries(CASES)) {
  check(`${name}: detects the breach`, c.fn(c.leaking) === false,
    "this detector would have stayed silent through a real leak");
}

// ── The subtle ones, spelled out ───────────────────────────────────
console.log("\n── edge cases a naive detector would miss ──");

check("a scan mixing own and foreign rows is still a breach",
  D.unfilteredScan([{ org_id: A_ORG }, { org_id: A_ORG }, { org_id: B_ORG }], A_ORG) === false,
  "checking only 'did I get rows' would pass here");

check("an embedded join leaking through the relation is caught",
  D.embeddedJoin([{ id: "g", students: { org_id: B_ORG } }], A_ORG) === false,
  "the top-level table looked fine; the join did not");

check("a roster row with a null org is not miscounted as foreign",
  D.roster([{ id: "u", org_id: null }], A_ORG) === true,
  "pending accounts have a null org and must not raise a false breach");

check("a write returning a representation row is a breach",
  D.writeRefused({ status: 200, data: [{ id: "stu-b" }] }) === false,
  "the write succeeded even though the value was unchanged");

check("a write refused with an error body is not a breach",
  D.writeRefused({ status: 403, data: { message: "new row violates row-level security policy" } }) === true);

// ── The regression this whole rewrite exists for ───────────────────
console.log("\n── the dead-check regression ──");

check("notifications with no caller uuid reports UNDETERMINED, not clean",
  D.notifications([{ id: "n2", user_id: B_USER }], null) === null,
  "the previous version called pass() unconditionally — it could not fail");

check("notifications catches another user's row",
  D.notifications([{ id: "n1", user_id: A_USER }, { id: "n2", user_id: B_USER }], A_USER) === false,
  "notifications are scoped by user_id, so an org comparison would miss this entirely");

check("an unreachable endpoint reports UNDETERMINED, not clean",
  D.escalationRefused({ status: 0, data: null }) === null,
  "a network failure must not read as 'the escalation was refused'");

check("a 200 that quietly did nothing still counts as refused",
  D.escalationRefused({ status: 200, data: { error: "not permitted" } }) === true);

// ── Escalation edge cases ──────────────────────────────────────────
console.log("\n── escalation edge cases ──");

check("a signup that kept its role but took an org is a breach",
  D.signupNotEscalated({ org_id: B_ORG, role: "teacher", status: "pending" }) === false,
  "org_id alone is enough — that was the original vulnerability");

check("a signup that kept null org but took a role is a breach",
  D.signupNotEscalated({ org_id: null, role: "admin", status: "pending" }) === false);

check("an unreadable profile reports UNDETERMINED, not clean",
  D.signupNotEscalated(null) === null,
  "the account may simply not be able to see itself — that is not proof of safety");

check("a signup that arrived active rather than pending is a breach",
  D.signupNotEscalated({ org_id: null, role: "teacher", status: "active" }) === false,
  "skipping provisioning is escalation even without a role change");

check("a profile update returned unchanged is not a breach",
  D.selfEscalationRefused({ status: 200, data: [{ id: A_USER, role: "teacher", org_id: A_ORG }] }, A_ORG) === true,
  "the row came back but a trigger overwrote the forged fields — that is the defence working");

check("an RPC returning a guardian row is a breach even on HTTP 200",
  D.rpcRefused({ status: 200, data: { id: "g-b", is_primary: true } }) === false);

check("an RPC returning an empty result is refused",
  D.rpcRefused({ status: 200, data: [] }) === true);

// ── Coverage guard ─────────────────────────────────────────────────
// If someone adds a detector and forgets to add a case here, say so.
console.log("\n── coverage ──");
const exported = Object.keys(D).filter(
  (k) => typeof D[k] === "function" && k !== "rowsOf");
const untested = exported.filter((k) => !(k in CASES));
check(`every exported detector has a case (${exported.length} exported)`,
  untested.length === 0,
  `untested: ${untested.join(", ")}`);

console.log(failed
  ? "\n✗ Probe self-test FAILED\n"
  : `\n✓ Probe self-test passed — ${exported.length} detectors, each verified in both directions\n`);
process.exit(failed);
