#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// ALP — diagnose "Failed to fetch" on signup
//
//   node uat/diagnose-signup.mjs
//
// "Failed to fetch" is a browser-level network failure: the request
// never reached Supabase, or the response never came back. It is NOT
// an application error, which is why nothing appears in your Supabase
// logs when it happens.
//
// That narrows it a lot. It rules out RLS, missing tables, missing
// triggers and bad passwords — all of those return a JSON error, and
// the app would show that message instead.
//
// Run with the SAME values your Netlify build uses:
//
//   export SUPABASE_URL=https://<ref>.supabase.co
//   export SUPABASE_ANON_KEY=<anon key>
//   node uat/diagnose-signup.mjs
// ═══════════════════════════════════════════════════════════════════

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, "");
const ANON = process.env.SUPABASE_ANON_KEY;

if (!URL_BASE || !ANON) {
  console.error(`
Set both first:

  export SUPABASE_URL=https://<project-ref>.supabase.co
  export SUPABASE_ANON_KEY=<anon public key>

Get them from Supabase → Settings → API. They must match exactly what
Netlify used at BUILD time — Vite inlines VITE_* into the bundle, so a
variable added after the last build is not in the deployed JavaScript.
`);
  process.exit(2);
}

console.log(`\nDiagnosing ${URL_BASE}\n`);

let verdict = null;

// ── 1. Is the hostname shaped correctly? ───────────────────────────
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(URL_BASE)) {
  console.log(`  WARN  the URL does not look like https://<ref>.supabase.co`);
  console.log(`        a trailing slash, a path, or http:// will all fail`);
} else {
  console.log(`  ok    URL shape looks right`);
}

// ── 2. Does the host resolve and answer at all? ────────────────────
try {
  const r = await fetch(`${URL_BASE}/auth/v1/health`, {
    headers: { apikey: ANON },
    signal: AbortSignal.timeout(10000),
  });
  console.log(`  ok    the host answered — HTTP ${r.status}`);

  if (r.status === 401 || r.status === 403) {
    verdict = "BAD_KEY";
  }
} catch (err) {
  console.log(`  FAIL  could not reach the host — ${err.name}: ${err.message}`);
  verdict = "UNREACHABLE";
}

// ── 3. Does the REST layer accept the anon key? ────────────────────
if (verdict !== "UNREACHABLE") {
  try {
    const r = await fetch(`${URL_BASE}/rest/v1/`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 401) {
      console.log(`  FAIL  the anon key was rejected (HTTP 401)`);
      verdict = verdict || "BAD_KEY";
    } else {
      console.log(`  ok    the anon key is accepted by the REST endpoint`);
    }
  } catch (err) {
    console.log(`  FAIL  REST endpoint unreachable — ${err.message}`);
    verdict = verdict || "UNREACHABLE";
  }
}

// ── 4. Is the schema actually deployed? ────────────────────────────
if (verdict !== "UNREACHABLE" && verdict !== "BAD_KEY") {
  try {
    const r = await fetch(`${URL_BASE}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.text();

    if (r.status === 404 || body.includes("does not exist") ||
        body.includes("PGRST205") || body.includes("Could not find the table")) {
      console.log(`  FAIL  the 'profiles' table does not exist — migrations were never run`);
      verdict = verdict || "NO_SCHEMA";
    } else {
      // An empty array here is correct and expected: RLS denies the
      // anon role, which is exactly what it should do.
      console.log(`  ok    the 'profiles' table exists and RLS is answering`);
    }
  } catch (err) {
    console.log(`  FAIL  schema probe failed — ${err.message}`);
  }
}

// ── 5. Can a signup actually complete? ─────────────────────────────
if (!verdict) {
  const probe = `alp-diagnostic-${Date.now()}@example.com`;
  try {
    const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: probe,
        password: `Diag-${Math.random().toString(36).slice(2)}-9A`,
        data: { full_name: "Diagnostic Probe" },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.json().catch(() => ({}));

    if (r.ok) {
      console.log(`  ok    signup completed — the endpoint is healthy`);
      console.log(`\n        A test account was created: ${probe}`);
      console.log(`        Delete it in Supabase → Authentication → Users.`);
    } else if (body.msg?.includes("Signups not allowed") ||
               body.error_code === "signup_disabled") {
      console.log(`  FAIL  signups are DISABLED in this project`);
      verdict = "SIGNUP_DISABLED";
    } else if (body.msg?.includes("Database error") ||
               body.error_code === "unexpected_failure") {
      console.log(`  FAIL  the database rejected the signup: ${body.msg}`);
      console.log(`        usually the on_auth_user_created trigger erroring`);
      verdict = "TRIGGER_ERROR";
    } else {
      console.log(`  FAIL  signup returned HTTP ${r.status}: ${body.msg || body.error || ""}`);
      verdict = "SIGNUP_REJECTED";
    }
  } catch (err) {
    console.log(`  FAIL  the signup request itself failed — ${err.message}`);
    verdict = "UNREACHABLE";
  }
}

// ── Verdict ────────────────────────────────────────────────────────
const ADVICE = {
  UNREACHABLE: `
The host did not answer. In a browser this is exactly "Failed to fetch".

Most likely, in order:

1. THE PROJECT IS PAUSED. Free-tier Supabase projects pause after about
   a week of inactivity, and a paused project stops answering entirely.
   Supabase dashboard → the project will say "Paused" with a Restore
   button. This is the single most common cause of this symptom.

2. The URL baked into the deployed bundle is wrong or empty. Vite
   inlines VITE_* at BUILD time, so setting the variable in Netlify
   after the last build changes nothing until you redeploy.
   Check: open growwithalp.com → DevTools → Network → attempt signup →
   look at the failed request's URL. If it is undefined/... or points
   somewhere unexpected, that is your answer. Fix the variable, then
   trigger a fresh deploy.

3. The project was deleted or the ref changed.`,

  BAD_KEY: `
The anon key was rejected. It probably belongs to a different project
than the URL, or it is the service_role key, or it was rotated after
the last build. Supabase → Settings → API → "anon public". Redeploy
after changing it, since it is inlined at build time.`,

  NO_SCHEMA: `
The database has no 'profiles' table, so the migrations have never been
run against this project.

    supabase link --project-ref <ref>
    supabase db push

Note this alone would NOT produce "Failed to fetch" — it produces a
JSON error. If you are seeing both, fix the network problem first.`,

  SIGNUP_DISABLED: `
Signups are turned off for this project. Supabase → Authentication →
Providers → Email → "Allow new users to sign up".

Worth deciding rather than just flipping: ALP is now an
invitation-based staff platform, so leaving signups disabled and
provisioning staff through invites is a defensible choice.`,

  TRIGGER_ERROR: `
Auth accepted the request and the database rejected it — almost always
on_auth_user_created raising.

Check Supabase → Logs → Postgres for the actual error, and confirm the
trigger and the profiles table both exist:

    select tgname from pg_trigger where tgname = 'on_auth_user_created';
    select count(*) from public.profiles;`,

  SIGNUP_REJECTED: `
The endpoint answered but refused. The message above is from Supabase
and usually says why — rate limiting, an email-domain restriction, or
password requirements.`,
};

if (verdict) {
  console.log(`\n════ ${verdict} ════`);
  console.log(ADVICE[verdict]);
  process.exit(1);
}

console.log(`
════ HEALTHY ════

Signup works against this project from here. If the browser still shows
"Failed to fetch", the deployed bundle is not using these values.

Open growwithalp.com → DevTools → Network → attempt a signup → look at
the failed request. Its URL is the one actually compiled into the
deployed JavaScript, and it will not match what you just tested.
`);
