// ═══════════════════════════════════════════════════════════════════
// 005 — Invitation / provisioning security
//
//   npm run test:invite
//
// Since public signup can no longer grant a role or an organisation,
// this function is the only route into staff access — which makes it
// the authentication boundary for the product.
//
// These import the REAL authorizeInvite from the Edge Function. They do
// not restate its rules, so they cannot pass against a copy that has
// drifted from what actually ships.
//
// What this file does NOT cover, stated so nobody assumes otherwise:
// JWT verification and the database reads that populate `caller` happen
// in the handler and are exercised by neither this file nor the pgTAP
// suite. What is proven here is that GIVEN a correctly-read caller, no
// combination of request values yields an unauthorised assignment.
// ═══════════════════════════════════════════════════════════════════
import { authorizeInvite, VALID_ROLES } from "../../supabase/functions/invite-user/authorize.ts";

const ORG_A = "aaaaaaaa-0000-0000-0000-00000000000a";
const ORG_B = "bbbbbbbb-0000-0000-0000-00000000000b";

const staff = (role, orgId = ORG_A) => ({ role, orgId, status: "active" });
const invite = (role, extra = {}) => ({ role, email: "new@school.edu", ...extra });

let failed = 0;
function check(name, cond, detail = "") {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${cond ? "" : "  — " + detail}`);
  if (!cond) failed = 1;
}
const denied = (r, status) => !r.ok && (status === undefined || r.status === status);

// ── TEST 1 ─────────────────────────────────────────────────────────
{
  const r = authorizeInvite(staff("teacher"), invite("admin"));
  check("1. a teacher cannot invite an admin", denied(r, 403), JSON.stringify(r));
}

// ── TEST 2 ─────────────────────────────────────────────────────────
{
  const r = authorizeInvite(staff("teacher"), invite("director"));
  check("2. a teacher cannot invite a director", denied(r, 403), JSON.stringify(r));
  const t = authorizeInvite(staff("teacher"), invite("teacher"));
  check("2b. a teacher cannot invite anyone at all, not even a peer", denied(t, 403));
}

// ── TEST 3 ─────────────────────────────────────────────────────────
// No product requirement grants intervention specialists invite rights.
{
  const r = authorizeInvite(staff("intervention"), invite("teacher"));
  check("3. an intervention specialist cannot invite", denied(r, 403));
}

// ── TEST 4 ─────────────────────────────────────────────────────────
{
  const r = authorizeInvite(staff("related"), invite("teacher"));
  check("4. a related-services user cannot invite", denied(r, 403));
}

// ── TEST 5 ─────────────────────────────────────────────────────────
{
  const r = authorizeInvite(staff("director"), invite("teacher"));
  check("5. a director can invite a teacher into their own org", r.ok, JSON.stringify(r));
  check("5b. and the assignment targets the director's own org", r.ok && r.assign.orgId === ORG_A);
  check("5c. with the requested role", r.ok && r.assign.role === "teacher");
}

// ── TEST 6 ─────────────────────────────────────────────────────────
{
  const r = authorizeInvite(staff("director", ORG_A), invite("teacher", { orgId: ORG_B }));
  check("6. a director cannot invite into a different organisation", denied(r, 403), JSON.stringify(r));
}

// ── TEST 7 ─────────────────────────────────────────────────────────
{
  const r = authorizeInvite(staff("director"), invite("admin"));
  check("7. a director cannot assign the admin role", denied(r, 403), JSON.stringify(r));
}

// ── TEST 8 ─────────────────────────────────────────────────────────
{
  for (const role of VALID_ROLES) {
    const r = authorizeInvite(staff("admin"), invite(role));
    check(`8. an admin can invite a ${role}`, r.ok && r.assign.orgId === ORG_A, JSON.stringify(r));
  }
}

// ── TEST 9 ─────────────────────────────────────────────────────────
{
  const r = authorizeInvite(null, invite("teacher"));
  check("9. an unauthenticated caller is rejected", denied(r, 401), JSON.stringify(r));
}

// ── TEST 10 ────────────────────────────────────────────────────────
// The full forged payload: elevated role AND another org's uuid.
{
  const r = authorizeInvite(staff("teacher"), invite("admin", { orgId: ORG_B }));
  check("10. a forged role + foreign org from a teacher is rejected", denied(r, 403));

  const d = authorizeInvite(staff("director"), invite("teacher", { orgId: ORG_B }));
  check("10b. a forged org from a director is rejected, not silently corrected", denied(d, 403));

  // Extra fields a client might hope are honoured.
  const junk = authorizeInvite(
    staff("director"),
    invite("teacher", { is_admin: true, permissions: ["*"], organization_id: ORG_B, orgId: ORG_A }),
  );
  check("10c. unknown body fields (is_admin, permissions) are ignored",
    junk.ok && junk.assign.role === "teacher" && junk.assign.orgId === ORG_A, JSON.stringify(junk));
}

// ── TEST 11 ────────────────────────────────────────────────────────
// Replay cannot escalate through this function; the account-takeover
// half is enforced in SQL (`.is("org_id", null)`) and asserted in
// 005_invitation_security.test.sql.
{
  const first  = authorizeInvite(staff("director"), invite("teacher"));
  const replay = authorizeInvite(staff("director"), invite("admin"));
  check("11. replaying an invite with a higher role still fails", first.ok && denied(replay, 403));

  const cross = authorizeInvite(staff("director", ORG_A), invite("teacher", { orgId: ORG_B }));
  check("11b. replaying with a different org still fails", denied(cross, 403));
}

// ── TEST 12 (client half) ──────────────────────────────────────────
// The pending, unprovisioned account produced by public signup.
{
  const pending = { role: "teacher", orgId: null, status: "pending" };
  const r = authorizeInvite(pending, invite("teacher"));
  check("12. a pending public-signup account cannot invite anyone", denied(r, 403), JSON.stringify(r));

  // Even if a bug set the role high, status/org still gate it.
  const halfBroken = { role: "admin", orgId: null, status: "pending" };
  check("12b. and cannot, even holding an admin role with no org",
    denied(authorizeInvite(halfBroken, invite("admin")), 403));

  const suspended = { role: "director", orgId: ORG_A, status: "suspended" };
  check("12c. a suspended director cannot invite", denied(authorizeInvite(suspended, invite("teacher")), 403));
}

// ── Invalid roles are rejected, never downgraded ───────────────────
for (const bad of ["parent", "student", "family", "guardian", "leadership", "random", "", null]) {
  const r = authorizeInvite(staff("admin"), { role: bad, email: "x@y.edu" });
  check(`role=${JSON.stringify(bad)} is rejected outright`, denied(r, 400), JSON.stringify(r));
}

console.log(failed ? "\n✗ Invitation security tests FAILED\n" : "\n✓ Invitation security tests passed\n");
process.exit(failed);
