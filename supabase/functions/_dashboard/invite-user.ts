// ═══════════════════════════════════════════════════════════════════
// invite-user — SINGLE FILE, for the Supabase Dashboard editor
//
// Identical logic to supabase/functions/invite-user/, with
// authorize.ts inlined so it can be pasted into the browser editor,
// which handles one file at a time.
//
// The repo remains the source of truth: the dashboard editor has no
// versioning or rollback, so edit there only to deploy, and make real
// changes in supabase/functions/invite-user/ where the split-out
// authorize.ts is unit-tested by 02-webapp/tests/invite-authorization.
//
// Deploy: Edge Functions → Deploy a new function → Via Editor →
//         name it exactly "invite-user" → paste this → Deploy.
// ═══════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// ALP Platform — Edge Function: invite-user
// Fixes F8: InviteUserModal previously had no backend at all
// (was a setTimeout + toast with zero Supabase calls).
//
// WHY THIS MUST BE AN EDGE FUNCTION, NOT A BROWSER CALL:
// Inviting a user requires supabase.auth.admin.inviteUserByEmail(),
// which only works with the SERVICE ROLE key. That key must never
// be shipped to the browser — anyone could extract it from devtools
// and gain full database access. This function holds that key safely
// server-side and exposes a narrow, authorization-checked endpoint.
//
// DEPLOY:
//   supabase functions deploy invite-user
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your service role key>
//   (SUPABASE_URL is already available automatically in every Edge Function)
// ════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

// ── Inlined from authorize.ts ──────────────────────────────────────

const VALID_ROLES = ["teacher", "director", "admin", "intervention", "related"];

/** Roles permitted to invite anyone at all. */
const INVITER_ROLES = ["director", "admin"];

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
function authorizeInvite(caller, request) {
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


// Five staff roles. Parent/student logins were removed in June 2026 —
// families receive the approved ALP as a PDF, they do not have accounts.
// The single declaration lives in the inlined authorization block below.

// Set ALLOWED_ORIGINS as a comma-separated secret to override.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://growwithalp.com,https://www.growwithalp.com,http://localhost:3000")
  .split(",").map((o) => o.trim());

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = cors(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(corsHeaders, { error: "Missing Authorization header" }, 401);
    }

    // ── Parse the request body ──────────────────────────────────────
    // These are UNTRUSTED. authorizeInvite() decides what the caller is
    // actually allowed to assign; nothing here reaches the database
    // before that decision. Missing entirely in the previous version,
    // which is why every call threw ReferenceError: role is not defined.
    let email, role, orgId;
    try {
      ({ email, role, orgId } = await req.json());
    } catch {
      return json(corsHeaders, { error: "Request body must be JSON" }, 400);
    }
    if (!email || typeof email !== "string") {
      return json(corsHeaders, { error: "An email address is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Step 1: verify the CALLER's identity using their own JWT ──
    // This client uses the anon key + the caller's token, so RLS applies
    // and we can trust auth.uid() reflects who is really calling this.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return json(corsHeaders, { error: "Invalid or expired session" }, 401);
    }

    // ── Step 2: authorize — only Director or Administrator may invite ──
    // This is the critical check. Without it, any authenticated user
    // (even a teacher) could call this function and grant themselves
    // an admin account — a privilege escalation vulnerability.
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role, org_id, school, status")
      .eq("id", caller.id)
      .single();

    const callerRole = callerProfile?.role || "teacher";
    // ── Step 3: authorize ──────────────────────────────────────────
    // One call, so the rules live in a file that tests can exercise
    // directly. Caller facts are server-derived (their own profiles
    // row, via their verified JWT); request facts are untrusted.
    const decision = authorizeInvite(
      {
        role:   callerProfile?.role,
        orgId:  callerProfile?.org_id,
        status: callerProfile?.status,
      },
      { role, orgId, email },
    );

    if (!decision.ok) {
      return json(corsHeaders, { error: decision.error }, decision.status);
    }

    // Use ONLY what authorizeInvite returned. Nothing from the request
    // body reaches the database from here on.
    const targetOrgId = decision.assign.orgId;
    const targetRole  = decision.assign.role;

    // ── Step 4: send the real invite using the service role client ──
    // This client bypasses RLS entirely — only used for this one call.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName || "",
        school: school || callerProfile?.school || "",
      },
      // NOTE: role and org_id are deliberately NOT passed here.
      //
      // This `data` object lands in raw_user_meta_data, which is the
      // same field a public signup controls. The on_auth_user_created
      // trigger therefore ignores it for anything security-relevant,
      // because it cannot tell an invite from a forged self-signup.
      //
      // The trigger creates the profile UNASSIGNED (org_id null, role
      // teacher). We assign the real role and org below, server-side,
      // after the caller has already been checked as a director or
      // admin of targetOrgId.
    });

    if (inviteErr) {
      // Common case: user already exists
      return json(corsHeaders, { error: inviteErr.message || "Failed to send invite" }, 400);
    }

    const invitedId = inviteData?.user?.id;
    if (!invitedId) {
      return json(corsHeaders, { error: "Invite sent but no user id was returned" }, 500);
    }

    // ── Step 5: assign role and organisation (the only path to either) ──
    // Scoped to a profile that is still unassigned, so a replayed or
    // duplicated invite can never move an existing staff member into a
    // different org or change their role.
    const { data: assigned, error: assignErr } = await adminClient
      .from("profiles")
      .update({ org_id: targetOrgId, role: targetRole, status: "active", invited_by: caller.id })
      .eq("id", invitedId)
      .is("org_id", null)
      .select("id")
      .maybeSingle();

    if (assignErr) {
      console.error("invite-user: role assignment failed", assignErr);
      return json(corsHeaders, {
        error: "Invite email sent, but the account could not be given a role. " +
               "Ask the user not to accept it, and try again.",
      }, 500);
    }

    if (!assigned) {
      return json(corsHeaders, {
        error: "That account already belongs to an organisation and was not modified.",
      }, 409);
    }

    return json(corsHeaders, { success: true, userId: invitedId, email });
  } catch (e) {
    console.error("invite-user error:", e);
    return json(corsHeaders, { error: "Unexpected server error" }, 500);
  }
});

function json(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
