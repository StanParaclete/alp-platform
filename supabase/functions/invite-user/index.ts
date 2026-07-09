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

const VALID_ROLES = ["teacher", "director", "leadership", "admin", "intervention", "related_service"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
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
      return json({ error: "Invalid or expired session" }, 401);
    }

    // ── Step 2: authorize — only director/admin/leadership may invite ──
    // This is the critical check. Without it, any authenticated user
    // (even a teacher) could call this function and grant themselves
    // an admin account — a privilege escalation vulnerability.
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    const callerRole = callerProfile?.role || "teacher";
    if (!["director", "admin", "leadership"].includes(callerRole)) {
      return json({ error: "Only Directors, Leadership, or Administrators can invite users" }, 403);
    }

    // ── Step 3: validate request body ──
    const body = await req.json().catch(() => ({}));
    const { email, role, fullName, school } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return json({ error: "A valid email address is required" }, 400);
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return json({ error: `Role must be one of: ${VALID_ROLES.join(", ")}` }, 400);
    }

    // ── Step 4: send the real invite using the service role client ──
    // This client bypasses RLS entirely — only used for this one call.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName || "",
        role,
        school: school || callerProfile?.school || "",
        invited_by: caller.id,
      },
      // Supabase sends a magic-link invite email automatically.
      // The on_auth_user_created trigger (schema.sql) reads this
      // metadata and creates the matching profiles row.
    });

    if (inviteErr) {
      // Common case: user already exists
      return json({ error: inviteErr.message || "Failed to send invite" }, 400);
    }

    return json({ success: true, userId: inviteData?.user?.id, email });
  } catch (e) {
    console.error("invite-user error:", e);
    return json({ error: "Unexpected server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
