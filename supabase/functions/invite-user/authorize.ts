// ═══════════════════════════════════════════════════════════════════
// ALP — Invitation authorization
//
// The public signup path can no longer grant a role or an organisation.
// That makes THIS the only way anyone becomes staff, which makes it the
// authentication boundary for the whole product.
//
// The decision is extracted here as a pure function for one reason: a
// boundary that cannot be tested is a boundary nobody has checked. The
// Edge Function handler does I/O — JWT verification, database reads,
// sending mail — and none of that runs in a unit test. This function
// does no I/O, so every rule below is exercised directly by
// tests/invite-authorization.test.mjs against this exact code, rather
// than against a re-implementation of it that could drift.
//
// Everything it receives about the CALLER is server-derived: the role
// and org come from the caller's own profiles row, looked up with their
// verified JWT. Everything it receives about the REQUEST is
// attacker-controlled and is treated that way.
// ═══════════════════════════════════════════════════════════════════

export const VALID_ROLES = ["teacher", "director", "admin", "intervention", "related"];

/** Roles permitted to invite anyone at all. */
export const INVITER_ROLES = ["director", "admin"];

/**
 * Decide whether an invitation may proceed.
 *
 * @param caller  {role, orgId, status} — read server-side from profiles
 * @param request {role, orgId, email}  — from the request body, untrusted
 * @returns {ok:true, assign:{role, orgId}} | {ok:false, status, error}
 *
 * On success `assign` is what the server should write. It is built from
 * the CALLER's org, never the request's, so a forged org_id cannot move
 * anyone into another school even if every other check passed.
 */
export function authorizeInvite(caller, request) {
  // ── The caller must be a provisioned staff account ──────────────
  // An unauthenticated caller arrives here as null. A signed-up but
  // unprovisioned account arrives with status "pending" and no org —
  // that account can no more invite people than a stranger can.
  if (!caller) {
    return { ok: false, status: 401, error: "Sign in to invite staff" };
  }
  if (caller.status !== "active" || !caller.orgId) {
    return {
      ok: false, status: 403,
      error: "Your account is not yet assigned to a school",
    };
  }
  if (!INVITER_ROLES.includes(caller.role)) {
    return {
      ok: false, status: 403,
      error: "Only Directors and Administrators can invite staff",
    };
  }

  // ── The requested role must be one of the five ──────────────────
  // Rejected outright, never downgraded to something valid: an invite
  // that quietly becomes a teacher account is an invite nobody
  // reviewed.
  if (!request?.role || !VALID_ROLES.includes(request.role)) {
    return {
      ok: false, status: 400,
      error: `Role must be one of: ${VALID_ROLES.join(", ")}`,
    };
  }

  // ── Privilege ceiling ───────────────────────────────────────────
  // A director inviting an admin, then signing in to that admin
  // account, is a one-step escalation past their own tier.
  if (request.role === "admin" && caller.role !== "admin") {
    return {
      ok: false, status: 403,
      error: "Only Administrators can invite other Administrators",
    };
  }

  // ── Tenant binding ──────────────────────────────────────────────
  // A supplied org id is only ever compared, never used. Anything
  // other than the caller's own org is refused rather than silently
  // corrected, so a client trying it gets an error instead of a
  // surprise.
  if (request.orgId && request.orgId !== caller.orgId) {
    return {
      ok: false, status: 403,
      error: "Cannot invite users into another organisation",
    };
  }

  if (!request.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
    return { ok: false, status: 400, error: "A valid email address is required" };
  }

  return {
    ok: true,
    assign: {
      role: request.role,
      orgId: caller.orgId,   // the caller's, always — never the request's
    },
  };
}
